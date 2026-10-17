// The UAT password gate: a Cloudflare Worker that sits in front of the Railway frontend.
// Deploy it as a Worker (Compute > Workers & Pages > Hello World > Edit code) and add two SECRET variables,
// GATE_PASSWORD and COOKIE_SECRET. Set ORIGIN to the frontend's Railway host. See DEPLOY-UAT.md.
const ORIGIN = 'frontend-production-8900.up.railway.app';
const DAYS = 7;
const enc = new TextEncoder();

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function allowed(request, env) {
  const m = /(?:^|;\s*)uat_gate=([^;]+)/.exec(request.headers.get('Cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  return Number(exp) > Date.now() && same(sig || '', await sign(env.COOKIE_SECRET, exp));
}
const gatePage = (msg) => new Response(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>AIMRS</title>
<body style="font-family:sans-serif;max-width:340px;margin:20vh auto;padding:0 16px">
<h2>AIMRS test site</h2><p>${msg || 'Enter the access password you were given.'}</p>
<form method="post" action="/__gate"><input type="password" name="password" autofocus required style="width:100%;padding:10px;font-size:16px">
<button style="margin-top:12px;padding:10px 16px;font-size:16px">Continue</button></form></body>`,
  { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } },
);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === '/__gate' && request.method === 'POST') {
      const form = await request.formData();
      if (same(String(form.get('password') || ''), env.GATE_PASSWORD)) {
        const exp = String(Date.now() + DAYS * 864e5);
        const cookie = `uat_gate=${exp}.${await sign(env.COOKIE_SECRET, exp)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
        return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie } });
      }
      return gatePage('Wrong password.');
    }
    if (!(await allowed(request, env))) return gatePage();

    const target = new URL(request.url);
    target.hostname = ORIGIN;
    target.protocol = 'https:';
    target.port = '';
    const res = await fetch(new Request(target, request), { redirect: 'manual' });
    const out = new Response(res.body, res);
    const loc = out.headers.get('Location');
    if (loc) out.headers.set('Location', loc.replace('https://' + ORIGIN, incoming.origin));
    return out;
  },
};
