import { useState } from 'react';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, Field, Loading, PageTitle, Table, fmtDate, peso, useAction } from '../components/ui';

/* ---------------- Registrar ---------------- */
export function RegistrarEnrollments() {
  const { data, loading, error, reload } = useFetch('/registrar/enrollments?status=Submitted', []);
  const { msg, run } = useAction();
  const decide = async (id, approve) => {
    const remarks = approve ? undefined : window.prompt('Reason for rejection?') || 'Please resubmit';
    if (await run(() => api.patch(`/registrar/enrollments/${id}`, { approve, remarks }), approve ? 'Enrollment validated.' : 'Enrollment rejected.')) reload();
  };
  return (
    <>
      <PageTitle title="Enrollment Validation" subtitle="Submitted enrollments waiting for review." />
      <Alert type={msg.type}>{msg.text}</Alert>
      <Loading loading={loading} error={error} />
      <Table rows={data} empty="No enrollments waiting." columns={[
        { header: 'Student', render: (e) => <>{e.Student.User.fullName}<div className="text-slate-500">{e.Student.studentNo} · {e.Student.program}</div></> },
        { header: 'Term', render: (e) => `${e.schoolYear} · ${e.semester}` },
        { header: 'Subjects', render: (e) => e.items.map((i) => <div key={i.id}>{i.Section.Subject.code} ({i.Section.name})</div>) },
        { header: 'Action', render: (e) => (
          <div className="flex gap-2"><button className="btn" onClick={() => decide(e.id, true)}>Validate</button><button className="btn-danger" onClick={() => decide(e.id, false)}>Reject</button></div>
        ) },
      ]} />
    </>
  );
}

export function RegistrarSubjects() {
  const subjects = useFetch('/registrar/subjects', []);
  const sections = useFetch('/registrar/sections', []);
  const { msg, run } = useAction();
  const [sub, setSub] = useState({ code: '', title: '', units: 3 });
  const [sec, setSec] = useState({ subjectId: '', name: '', schedule: '', room: '', capacity: 40 });

  const addSubject = async (e) => { e.preventDefault(); if (await run(() => api.post('/registrar/subjects', { ...sub, units: Number(sub.units) }), 'Subject added.')) { setSub({ code: '', title: '', units: 3 }); subjects.reload(); } };
  const addSection = async (e) => { e.preventDefault(); if (await run(() => api.post('/registrar/sections', { ...sec, subjectId: Number(sec.subjectId), capacity: Number(sec.capacity) }), 'Section added for the current term.')) { setSec({ subjectId: '', name: '', schedule: '', room: '', capacity: 40 }); sections.reload(); } };
  const delSection = async (id) => { if (await run(() => api.delete(`/registrar/sections/${id}`), 'Section deleted.')) sections.reload(); };
  const delSubject = async (id) => { if (await run(() => api.delete(`/registrar/subjects/${id}`), 'Subject deleted.')) subjects.reload(); };

  return (
    <>
      <PageTitle title="Subjects, Sections & Schedules" />
      <Alert type={msg.type}>{msg.text}</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addSubject} className="card grid gap-3 sm:grid-cols-3">
          <h2 className="font-medium sm:col-span-3">Add subject</h2>
          <Field label="Code"><input className="input" required value={sub.code} onChange={(e) => setSub({ ...sub, code: e.target.value })} /></Field>
          <Field label="Title"><input className="input" required value={sub.title} onChange={(e) => setSub({ ...sub, title: e.target.value })} /></Field>
          <Field label="Units"><input className="input" type="number" min="1" max="6" value={sub.units} onChange={(e) => setSub({ ...sub, units: e.target.value })} /></Field>
          <div className="sm:col-span-3"><button className="btn" type="submit">Add subject</button></div>
        </form>
        <form onSubmit={addSection} className="card grid gap-3 sm:grid-cols-2">
          <h2 className="font-medium sm:col-span-2">Add section (current term)</h2>
          <Field label="Subject">
            <select className="input" required value={sec.subjectId} onChange={(e) => setSec({ ...sec, subjectId: e.target.value })}>
              <option value="">Select…</option>{(subjects.data || []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </Field>
          <Field label="Section name"><input className="input" required value={sec.name} onChange={(e) => setSec({ ...sec, name: e.target.value })} /></Field>
          <Field label="Schedule"><input className="input" required placeholder="MWF 08:00-09:00" value={sec.schedule} onChange={(e) => setSec({ ...sec, schedule: e.target.value })} /></Field>
          <Field label="Room"><input className="input" value={sec.room} onChange={(e) => setSec({ ...sec, room: e.target.value })} /></Field>
          <Field label="Capacity"><input className="input" type="number" min="1" value={sec.capacity} onChange={(e) => setSec({ ...sec, capacity: e.target.value })} /></Field>
          <div className="self-end"><button className="btn" type="submit">Add section</button></div>
        </form>
      </div>
      <h2 className="mb-2 mt-6 font-medium">Subjects</h2>
      <Table rows={subjects.data} columns={[
        { header: 'Code', render: (s) => s.code }, { header: 'Title', render: (s) => s.title }, { header: 'Units', render: (s) => s.units },
        { header: '', render: (s) => <button className="btn-secondary" onClick={() => delSubject(s.id)}>Delete</button> },
      ]} />
      <h2 className="mb-2 mt-6 font-medium">Sections</h2>
      <Table rows={sections.data} columns={[
        { header: 'Subject', render: (s) => s.Subject.code }, { header: 'Section', render: (s) => s.name },
        { header: 'Term', render: (s) => `${s.schoolYear} · ${s.semester}` }, { header: 'Schedule', render: (s) => `${s.schedule} (${s.room || 'TBA'})` },
        { header: 'Instructor', render: (s) => s.instructor?.fullName || 'TBA' }, { header: 'Cap.', render: (s) => s.capacity },
        { header: '', render: (s) => <button className="btn-secondary" onClick={() => delSection(s.id)}>Delete</button> },
      ]} />
    </>
  );
}

export function RegistrarStudents() {
  const { data, loading, error } = useFetch('/registrar/students', []);
  return (
    <>
      <PageTitle title="Students" />
      <Loading loading={loading} error={error} />
      <Table rows={data} columns={[
        { header: 'Student no.', render: (s) => s.studentNo }, { header: 'Name', render: (s) => s.User.fullName },
        { header: 'Email', render: (s) => s.User.email }, { header: 'Program', render: (s) => `${s.program} · Year ${s.yearLevel}` }, { header: 'Status', render: (s) => s.status },
      ]} />
    </>
  );
}

/* Grade encoding: instructors (own sections) and registrar (release) */
export function GradeEncoding({ canRelease }) {
  const sections = useFetch('/registrar/grades/my-sections', []);
  const [sectionId, setSectionId] = useState('');
  const roster = useFetch(sectionId ? `/registrar/grades/sections/${sectionId}` : null, []);
  const { msg, run } = useAction();
  const [edits, setEdits] = useState({});
  const rows = sectionId ? roster.data || [] : [];

  const save = async () => {
    const grades = Object.entries(edits).filter(([, v]) => v !== '').map(([id, value]) => ({ enrollmentItemId: Number(id), value: Number(value) }));
    if (!grades.length) return;
    if (await run(() => api.put(`/registrar/grades/sections/${sectionId}`, { grades }), 'Grades saved.')) { setEdits({}); roster.reload(); }
  };
  const release = async () => { if (await run(() => api.post(`/registrar/grades/sections/${sectionId}/release`), 'Grades released to students.')) roster.reload(); };

  return (
    <>
      <PageTitle title={canRelease ? 'Grades: Encode & Release' : 'Grade Encoding'} subtitle="Scale: 1.0 (highest) to 5.0 (failed). Released grades are locked." />
      <Alert type={msg.type}>{msg.text}</Alert>
      <div className="mb-4 max-w-sm">
        <Field label="Section">
          <select className="input" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setEdits({}); }}>
            <option value="">Select a section…</option>
            {(sections.data || []).map((s) => <option key={s.id} value={s.id}>{s.Subject.code} · {s.name}</option>)}
          </select>
        </Field>
      </div>
      {sectionId && (
        <>
          <Loading loading={roster.loading} error={roster.error} />
          <Table rows={rows} empty="No validated students in this section yet." columns={[
            { header: 'Student no.', render: (r) => r.studentNo }, { header: 'Name', render: (r) => r.fullName },
            { header: 'Current', render: (r) => (r.grade ?? '—') },
            { header: 'Grade', render: (r) => r.released ? <Badge value="Released" /> : (
              <input className="input w-24" type="number" step="0.25" min="1" max="5" aria-label={`Grade for ${r.fullName}`} value={edits[r.enrollmentItemId] ?? ''} onChange={(e) => setEdits({ ...edits, [r.enrollmentItemId]: e.target.value })} />
            ) },
          ]} />
          <div className="mt-4 flex gap-2">
            <button className="btn" onClick={save}>Save grades</button>
            {canRelease && <button className="btn-secondary" onClick={release}>Release to students</button>}
          </div>
        </>
      )}
    </>
  );
}

/* Document requests (registrar acts, cashier views) */
export function DocumentRequests({ role }) {
  const { data, loading, error, reload } = useFetch('/documents', []);
  const { msg, run } = useAction();
  const assess = async (id) => { if (await run(() => api.post(`/documents/${id}/assess`), 'Fee assessed. Student notified.')) reload(); };
  const move = async (id, status) => { if (await run(() => api.patch(`/documents/${id}/status`, { status }), `Marked ${status}.`)) reload(); };
  const NEXT = { Paid: 'Processing', Processing: 'Ready', Ready: 'Released' };
  return (
    <>
      <PageTitle title="Document Requests" subtitle="Submitted → Payment Pending → Paid → Processing → Ready → Released" />
      <Alert type={msg.type}>{msg.text}</Alert>
      <Loading loading={loading} error={error} />
      <Table rows={data} columns={[
        { header: '#', render: (d) => d.id }, { header: 'Student', render: (d) => <>{d.Student?.User?.fullName}<div className="text-slate-500">{d.Student?.studentNo}</div></> },
        { header: 'Document', render: (d) => `${d.type} ×${d.copies}` }, { header: 'Fee', render: (d) => peso(d.fee) },
        { header: 'Status', render: (d) => <Badge value={d.status} /> },
        { header: 'Action', render: (d) => {
          if (role !== 'registrar') return d.status === 'Payment Pending' ? <span className="text-xs text-slate-500">Awaiting payment</span> : null;
          if (d.status === 'Submitted') return <button className="btn" onClick={() => assess(d.id)}>Assess fee</button>;
          if (NEXT[d.status]) return <button className="btn" onClick={() => move(d.id, NEXT[d.status])}>Mark {NEXT[d.status]}</button>;
          return null;
        } },
      ]} />
    </>
  );
}

/* ---------------- Cashier ---------------- */
export function CashierPayments() {
  const [no, setNo] = useState('');
  const [result, setResult] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const { msg, run } = useAction();
  const lookup = async (e) => {
    e?.preventDefault();
    setReceipt(null);
    await run(async () => setResult((await api.get(`/cashier/students/${encodeURIComponent(no)}/charges`)).data));
  };
  const pay = async (charge, amount, method) => {
    await run(async () => {
      const res = await api.post('/cashier/payments', { chargeId: charge.id, amount: Number(amount), method });
      setReceipt(res.data.receiptNo);
      await lookup();
    });
  };
  return (
    <>
      <PageTitle title="Record Payment" subtitle="Search by student number to assess and collect fees." />
      <form onSubmit={lookup} className="mb-4 flex max-w-md gap-2">
        <input className="input" required placeholder="e.g. 2026-00001" value={no} onChange={(e) => setNo(e.target.value)} aria-label="Student number" />
        <button className="btn" type="submit">Search</button>
      </form>
      <Alert type={msg.type}>{msg.text}</Alert>
      {receipt && <Alert type="success">Payment recorded. Official receipt no.: <strong>{receipt}</strong></Alert>}
      {result && (
        <>
          <div className="card mb-4"><div className="font-medium">{result.student.User.fullName} ({result.student.studentNo})</div>
            <div className="text-sm text-slate-500">Total {peso(result.total)} · Paid {peso(result.paid)} · Balance <strong>{peso(result.balance)}</strong></div></div>
          <Table rows={result.charges} columns={[
            { header: 'Description', render: (c) => c.description }, { header: 'Amount', render: (c) => peso(c.amount) },
            { header: 'Paid', render: (c) => peso(c.paid) }, { header: 'Status', render: (c) => <Badge value={c.status} /> },
            { header: 'Pay', render: (c) => c.status === 'Paid' ? '—' : <PayForm charge={c} onPay={pay} /> },
          ]} />
        </>
      )}
    </>
  );
}

function PayForm({ charge, onPay }) {
  const outstanding = Number(charge.amount) - Number(charge.paid);
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState('Cash');
  return (
    <div className="flex flex-wrap gap-1">
      <input className="input w-28" type="number" min="1" step="0.01" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      <select className="input w-32" value={method} onChange={(e) => setMethod(e.target.value)}>{['Cash', 'GCash', 'Bank Transfer', 'Card'].map((m) => <option key={m}>{m}</option>)}</select>
      <button className="btn" onClick={() => onPay(charge, amount, method)}>Pay</button>
    </div>
  );
}

export function CashierHistory() {
  const { data, loading, error } = useFetch('/cashier/payments', []);
  return (
    <>
      <PageTitle title="Payment History" />
      <Loading loading={loading} error={error} />
      <Table rows={data} columns={[
        { header: 'Receipt', render: (p) => p.receiptNo }, { header: 'Date', render: (p) => fmtDate(p.createdAt) },
        { header: 'Student', render: (p) => p.Charge?.Student?.User?.fullName }, { header: 'For', render: (p) => p.Charge?.description },
        { header: 'Amount', render: (p) => peso(p.amount) }, { header: 'Method', render: (p) => p.method }, { header: 'Cashier', render: (p) => p.cashier?.fullName },
      ]} />
    </>
  );
}

/* ---------------- Department ---------------- */
export function DepartmentClearance() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch(`/department/clearance${status ? `?status=${status}` : ''}`, []);
  const { msg, run } = useAction();
  const update = async (id, next) => {
    let remarks;
    if (next === 'Hold') { remarks = window.prompt('Reason for the hold (required):'); if (!remarks) return; }
    if (await run(() => api.patch(`/department/clearance/${id}`, { status: next, remarks }), `Marked ${next}.`)) reload();
  };
  return (
    <>
      <PageTitle title="Clearance Queue" subtitle="Approve or place a hold on students for your department.">
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          <option value="">All</option><option>Pending</option><option>Cleared</option><option>Hold</option>
        </select>
      </PageTitle>
      <Alert type={msg.type}>{msg.text}</Alert>
      <Loading loading={loading} error={error} />
      <Table rows={data} empty="No students in the queue." columns={[
        { header: 'Student', render: (c) => <>{c.Student.User.fullName}<div className="text-slate-500">{c.Student.studentNo}</div></> },
        { header: 'Department', render: (c) => c.department }, { header: 'Status', render: (c) => <Badge value={c.status} /> },
        { header: 'Remarks', render: (c) => c.remarks || '—' },
        { header: 'Action', render: (c) => (
          <div className="flex gap-2"><button className="btn" onClick={() => update(c.id, 'Cleared')}>Clear</button><button className="btn-danger" onClick={() => update(c.id, 'Hold')}>Hold</button></div>
        ) },
      ]} />
    </>
  );
}
