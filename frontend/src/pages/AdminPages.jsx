import { useEffect, useState } from 'react';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, Field, Loading, PageTitle, Table, fmtDate, peso, useAction } from '../components/ui';

function Bars({ title, counts }) {
  const entries = Object.entries(counts || {});
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="card">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {entries.length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
      {entries.map(([k, n]) => (
        <div key={k} className="mb-1.5">
          <div className="flex justify-between text-xs"><span>{k}</span><span>{n}</span></div>
          <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-500" style={{ width: `${(n / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const { data, loading, error } = useFetch('/admin/reports/summary');
  return (
    <>
      <PageTitle title="Reports & Analytics" />
      <Loading loading={loading} error={error} />
      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="card"><div className="text-xs text-slate-500">Registered students</div><div className="text-2xl font-semibold">{data.students}</div></div>
            <div className="card"><div className="text-xs text-slate-500">Total collected</div><div className="text-2xl font-semibold">{peso(data.totalCollected)}</div></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Bars title="Enrollments by status" counts={data.enrollments} />
            <Bars title="Document requests by status" counts={data.documents} />
            <Bars title="Clearance items by status" counts={data.clearance} />
          </div>
        </>
      )}
    </>
  );
}

export function AdminUsers() {
  const { data, loading, error, reload } = useFetch('/admin/users', []);
  const { msg, run } = useAction();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'registrar', department: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const create = async (e) => {
    e.preventDefault();
    const body = { ...form, department: form.role === 'dept_staff' ? form.department : undefined };
    if (await run(() => api.post('/admin/users', body), 'User created.')) { setForm({ fullName: '', email: '', password: '', role: 'registrar', department: '' }); reload(); }
  };
  const patch = async (id, body) => { if (await run(() => api.patch(`/admin/users/${id}`, body), 'User updated.')) reload(); };
  const roles = ['registrar', 'cashier', 'dept_staff', 'instructor', 'admin'];
  return (
    <>
      <PageTitle title="User & Role Management" />
      <Alert type={msg.type}>{msg.text}</Alert>
      <form onSubmit={create} className="card mb-4 grid gap-3 sm:grid-cols-3">
        <h2 className="font-medium sm:col-span-3">Create staff account</h2>
        <Field label="Full name"><input className="input" required value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Temporary password"><input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} /></Field>
        <Field label="Role"><select className="input" value={form.role} onChange={set('role')}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
        {form.role === 'dept_staff' && <Field label="Department"><input className="input" required placeholder="Library" value={form.department} onChange={set('department')} /></Field>}
        <div className="self-end"><button className="btn" type="submit">Create user</button></div>
      </form>
      <Loading loading={loading} error={error} />
      <Table rows={data} columns={[
        { header: 'Name', render: (u) => u.fullName }, { header: 'Email', render: (u) => u.email },
        { header: 'Role', render: (u) => <>{u.role}{u.department ? ` (${u.department})` : ''}</> },
        { header: 'Active', render: (u) => (u.active ? 'Yes' : 'No') },
        { header: 'Actions', render: (u) => (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? 'Deactivate' : 'Activate'}</button>
            <select className="input w-32" value={u.role} aria-label={`Role for ${u.fullName}`} onChange={(e) => patch(u.id, { role: e.target.value })}>
              {['student', ...roles].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        ) },
      ]} />
    </>
  );
}

export function AdminSettings() {
  const { data, loading, error } = useFetch('/admin/settings');
  const { msg, run } = useAction();
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? String(e.target.checked) : e.target.value });
  const save = async (e) => { e.preventDefault(); await run(async () => setForm((await api.put('/admin/settings', form)).data), 'Settings saved.'); };
  return (
    <>
      <PageTitle title="System Settings" subtitle="Changing the term affects which sections students see and where new sections are created." />
      <Loading loading={loading} error={error} />
      {form && (
        <form onSubmit={save} className="card grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Alert type={msg.type}>{msg.text}</Alert></div>
          <Field label="School year"><input className="input" pattern="\d{4}-\d{4}" value={form.schoolYear} onChange={set('schoolYear')} /></Field>
          <Field label="Semester"><select className="input" value={form.semester} onChange={set('semester')}>{['1st', '2nd', 'Summer'].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Tuition per unit (₱)"><input className="input" type="number" min="0" value={form.feePerUnit} onChange={set('feePerUnit')} /></Field>
          <Field label="Miscellaneous fee (₱)"><input className="input" type="number" min="0" value={form.miscFee} onChange={set('miscFee')} /></Field>
          <div className="sm:col-span-2"><Field label="Clearance departments (comma-separated)"><input className="input" value={form.clearanceDepartments} onChange={set('clearanceDepartments')} /></Field></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.enrollmentOpen === 'true'} onChange={set('enrollmentOpen')} /> Enrollment is open</label>
          <div className="sm:col-span-2"><button className="btn" type="submit">Save settings</button></div>
        </form>
      )}
    </>
  );
}

export function AdminAudit() {
  const { data, loading, error } = useFetch('/admin/audit-logs?limit=200', []);
  return (
    <>
      <PageTitle title="Audit Logs" subtitle="Most recent 200 actions." />
      <Loading loading={loading} error={error} />
      <Table rows={data} columns={[
        { header: 'When', render: (l) => fmtDate(l.createdAt) }, { header: 'User', render: (l) => l.User ? `${l.User.fullName} (${l.User.role})` : '—' },
        { header: 'Action', render: (l) => <Badge value={l.action} /> }, { header: 'Entity', render: (l) => `${l.entity || ''} ${l.entityId || ''}` }, { header: 'IP', render: (l) => l.ip },
      ]} />
    </>
  );
}
