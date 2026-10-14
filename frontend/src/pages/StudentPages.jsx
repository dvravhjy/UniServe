import { useState } from 'react';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, Field, Loading, PageTitle, Table, fmtDate, peso, useAction } from '../components/ui';

export function Enroll() {
  const sections = useFetch('/student/sections', []);
  const enrollments = useFetch('/student/enrollment', []);
  const { msg, run } = useAction();
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const units = (sections.data || []).filter((s) => picked.includes(s.id)).reduce((n, s) => n + s.Subject.units, 0);
  const current = (enrollments.data || [])[0];
  const locked = current && current.status !== 'Rejected';

  const submit = async () => {
    const ok = await run(() => api.post('/student/enrollment', { sectionIds: picked }), 'Enrollment submitted. The registrar will validate it.');
    if (ok) { setPicked([]); enrollments.reload(); sections.reload(); }
  };

  return (
    <>
      <PageTitle title="Online Enrollment" subtitle="Pick your subjects for this term. No queue needed." />
      <Alert type={msg.type}>{msg.text}</Alert>
      {current && (
        <div className="card mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Enrollment status for {current.schoolYear}, {current.semester} semester</div>
            <div className="mt-1"><Badge value={current.status} /></div>
            {current.remarks && <div className="mt-1 text-sm text-slate-600">Remarks: {current.remarks}</div>}
          </div>
          <div className="text-right text-sm text-slate-500">{current.items?.length || 0} subject(s)</div>
        </div>
      )}
      {locked ? (
        <p className="text-sm text-slate-600">You already have an enrollment for this term. Check your Schedule once it is validated.</p>
      ) : (
        <>
          <Loading loading={sections.loading} error={sections.error} />
          <Table
            rows={sections.data}
            columns={[
              { header: '', render: (s) => <input type="checkbox" aria-label={`Select ${s.name}`} disabled={s.enrolled >= s.capacity} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} /> },
              { header: 'Subject', render: (s) => <><div className="font-medium">{s.Subject.code}</div><div className="text-slate-500">{s.Subject.title}</div></> },
              { header: 'Section', render: (s) => s.name },
              { header: 'Schedule', render: (s) => <>{s.schedule}<div className="text-slate-500">{s.room}</div></> },
              { header: 'Units', render: (s) => s.Subject.units },
              { header: 'Slots', render: (s) => `${s.enrolled}/${s.capacity}` },
            ]}
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-slate-600">{picked.length} selected · {units} units</span>
            <button className="btn" disabled={!picked.length} onClick={submit}>Submit enrollment</button>
          </div>
        </>
      )}
    </>
  );
}

export function Schedule() {
  const { data, loading, error } = useFetch('/student/schedule', []);
  return (
    <>
      <PageTitle title="My Schedule" subtitle="Shown after the registrar validates your enrollment." />
      <Loading loading={loading} error={error} />
      <Table rows={data} empty="No validated enrollment yet." columns={[
        { header: 'Code', render: (r) => r.code }, { header: 'Subject', render: (r) => r.title },
        { header: 'Section', render: (r) => r.section }, { header: 'Schedule', render: (r) => r.schedule },
        { header: 'Room', render: (r) => r.room }, { header: 'Units', render: (r) => r.units },
      ]} />
    </>
  );
}

export function Grades() {
  const { data, loading, error } = useFetch('/student/grades', []);
  return (
    <>
      <PageTitle title="My Grades" subtitle="Only grades released by the registrar are shown." />
      <Loading loading={loading} error={error} />
      <Table rows={data} empty="No released grades yet." columns={[
        { header: 'Term', render: (r) => `${r.schoolYear} · ${r.semester}` }, { header: 'Code', render: (r) => r.code },
        { header: 'Subject', render: (r) => r.title }, { header: 'Units', render: (r) => r.units },
        { header: 'Grade', render: (r) => <span className="font-semibold">{r.grade.toFixed(2)}</span> }, { header: 'Remarks', render: (r) => r.remarks },
      ]} />
    </>
  );
}

export function Clearance() {
  const { data, loading, error } = useFetch('/student/clearance');
  return (
    <>
      <PageTitle title="Clearance Status" subtitle="Each department must clear you before you can be fully cleared." />
      <Loading loading={loading} error={error} />
      {data && (
        <>
          <Alert type={data.fullyCleared ? 'success' : 'info'}>{data.fullyCleared ? 'You are fully cleared for this term.' : 'You still have departments that have not cleared you.'}</Alert>
          <Table rows={data.items} columns={[
            { header: 'Department', render: (r) => r.department }, { header: 'Status', render: (r) => <Badge value={r.status} /> },
            { header: 'Remarks', render: (r) => r.remarks || '—' }, { header: 'Updated', render: (r) => fmtDate(r.updatedAt) },
          ]} />
        </>
      )}
    </>
  );
}

export function Documents() {
  const types = useFetch('/documents/types', []);
  const docs = useFetch('/documents', []);
  const { msg, run } = useAction();
  const [form, setForm] = useState({ type: '', purpose: '', copies: 1 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.post('/documents', { ...form, copies: Number(form.copies) }), 'Request submitted.');
    if (ok) { setForm({ type: '', purpose: '', copies: 1 }); docs.reload(); }
  };
  const download = async (id) => {
    const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
    window.open(URL.createObjectURL(new Blob([res.data], { type: 'text/html' })), '_blank');
  };
  const steps = ['Submitted', 'Payment Pending', 'Paid', 'Processing', 'Ready', 'Released'];
  return (
    <>
      <PageTitle title="Document Requests" subtitle="Request, pay, and track your documents online." />
      <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4"><Alert type={msg.type}>{msg.text}</Alert></div>
        <Field label="Document">
          <select className="input" required value={form.type} onChange={set('type')}>
            <option value="">Select…</option>
            {(types.data || []).map((t) => <option key={t.type} value={t.type}>{t.type} ({peso(t.fee)})</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Purpose"><input className="input" required minLength={3} value={form.purpose} onChange={set('purpose')} /></Field></div>
        <Field label="Copies"><input className="input" type="number" min="1" max="5" value={form.copies} onChange={set('copies')} /></Field>
        <div className="sm:col-span-4"><button className="btn" type="submit">Submit request</button></div>
      </form>
      <Loading loading={docs.loading} error={docs.error} />
      <Table rows={docs.data} empty="You have no requests yet." columns={[
        { header: '#', render: (d) => d.id }, { header: 'Document', render: (d) => <>{d.type}<div className="text-slate-500">{d.copies} copy/copies · {d.purpose}</div></> },
        { header: 'Fee', render: (d) => peso(d.fee) },
        { header: 'Status', render: (d) => <><Badge value={d.status} /><div className="mt-1 text-xs text-slate-400">Step {steps.indexOf(d.status) + 1} of {steps.length}</div></> },
        { header: 'Updated', render: (d) => fmtDate(d.updatedAt) },
        { header: '', render: (d) => ['Ready', 'Released'].includes(d.status) && <button className="btn" onClick={() => download(d.id)}>Download</button> },
      ]} />
      <p className="mt-3 text-xs text-slate-500">After “Payment Pending”, pay at the cashier. When the status is “Ready”, download your document here (print or save as PDF) or claim the original at the registrar.</p>
    </>
  );
}

export function Balance() {
  const { data, loading, error } = useFetch('/student/balance');
  return (
    <>
      <PageTitle title="Balance & Payments" />
      <Loading loading={loading} error={error} />
      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[['Total charges', data.total], ['Paid', data.paid], ['Balance', data.balance]].map(([l, v]) => (
              <div key={l} className="card"><div className="text-xs text-slate-500">{l}</div><div className="text-lg font-semibold">{peso(v)}</div></div>
            ))}
          </div>
          <Table rows={data.charges} columns={[
            { header: 'Description', render: (c) => c.description }, { header: 'Amount', render: (c) => peso(c.amount) },
            { header: 'Paid', render: (c) => peso(c.paid) }, { header: 'Status', render: (c) => <Badge value={c.status} /> },
            { header: 'Receipts', render: (c) => (c.Payments || []).map((p) => p.receiptNo).join(', ') || '—' },
          ]} />
        </>
      )}
    </>
  );
}

export function Profile() {
  const { data, loading, error, reload } = useFetch('/student/profile');
  const { msg, run } = useAction();
  const [form, setForm] = useState(null);
  const f = form || { phone: data?.student?.phone || '', address: data?.student?.address || '' };
  const save = async (e) => { e.preventDefault(); if (await run(() => api.put('/student/profile', f), 'Profile updated.')) reload(); };
  return (
    <>
      <PageTitle title="My Profile" />
      <Loading loading={loading} error={error} />
      {data && (
        <form onSubmit={save} className="card grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Alert type={msg.type}>{msg.text}</Alert></div>
          <div><div className="label">Name</div>{data.user.fullName}</div>
          <div><div className="label">Email</div>{data.user.email}</div>
          <div><div className="label">Student number</div>{data.student.studentNo}</div>
          <div><div className="label">Program / Year</div>{data.student.program} · Year {data.student.yearLevel}</div>
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setForm({ ...f, phone: e.target.value })} /></Field>
          <Field label="Address"><input className="input" value={f.address} onChange={(e) => setForm({ ...f, address: e.target.value })} /></Field>
          <div className="sm:col-span-2"><button className="btn" type="submit">Save</button></div>
        </form>
      )}
    </>
  );
}
