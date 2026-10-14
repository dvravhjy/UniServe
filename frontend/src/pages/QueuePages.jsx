import { useEffect, useState } from 'react';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../hooks/useAuth';
import { Alert, Field, Loading, PageTitle, Table, UNIVERSITY, useAction } from '../components/ui';

const SERVICES = ['Registrar', 'Cashier', 'Library', 'Laboratory', 'Guidance', 'Dean'];

// Re-run a loader every few seconds so the screens stay live
function usePoll(reload, ms = 5000) {
  useEffect(() => {
    const id = setInterval(reload, ms);
    return () => clearInterval(id);
  }, [reload, ms]);
}

/* ---------- Public "Now Serving" board (waiting-area screen, no login) ---------- */
export function QueueBoard() {
  const { data, reload } = useFetch('/queue/board', []);
  usePoll(reload);
  return (
    <div className="min-h-screen bg-brand-900 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 border-b-4 border-gold-500 pb-3">
          <div className="font-serif text-4xl font-semibold">Now Serving</div>
          <div className="text-xs uppercase tracking-[0.25em] text-gold-400">{UNIVERSITY}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data || []).map((s) => (
            <div key={s.service} className="rounded-sm border border-gold-500/40 bg-brand-800 p-4">
              <div className="text-sm uppercase tracking-wider text-gold-400">{s.service}</div>
              <div className="my-3 min-h-[3.5rem] font-serif text-5xl font-semibold">
                {s.nowServing.length ? s.nowServing.join(' · ') : <span className="text-2xl text-white/50">None yet</span>}
              </div>
              <div className="text-sm text-white/80">{s.waiting} waiting · about {s.estimatedWaitMinutes} min</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-white/70">Please take a ticket at the front desk and wait until your number is shown.</p>
      </div>
    </div>
  );
}

/* ---------- Staff queue window ---------- */
const who = (t) => t.Student?.User?.fullName || t.walkInName || 'Walk-in';

export function QueueWindow() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [service, setService] = useState(isAdmin ? 'Registrar' : '');
  const url = `/queue/window${isAdmin ? `?service=${service}` : ''}`;
  const { data, loading, error, reload } = useFetch(url, null);
  const { msg, run, setMsg } = useAction();
  const [form, setForm] = useState({ name: '', studentNo: '', purpose: '' });
  usePoll(reload);

  const target = isAdmin ? service : data?.service;
  const call = async () => {
    const res = { current: null };
    if (await run(async () => { res.current = (await api.post(`/queue/window/next${isAdmin ? `?service=${service}` : ''}`)).data; })) {
      if (!res.current.called) setMsg({ type: 'info', text: 'No one is waiting.' });
      reload();
    }
  };
  const act = async (id, what) => { if (await run(() => api.post(`/queue/window/${id}/${what}${isAdmin ? `?service=${service}` : ''}`))) reload(); };
  const issue = async (e) => {
    e.preventDefault();
    let code = '';
    const ok = await run(async () => {
      const { data: t } = await api.post('/queue/walk-in', { service: target, name: form.name, studentNo: form.studentNo || undefined, purpose: form.purpose || undefined });
      code = t.code;
    });
    if (ok) { setMsg({ type: 'success', text: `Ticket ${code} issued to ${form.name}. Hand it to the student.` }); setForm({ name: '', studentNo: '', purpose: '' }); reload(); }
  };

  return (
    <>
      <PageTitle title={`Queue Window${target ? `: ${target}` : ''}`} subtitle="Call the next ticket, finish it, and issue tickets to walk-in students.">
        <a className="btn-secondary" href="/board" target="_blank" rel="noreferrer">Open Now Serving board</a>
      </PageTitle>
      <Alert type={msg.type}>{msg.text}</Alert>
      {isAdmin && (
        <div className="mb-3 max-w-xs"><Field label="Window">
          <select className="input" value={service} onChange={(e) => setService(e.target.value)}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field></div>
      )}
      <Loading loading={loading && !data} error={error} />
      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Now serving</div>
                <div className="font-serif text-4xl font-semibold text-brand-900">{data.serving.length ? data.serving.map((t) => t.code).join(' · ') : '—'}</div>
              </div>
              <button className="btn" onClick={call}>Call next</button>
            </div>
            <div className="mt-4 space-y-2">
              {data.serving.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-sm border border-ivory-200 p-2 text-sm">
                  <span><b>{t.code}</b> · {who(t)}{t.purpose ? ` · ${t.purpose}` : ''}</span>
                  <span className="flex gap-2"><button className="btn" onClick={() => act(t.id, 'complete')}>Done</button><button className="btn-secondary" onClick={() => act(t.id, 'skip')}>Skip</button></span>
                </div>
              ))}
            </div>
            <h2 className="mb-2 mt-5 font-medium">Waiting ({data.waiting}, about {data.estimatedWaitMinutes} min)</h2>
            <Table rows={data.waitingList} empty="No one is waiting." columns={[
              { header: 'Ticket', render: (t) => <b>{t.code}</b> },
              { header: 'Name', render: who },
              { header: 'Purpose', render: (t) => t.purpose || '' },
              { header: 'Type', render: (t) => (t.studentId ? 'Has account' : 'Walk-in') },
              { header: '', render: (t) => <button className="btn-secondary" onClick={() => act(t.id, 'skip')}>Skip</button> },
            ]} />
          </div>
          <form onSubmit={issue} className="card space-y-3">
            <h2 className="font-medium">Issue a walk-in ticket</h2>
            <Field label="Student name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Student number (optional)"><input className="input" placeholder="2026-00001" value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} /></Field>
            <Field label="Purpose (optional)"><input className="input" maxLength={120} placeholder="e.g. Enrollment" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
            <button className="btn w-full" type="submit">Issue ticket</button>
          </form>
        </div>
      )}
    </>
  );
}

/* ---------- Registrar counter desk: create an account and enroll face to face ---------- */
export function CounterDesk() {
  const sections = useFetch('/registrar/sections', []);
  const { msg, run, setMsg } = useAction();
  const [form, setForm] = useState({ fullName: '', email: '', program: '', yearLevel: 1 });
  const [created, setCreated] = useState(null); // { studentId, studentNo, email, tempPassword }
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setDone('');
    const res = { current: null };
    if (await run(async () => { res.current = (await api.post('/registrar/students', { ...form, yearLevel: Number(form.yearLevel) })).data; })) {
      setCreated(res.current); setPicked([]);
      setForm({ fullName: '', email: '', program: '', yearLevel: 1 });
    }
  };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const enroll = async () => {
    if (await run(() => api.post(`/registrar/students/${created.studentId}/enrollment`, { sectionIds: picked }))) {
      setDone(`${created.studentNo} is enrolled. Send the student to the Cashier to pay.`);
      setPicked([]);
    }
  };
  const lookup = async (e) => {
    e.preventDefault();
    const no = new FormData(e.target).get('no').trim();
    setDone('');
    const { data: list } = await api.get('/registrar/students');
    const s = list.find((x) => x.studentNo === no);
    if (!s) return setMsg({ type: 'error', text: 'No student with that number.' });
    setMsg({ type: '', text: '' });
    setCreated({ studentId: s.id, studentNo: s.studentNo, email: s.User.email, tempPassword: null });
    setPicked([]);
  };

  const open = (sections.data || []);
  return (
    <>
      <PageTitle title="Counter Desk" subtitle="Online sign-up is closed. Create the student's account here, then enroll the student face to face." />
      <Alert type={msg.type}>{msg.text}</Alert>
      <Alert type="success">{done}</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <form onSubmit={create} className="card space-y-3">
            <h2 className="font-medium">1. New student account</h2>
            <Field label="Full name"><input className="input" required value={form.fullName} onChange={set('fullName')} /></Field>
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Program"><input className="input" required placeholder="e.g. BS Computer Science" value={form.program} onChange={set('program')} /></Field>
            <Field label="Year level"><select className="input" value={form.yearLevel} onChange={set('yearLevel')}>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select></Field>
            <button className="btn" type="submit">Create account</button>
          </form>
          <form onSubmit={lookup} className="card flex items-end gap-2">
            <div className="flex-1"><Field label="Or find an existing student by number"><input name="no" className="input" placeholder="2026-00001" required /></Field></div>
            <button className="btn-secondary" type="submit">Find</button>
          </form>
        </div>
        <div className="card space-y-3">
          <h2 className="font-medium">2. Enroll at the window</h2>
          {!created && <p className="text-sm text-slate-500">Create or find a student first.</p>}
          {created && (
            <>
              <div className="rounded-sm border border-brand-200 bg-brand-50 p-3 text-sm">
                Student <b>{created.studentNo}</b> ({created.email})
                {created.tempPassword && <div className="mt-1">Temporary password: <b className="font-mono">{created.tempPassword}</b><div className="text-xs text-slate-500">Shown once. Give it to the student and ask them to keep it private.</div></div>}
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {open.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-sm border border-ivory-200 p-2 text-sm">
                    <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span>{s.Subject.code} · {s.Subject.title} ({s.name}) · {s.schedule}</span>
                  </label>
                ))}
                {open.length === 0 && <p className="text-sm text-slate-500">No sections are open this term.</p>}
              </div>
              <button className="btn" disabled={picked.length === 0} onClick={enroll}>Enroll student ({picked.length})</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
