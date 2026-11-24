// Smoke test of the deployed UAT site, as each role, through its public address. Run by
// .github/workflows/uat-smoke.yml after every deploy of `develop`; it can also be run by hand:
//
//   UAT_BASE_URL=https://<frontend host> UAT_ACCOUNTS='{"admin":["email","password"],...}' node Backend/test/uat-smoke.mjs
//
// UAT_ACCOUNTS holds one [email, password] per role: admin, it, supervisor, employee, management, property.
// Set WAIT_FOR_DEPLOY=1 to first wait until the backend has restarted after this run started (a new build is live).
// It files, approves and fulfils one requisition marked [UAT-SMOKE] and prints it twice; those records stay in the audit log.
const BASE = (process.env.UAT_BASE_URL || '').replace(/\/$/, '');
if (!BASE || !process.env.UAT_ACCOUNTS) {
  console.error('Set UAT_BASE_URL and UAT_ACCOUNTS.');
  process.exit(2);
}
const ACCOUNTS = JSON.parse(process.env.UAT_ACCOUNTS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const tok = {};
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`);
};

async function call(role, method, path, body) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(BASE + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tok[role] ? { Authorization: `Bearer ${tok[role]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      await sleep(15000);
      continue;
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('json')) {
      const j = await res.json().catch(() => ({}));
      return { status: res.status, data: j.data, message: j.message };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, pdf: buf.subarray(0, 4).toString() === '%PDF', bytes: buf.length, docNumber: res.headers.get('x-document-number') };
  }
  return { status: 429 };
}
const expectOk = async (role, path, label) => {
  const r = await call(role, 'GET', path);
  check(`${role}: ${label || 'GET ' + path}`, r.status === 200, r.status === 200 ? '' : `HTTP ${r.status} ${r.message || ''}`);
  return r;
};
const expectDenied = async (role, method, path, body, label) => {
  const r = await call(role, method, path, body);
  check(`${role} is refused: ${label}`, r.status === 403 || r.status === 401, `HTTP ${r.status}`);
};

// 0. A deploy is only tested once it is live: the backend restarts on every deploy, so its uptime drops below the
// time this run has been going. Gives up (and fails) after 25 minutes, which also catches a deploy that never happened.
if (process.env.WAIT_FOR_DEPLOY === '1') {
  const started = Date.now();
  let live = false;
  while (Date.now() - started < 25 * 60 * 1000) {
    const h = await call(null, 'GET', '/health').catch(() => ({ status: 0 }));
    if (h.status === 200 && typeof h.data?.uptime === 'number' && h.data.uptime < (Date.now() - started) / 1000 + 5) {
      live = true;
      break;
    }
    await sleep(30000);
  }
  check('a new build went live within 25 minutes', live, live ? '' : 'the backend never restarted: the deploy did not happen (Wait for CI stuck, or the build failed)');
  if (!live) process.exit(1);
}

console.log('== 1. site and sign-in');
const health = await call(null, 'GET', '/health');
check('health through the frontend, database connected', health.status === 200 && health.data?.db === true, `HTTP ${health.status}`);
for (const [role, [email, password]] of Object.entries(ACCOUNTS)) {
  const r = await call(null, 'POST', '/v1/auth/login', { emailOrEmployeeId: email, password });
  tok[role] = r.data?.accessToken;
  check(`${role} signs in`, r.status === 200 && !!tok[role], r.status === 200 ? '' : `HTTP ${r.status} ${r.message || ''}`);
}

console.log('== 2. each role reads its own pages');
await expectOk('employee', '/v1/assets/mine', 'my assigned assets');
await expectOk('employee', '/v1/requisitions/mine', 'my requisitions');
const cat = await expectOk('employee', '/v1/assets/catalogue/items?limit=5', 'catalogue');
await expectOk('employee', '/v1/notifications', 'notifications');
await expectOk('supervisor', '/v1/requisitions', 'approval queue');
await expectOk('supervisor', '/v1/requisitions/decided', 'approval history');
const assets = await expectOk('it', '/v1/assets?limit=5', 'ICT registry');
await expectOk('it', '/v1/repairs', 'maintenance & repair');
await expectOk('it', '/v1/requisitions/replacement-review', 'replacement validation');
await expectOk('it', '/v1/reports/forms', 'forms archive');
await expectOk('property', '/v1/assets?limit=5', 'fixed assets & supplies registry');
await expectOk('property', '/v1/repairs', 'maintenance & repair');
await expectOk('management', '/v1/audit?limit=5', 'audit log (read-only)');
await expectOk('management', '/v1/requisitions/stats', 'executive stats');
await expectOk('admin', '/v1/users?limit=5', 'user directory');
await expectOk('admin', '/v1/system-config', 'system settings');
await expectOk('admin', '/v1/notifications/watcher-status', 'platform health');

console.log('== 3. access control: what each role must NOT do');
await expectDenied('employee', 'GET', '/v1/users', undefined, 'the user directory');
await expectDenied('employee', 'GET', '/v1/audit?limit=1', undefined, 'the audit log');
await expectDenied('employee', 'POST', '/v1/reports/generate', { reportType: 'ASSET_MASTER_LIST', format: 'pdf' }, 'management reports');
await expectDenied('it', 'GET', '/v1/users', undefined, 'the user directory');
await expectDenied('management', 'POST', '/v1/requisitions', { requisitionType: 'new', justification: 'x', requiredDate: '2030-01-01', items: [] }, 'filing a requisition');
await expectDenied('supervisor', 'GET', '/v1/system-config', undefined, 'system settings');

console.log('== 4. requisition workflow: employee files, officer approves, custodian fulfils');
const item = (cat.data || []).find((i) => i.assetType === 'ICT') || (cat.data || [])[0];
if (!item) check('employee can pick a catalogue item', false, 'catalogue empty');
else {
  const when = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const created = await call('employee', 'POST', '/v1/requisitions', {
    requisitionType: item.assetClass === 'IES' ? 'supply' : 'new',
    justification: '[UAT-SMOKE] deployment check, safe to ignore',
    requiredDate: when,
    items: [{ assetType: item.assetType, assetClass: item.assetClass, itemDescription: item.itemDescription, quantity: 1 }],
  });
  const reqId = created.data?.id;
  check('employee files a requisition', (created.status === 201 || created.status === 200) && !!reqId, `HTTP ${created.status} ${created.data?.requestNumber || created.message || ''}`);
  if (reqId) {
    const ap = await call('supervisor', 'POST', `/v1/requisitions/${reqId}/approve`, { comments: '[UAT-SMOKE] approved' });
    check('approving officer approves it', ap.status === 200, `HTTP ${ap.status} ${ap.message || ''}`);
    const owner = item.assetType === 'ICT' ? 'it' : 'property';
    const fu = await call(owner, 'POST', `/v1/requisitions/${reqId}/fulfill`, { notes: '[UAT-SMOKE] fulfilled' });
    check(`${owner === 'it' ? 'IT' : 'Property'} custodian fulfils it`, fu.status === 200, `HTTP ${fu.status} ${fu.message || ''}`);
    const done = await call('employee', 'GET', `/v1/requisitions/${reqId}`);
    check('employee sees it fulfilled', done.data?.status === 'fulfilled', `status ${done.data?.status}`);

    // Paper copies (CLAUDE.md Module 8): whoever can see the record prints it; each print is a new number.
    const first = await call('employee', 'POST', `/v1/requisitions/${reqId}/print`);
    check('employee prints a paper copy of the requisition (numbered PDF)', first.status === 200 && first.pdf && /^PR-\d{4}-\d{4}$/.test(first.docNumber || ''), `HTTP ${first.status} ${first.docNumber || ''}`);
    const second = await call(owner, 'POST', `/v1/requisitions/${reqId}/print`);
    check('the custodian prints a second copy with its own number', second.status === 200 && second.pdf && !!second.docNumber && second.docNumber !== first.docNumber, `HTTP ${second.status} ${second.docNumber || ''}`);
    const prints = await call('employee', 'GET', `/v1/requisitions/${reqId}/prints`);
    check('the requisition lists both copies, oldest first', Array.isArray(prints.data) && prints.data.map((p) => p.copy).join() === '1,2', `copies ${(prints.data || []).map((p) => p.copy).join()}`);
    const other = owner === 'it' ? 'property' : 'it';
    const denied = await call(other, 'POST', `/v1/requisitions/${reqId}/print`);
    check(`the ${other} custodian cannot print a requisition outside their asset type`, denied.status === 403 || denied.status === 404, `HTTP ${denied.status}`);
    const archive = await call('admin', 'GET', '/v1/reports/forms?formType=RECORD_PRINT&limit=5');
    check('paper copies are not in the forms archive', archive.status === 200 && (archive.data?.data || []).length === 0, `HTTP ${archive.status}, ${(archive.data?.data || []).length} listed`);
    const after = await call('employee', 'GET', `/v1/requisitions/${reqId}`);
    check('paper copies are not listed as official documents', !(after.data?.documents || []).some((d) => d.formType === 'RECORD_PRINT'), '');
  }
}

console.log('== 5. documents');
const asset = (assets.data?.data || [])[0];
if (asset) {
  const f = await call('it', 'POST', '/v1/reports/forms/generate', { formType: 'PTR', assetId: asset.id, targetOffice: 'Records Section' });
  check('IT generates a Property Transfer Report (PDF)', f.status === 200 && f.pdf, `HTTP ${f.status}, ${f.bytes || 0} bytes`);
}
const rep = await call('management', 'POST', '/v1/reports/generate', { reportType: 'ASSET_MASTER_LIST', format: 'pdf' });
check('management downloads the Asset Master List (PDF)', rep.status === 200 && rep.pdf, `HTTP ${rep.status}, ${rep.bytes || 0} bytes`);
const xl = await call('management', 'POST', '/v1/reports/generate', { reportType: 'REQUISITION_HISTORY', format: 'excel' });
check('management downloads the Requisition History (Excel)', xl.status === 200, `HTTP ${xl.status}, ${xl.bytes || 0} bytes`);
const aud = await call('admin', 'POST', '/v1/reports/generate', { reportType: 'AUDIT_TRAIL', format: 'pdf' });
check('admin downloads the Audit Trail report (PDF)', aud.status === 200 && aud.pdf, `HTTP ${aud.status}, ${aud.bytes || 0} bytes`);

console.log('== 6. audit trail');
const log = await call('admin', 'GET', '/v1/audit?limit=15');
const actions = (log.data?.data || []).map((r) => r.action);
check('the audit log recorded the workflow', ['requisition_submitted', 'requisition_approved', 'requisition_fulfilled'].some((a) => actions.includes(a)), `latest: ${[...new Set(actions)].slice(0, 5).join(', ')}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n== ${results.length - failed.length}/${results.length} checks passed${failed.length ? '; FAILED: ' + failed.map((f) => f.name).join(' | ') : ''}`);
process.exit(failed.length ? 1 : 0);
