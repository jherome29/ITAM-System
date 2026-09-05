'use client';

import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { usersApi, type CreateUserDto, type UpdateUserDto, type User } from '@/lib/api/users';
import { alternateApproverOptions, buildAvailabilityPayload } from '@/lib/users/availability';
import { accessReviews, organizationUnits } from '@/lib/mock/admin.mock';
import { ActionMenu, AdminPageHeader, Field, inputClass, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from './AdminUi';

type IdentitySlug = 'users' | 'roles' | 'access-reviews' | 'organizational-units';

export function AdminIdentityPages({ slug }: Readonly<{ slug: IdentitySlug }>) {
  if (slug === 'users') return <UsersPage />;
  if (slug === 'roles') return <RolesPage />;
  if (slug === 'access-reviews') return <AccessReviewsPage />;
  return <OrganizationPage />;
}

// Real backend UserRole enum values (packages/shared/src/enums/index.ts) — the
// `role` field on CreateUserDto is validated server-side with @IsEnum(UserRole),
// so these values must match exactly (not the frontend-only ProposedUserRole labels).
const USER_ROLE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'employee', label: 'Employee' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'it_personnel', label: 'IT Personnel' },
  { value: 'system_admin', label: 'System Administrator' },
  { value: 'management', label: 'Management' },
  { value: 'property_custodian', label: 'Property Custodian' },
  { value: 'property_officer', label: 'Property Officer' },
];

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [toast, setToast] = useState('');

  const fetchUsers = (q?: string) => {
    usersApi.list(1, 50, q)
      .then((res) => setUsers(res.data.data))
      .catch(() => setToast('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setLoading(true);
    fetchUsers(value || undefined);
  };

  const selected = users.find((user) => user.id === selectedId);
  const userName = (user: User) => `${user.firstName} ${user.lastName}`;

  const handleDeactivate = async (id: string, name: string) => {
    try {
      await usersApi.deactivate(id);
      setUsers((current) => current.map((user) => user.id === id ? { ...user, isActive: false } : user));
      setToast(`${name} account deactivated.`);
    } catch {
      setToast(`Failed to deactivate ${name}.`);
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    try {
      await usersApi.activate(id);
      fetchUsers(search || undefined);
      setToast(`${name} reactivated.`);
    } catch {
      setToast(`Failed to reactivate ${name}.`);
    }
  };

  return <div className="space-y-4">
    <AdminPageHeader title="Users & Accounts" detail="Manage the identity data required for AIMRS access and account lifecycle." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>Create account</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Total accounts" value={String(users.length)} detail="" tone="blue" icon={Users} />
      <MetricCard label="Active" value={String(users.filter((user) => user.isActive).length)} detail="" tone="green" icon={UserCheck} />
      <MetricCard label="Inactive" value={String(users.filter((user) => !user.isActive).length)} detail="" tone="red" icon={ShieldCheck} />
    </div>
    <SearchToolbar value={search} onChange={handleSearchChange} />
    <Panel title="Account Directory" detail={`${users.length} accounts shown - deactivation preserves audit history`}>
      {loading ? <div className="p-6"><LoadingSkeleton rows={5} /></div> : <TableWrap><table className="min-w-[900px] w-full"><thead><tr><th className={thClass}>User</th><th className={thClass}>Office</th><th className={thClass}>Role</th><th className={thClass}>Status</th><th className={`${thClass} text-right`}>Actions</th></tr></thead><tbody>{users.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No accounts found.</td></tr> : users.map((user) => <tr key={user.id} className="hover:bg-slate-50"><td className={tdClass}><button type="button" onClick={() => setSelectedId(user.id)} className="text-left"><span className="block font-bold text-slate-950">{userName(user)}</span><span className="text-xs text-slate-500">{user.employeeId} - {user.email}</span></button></td><td className={tdClass}>{user.division} / {user.officeOrSection}</td><td className={tdClass}>{user.role}</td><td className={tdClass}><StatusChip status={user.isActive ? 'Active' : 'Inactive'} tone={user.isActive ? 'green' : 'red'} /></td><td className={`${tdClass} text-right`}><ActionMenu actions={[{ label: 'View account', onClick: () => setSelectedId(user.id) }, { label: 'Reset password', onClick: () => setResetTarget(user) }, user.isActive ? { label: 'Deactivate account', danger: true, onClick: () => handleDeactivate(user.id, userName(user)) } : { label: 'Reactivate account', onClick: () => handleReactivate(user.id, userName(user)) }]} /></td></tr>)}</tbody></table></TableWrap>}
    </Panel>
    <DetailDrawer open={Boolean(selected)} title={selected ? userName(selected) : 'Account details'} onClose={() => setSelectedId(null)}>{selected && <div className="space-y-5"><div className="grid grid-cols-2 gap-3">{[['Employee ID', selected.employeeId], ['Account ID', selected.id], ['Email', selected.email], ['Role', selected.role], ['Division', selected.division], ['Office / Section', selected.officeOrSection]].map(([label, value]) => <div key={label} className="border border-slate-200 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>)}</div><Panel title="Account status"><div className="space-y-3 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-600">Status</span><StatusChip status={selected.isActive ? 'Active' : 'Inactive'} tone={selected.isActive ? 'green' : 'red'} /></div></div></Panel>{selected.role === 'supervisor' && <ApprovalRoutingPanel key={selected.id} user={selected} onSaved={(u) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))} />}<div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => setResetTarget(selected)}>Reset password</SecondaryButton>{selected.isActive ? <SecondaryButton onClick={() => handleDeactivate(selected.id, userName(selected))}>Deactivate account</SecondaryButton> : <SecondaryButton onClick={() => handleReactivate(selected.id, userName(selected))}>Reactivate account</SecondaryButton>}</div><p className="text-xs text-slate-500">Actions call the live users API and create append-only audit events.</p></div>}</DetailDrawer>
    <DetailDrawer open={creating} title="Create account" onClose={() => setCreating(false)}><AccountForm onSave={(user) => { setUsers((current) => [user, ...current]); setCreating(false); setToast(`${userName(user)} was added to the account directory.`); }} /></DetailDrawer>
    <PasswordResetDialog key={resetTarget?.id ?? 'none'} user={resetTarget} onClose={() => setResetTarget(null)} onDone={(name) => setToast(`Password reset for ${name}. They have been signed out of all sessions.`)} />
    <Toast message={toast} />
  </div>;
}

// Password complexity rules — mirror of ResetPasswordDto in
// Backend/src/users/dto/user.dto.ts. Kept in sync manually; the server is the
// real gate and its rejection message is surfaced verbatim on failure.
const PASSWORD_RULES: ReadonlyArray<{ label: string; test: (v: string) => boolean }> = [
  { label: 'At least 12 characters', test: (v) => v.length >= 12 },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A number', test: (v) => /\d/.test(v) },
  { label: 'A special character', test: (v) => /[@$!%*?&#^()\-_=+]/.test(v) },
];

function PasswordResetDialog({ user, onClose, onDone }: Readonly<{ user: User | null; onClose: () => void; onDone: (name: string) => void }>) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const name = `${user.firstName} ${user.lastName}`;
  const checks = PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(value) }));
  const valid = checks.every((check) => check.ok);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await usersApi.resetPassword(user.id, value);
      onDone(name);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-950">Reset password</h2>
        <p className="mt-1 text-sm text-slate-600">
          Set a new password for <span className="font-semibold">{name}</span>. They will be signed out of every session and must sign in with the new password.
        </p>
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div>
            <label htmlFor="reset-password" className="mb-1 block text-xs font-bold text-slate-600">New password</label>
            <div className="flex gap-2">
              <input
                id="reset-password"
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoComplete="new-password"
                autoFocus
                className={inputClass}
              />
              <button type="button" onClick={() => setShow((current) => !current)} className="rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <ul className="space-y-1 text-xs">
            {checks.map((check) => (
              <li key={check.label} className={check.ok ? 'text-green-700' : 'text-slate-500'}>
                <span aria-hidden="true">{check.ok ? '✓' : '○'}</span> {check.label}
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={!valid || submitting} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AccountForm({ onSave }: Readonly<{ onSave: (user: User) => void }>) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const dto: CreateUserDto = {
      email: String(data.get('email')),
      password: String(data.get('password')),
      firstName: String(data.get('firstName')),
      lastName: String(data.get('lastName')),
      employeeId: String(data.get('employeeId')),
      role: String(data.get('role')),
      division: String(data.get('division')),
      officeOrSection: String(data.get('officeOrSection')),
    };
    try {
      const res = await usersApi.create(dto);
      onSave(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to create account.'));
    } finally {
      setSubmitting(false);
    }
  }}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><input name="firstName" required minLength={1} className={inputClass} /></Field><Field label="Last name"><input name="lastName" required minLength={1} className={inputClass} /></Field></div>
    <Field label="Employee ID"><input name="employeeId" required className={inputClass} placeholder="CICC-0000" /></Field>
    <Field label="Government email"><input name="email" required type="email" pattern=".+@cicc\.gov\.ph" title="Use a cicc.gov.ph email address" className={inputClass} placeholder="name@cicc.gov.ph" /></Field>
    <Field label="Temporary password"><input name="password" required type="password" minLength={12} className={inputClass} /><p className="mt-1 text-xs text-slate-500">Minimum 12 characters, including uppercase, lowercase, number, and special character.</p></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Division"><input name="division" required className={inputClass} /></Field><Field label="Office / Section"><input name="officeOrSection" required className={inputClass} /></Field></div>
    <Field label="Role"><select name="role" className={inputClass}>{USER_ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field>
    <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Only identity information required for AIMRS access is collected. HR, payroll, leave, and performance data are outside system scope.</div>
    {error && <div className="text-sm text-red-700">{error}</div>}
    <PrimaryButton type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create account'}</PrimaryButton>
  </form>;
}

// Approval routing for a supervisor account: which colleague covers their queue
// (alternate approver) and whether they are currently marked away. Rendered inside
// the user DetailDrawer, keyed by user id so it re-mounts per selected account.
function ApprovalRoutingPanel({ user, onSaved }: Readonly<{ user: User; onSaved?: (u: User) => void }>) {
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [altId, setAltId] = useState<string>(user.alternateApproverId ?? '');
  const [unavailable, setUnavailable] = useState<boolean>(user.unavailable);
  const [until, setUntil] = useState<string>(user.unavailableUntil ? user.unavailableUntil.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Initial server values, normalised to the shape usersApi.update expects, so
  // save() can PATCH only the fields the admin actually changed. Sending the
  // whole snapshot would let a stale `unavailable: false` silently un-mark a
  // supervisor who marked themselves away after this drawer had loaded.
  const initialAltId = user.alternateApproverId ?? '';
  const { unavailable: initialUnavailable, unavailableUntil: initialUntil } = buildAvailabilityPayload({
    unavailable: user.unavailable,
    until: user.unavailableUntil ? user.unavailableUntil.slice(0, 10) : '',
  });

  useEffect(() => {
    usersApi.list(1, 200, undefined, 'supervisor')
      .then((r) => {
        const list = r.data.data;
        setSupervisors(list);
        // The designated alternate may have been deactivated since it was set —
        // it would then be absent from the <select>. Don't keep a dangling id in
        // state (a save would re-send it); fall back to "none".
        const stillValid = alternateApproverOptions(list, user.id).some((o) => o.value === user.alternateApproverId);
        if (user.alternateApproverId && !stillValid) setAltId('');
      })
      .catch(() => setSupervisors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; the panel is keyed by user.id so `user` is stable for its lifetime
  }, []);

  const options = alternateApproverOptions(supervisors, user.id);

  async function save() {
    setMsg(null); setErr(null); setSaving(true);
    try {
      const next = buildAvailabilityPayload({ unavailable, until });
      const patch: UpdateUserDto = {};
      if (altId !== initialAltId) patch.alternateApproverId = altId === '' ? null : altId;
      if (next.unavailable !== initialUnavailable) patch.unavailable = next.unavailable;
      if (next.unavailableUntil !== initialUntil) patch.unavailableUntil = next.unavailableUntil;

      if (Object.keys(patch).length === 0) {
        setMsg('No changes to save.');
        return;
      }

      const res = await usersApi.update(user.id, patch);
      onSaved?.(res.data);
      setMsg('Approval routing saved.');
    } catch {
      setErr('Could not save approval routing.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Approval routing">
      <div className="space-y-4 p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-slate-600">Alternate approver</span>
          <select className={inputClass} value={altId} onChange={(e) => setAltId(e.target.value)}>
            <option value="">— none —</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unavailable} onChange={(e) => setUnavailable(e.target.checked)} />
          <span className="font-bold text-slate-600">Currently unavailable</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-slate-600">Unavailable until (optional)</span>
          <input type="date" className={inputClass} value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <SecondaryButton onClick={save} disabled={saving}>Save approval routing</SecondaryButton>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </div>
    </Panel>
  );
}

function RolesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [pendingRoleById, setPendingRoleById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    usersApi.list(1, 100)
      .then((res) => setUsers(res.data.data))
      .catch(() => setToast('Failed to load users.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase()),
  );

  const saveRole = async (user: User) => {
    const newRole = pendingRoleById[user.id];
    if (!newRole || newRole === user.role) return;
    setSavingId(user.id);
    try {
      const res = await usersApi.updateRole(user.id, newRole);
      setUsers((current) => current.map((u) => (u.id === user.id ? res.data : u)));
      setToast(`${user.firstName} ${user.lastName}'s role updated to ${newRole.replace(/_/g, ' ')}.`);
    } catch {
      setToast(`Failed to update ${user.firstName} ${user.lastName}'s role.`);
    } finally {
      setSavingId(null);
    }
  };

  return <div className="space-y-4">
    <AdminPageHeader title="Roles & Assignment" detail="Assign one of the system's fixed roles to a user. Roles and their permissions are defined in code, not configurable here." />
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All users" />
    <Panel title="User Role Assignment" detail={`${rows.length} accounts shown`}>
      {loading ? <div className="p-6"><LoadingSkeleton rows={5} /></div> : <TableWrap><table className="w-full"><thead><tr>
        <th className={thClass}>User</th><th className={thClass}>Current role</th><th className={thClass}>New role</th><th className={`${thClass} text-right`}>Action</th>
      </tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">No accounts found.</td></tr> : rows.map((user) => <tr key={user.id}>
        <td className={tdClass}>{user.firstName} {user.lastName}<span className="block text-xs text-slate-500">{user.employeeId}</span></td>
        <td className={tdClass}>{user.role.replace(/_/g, ' ')}</td>
        <td className={tdClass}>
          <select
            className={inputClass}
            defaultValue={user.role}
            onChange={(e) => setPendingRoleById((current) => ({ ...current, [user.id]: e.target.value }))}
          >
            {USER_ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </td>
        <td className={`${tdClass} text-right`}><SecondaryButton onClick={() => saveRole(user)}>{savingId === user.id ? 'Saving…' : 'Save'}</SecondaryButton></td>
      </tr>)}</tbody></table></TableWrap>}
    </Panel>
    <Toast message={toast} />
  </div>;
}

function AccessReviewsPage() {
  const [reviews, setReviews] = useState(accessReviews);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  return <div className="space-y-4"><AdminPageHeader title="Access Reviews" detail="Certify privileged, dormant, and custodian access on a recurring schedule while preserving reviewer evidence." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>Start review</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Open reviews" value="2" detail="32 accounts in scope" tone="amber" icon={UserCheck} /><MetricCard label="At risk" value="1" detail="Due within two days" tone="red" icon={ShieldCheck} /><MetricCard label="Certified this quarter" value="8" detail="No unresolved exceptions" tone="green" icon={Users} /></div>
    <Panel title="Certification Campaigns" detail="Reviewers retain, revoke, or modify access with a recorded justification"><div className="divide-y divide-slate-100">{reviews.map((review) => <article key={review.id} className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><p className="font-bold text-slate-950">{review.name}</p><p className="mt-1 text-xs text-slate-500">{review.id} - {review.scope}</p></div><div><p className="text-xs text-slate-500">Owner</p><p className="text-sm font-semibold">{review.owner}</p></div><div><div className="flex justify-between text-xs"><span>{review.progress}% complete</span><span>Due {review.due}</span></div><div className="mt-2 h-2 bg-slate-100"><div className={`h-full ${review.status === 'At risk' ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${review.progress}%` }} /></div></div><div className="flex items-center justify-between gap-3 lg:justify-end"><StatusChip status={review.status} /><SecondaryButton onClick={() => { setReviews((current) => current.map((item) => item.id === review.id ? { ...item, progress: Math.min(100, item.progress + 10), status: item.progress >= 90 ? 'Completed' : 'In progress' } : item)); setToast(`${review.name} certification progress was updated in frontend mock state.`); }}>Review</SecondaryButton></div></article>)}</div></Panel>
    <DetailDrawer open={creating} title="Start access review" onClose={() => setCreating(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const review = { id: `REV-2026-${String(reviews.length + 1).padStart(2, '0')}`, name: String(data.get('name')), owner: String(data.get('owner')), scope: String(data.get('scope')), due: String(data.get('due')), progress: 0, status: 'In progress' }; setReviews((current) => [review, ...current]); setCreating(false); setToast(`${review.name} was started in frontend mock state.`); }}><Field label="Campaign name"><input name="name" required className={inputClass} /></Field><Field label="Accounts or roles in scope"><input name="scope" required className={inputClass} placeholder="Example: All privileged accounts" /></Field><Field label="Review owner"><input name="owner" required className={inputClass} /></Field><Field label="Due date"><input name="due" required type="date" className={inputClass} /></Field><PrimaryButton type="submit">Start certification</PrimaryButton></form></DetailDrawer><Toast message={toast} /></div>;
}

function OrganizationPage() {
  const [units, setUnits] = useState(organizationUnits);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<(typeof organizationUnits)[number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const rows = units.filter((unit) => (filter === 'All' || unit.type === filter || unit.status === filter) && Object.values(unit).join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4"><AdminPageHeader title="Organization Structure" detail="Maintain CICC offices, divisions, sections, and reporting relationships used for access scope, approvals, and custody." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>Add unit</PrimaryButton>} />
    <div className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><Panel title="Hierarchy" detail="Reporting structure"><div className="p-3"><div className="border-l-2 border-blue-200 pl-3"><p className="py-2 text-sm font-bold text-slate-950">CICC</p>{units.filter((unit) => unit.parent === 'CICC').map((unit) => <div key={unit.id} className="border-l border-slate-200 pl-3"><button type="button" onClick={() => setSelected(unit)} className="w-full py-2 text-left text-sm font-semibold text-slate-700 hover:text-blue-700">{unit.name}</button>{units.filter((child) => child.parent === unit.name).map((child) => <button key={child.id} type="button" onClick={() => setSelected(child)} className="block w-full border-l border-slate-200 py-2 pl-3 text-left text-xs text-slate-600 hover:text-blue-700">{child.name}</button>)}</div>)}</div></div></Panel><div className="min-w-0 space-y-4"><SearchToolbar value={search} onChange={setSearch} filterLabel="All unit types" filterValue={filter} filterOptions={['All', 'Agency', 'Division', 'Service', 'Section', 'Unit', 'Active']} onFilterChange={setFilter} /><Panel title="Organizational Units" detail={`${rows.length} hierarchy records`}><TableWrap><table className="min-w-[1050px] w-full"><thead><tr><th className={thClass}>Unit</th><th className={thClass}>Type</th><th className={thClass}>Parent</th><th className={thClass}>Unit head</th><th className={thClass}>Users</th><th className={thClass}>Custodian</th><th className={thClass}>Status</th><th className={`${thClass} text-right`}>Actions</th></tr></thead><tbody>{rows.map((unit) => <tr key={unit.id} className="hover:bg-slate-50"><td className={tdClass}><button type="button" onClick={() => setSelected(unit)} className="text-left font-bold text-slate-950">{unit.name}<span className="block text-xs font-normal text-slate-500">{unit.code}</span></button></td><td className={tdClass}>{unit.type}</td><td className={tdClass}>{unit.parent}</td><td className={tdClass}>{unit.head}</td><td className={tdClass}>{unit.users}</td><td className={tdClass}>{unit.custodian}</td><td className={tdClass}><StatusChip status={unit.status} /></td><td className={`${tdClass} text-right`}><ActionMenu actions={[{ label: 'View unit', onClick: () => setSelected(unit) }, { label: 'Mark inactive', onClick: () => { setUnits((current) => current.map((item) => item.id === unit.id ? { ...item, status: 'Inactive' } : item)); setToast(`${unit.name} marked inactive in mock state.`); } }, { label: 'Review dependencies', onClick: () => setToast(`${unit.users} user dependencies and related workflow links found.`) }]} /></td></tr>)}</tbody></table></TableWrap></Panel></div></div>
    <DetailDrawer open={Boolean(selected)} title={selected?.name ?? 'Organizational unit'} onClose={() => setSelected(null)}>{selected && <div className="space-y-4">{[['Unit code', selected.code], ['Type', selected.type], ['Parent', selected.parent], ['Unit head', selected.head], ['Assigned users', String(selected.users)], ['Custodian coverage', selected.custodian]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-semibold">{value}</span></div>)}<div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Before deactivation, AIMRS checks users, assets, approval workflows, and custodian assignments that depend on this unit.</div><SecondaryButton onClick={() => setToast(`${selected.users} user dependencies checked; no destructive action was performed.`)}>Review dependencies</SecondaryButton></div>}</DetailDrawer>
    <DetailDrawer open={creating} title="Add organizational unit" onClose={() => setCreating(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const unit = { id: `OU-${String(units.length + 1).padStart(3, '0')}`, code: String(data.get('code')), name: String(data.get('name')), type: String(data.get('type')), parent: String(data.get('parent')), head: String(data.get('head')), users: 0, custodian: 'Unassigned', status: 'Active' }; setUnits((current) => [...current, unit]); setCreating(false); setToast(`${unit.name} was added to the organization hierarchy in frontend mock state.`); }}><div className="grid gap-4 sm:grid-cols-2"><Field label="Unit code"><input name="code" required className={inputClass} placeholder="AS-UNIT" /></Field><Field label="Unit type"><select name="type" className={inputClass}><option>Division</option><option>Service</option><option>Section</option><option>Unit</option></select></Field></div><Field label="Unit name"><input name="name" required className={inputClass} /></Field><Field label="Parent unit"><select name="parent" className={inputClass}>{units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}</select></Field><Field label="Unit head"><input name="head" required className={inputClass} /></Field><PrimaryButton type="submit">Add unit</PrimaryButton></form></DetailDrawer><Toast message={toast} /></div>;
}
