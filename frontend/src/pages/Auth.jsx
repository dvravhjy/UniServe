import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Alert, Field, UNIVERSITY, useAction } from '../components/ui';
import { NAV } from '../components/Layout';

export const homeFor = (role) => NAV[role][0][0];

function Shell({ title, children }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-5/12 flex-col justify-between border-r-4 border-gold-500 bg-brand-900 p-12 text-white lg:flex">
        <div className="text-xs uppercase tracking-[0.3em] text-gold-400">{UNIVERSITY}</div>
        <div>
          <div className="font-serif text-6xl font-semibold leading-tight">UniServe</div>
          <div className="my-5 h-0.5 w-16 bg-gold-500" />
          <p className="max-w-sm font-serif text-xl italic text-brand-100">University Student Management and Services System</p>
          <p className="mt-4 max-w-sm text-sm text-brand-200">Enrollment, clearance, grades and document requests, all in one place, with no more waiting in line.</p>
        </div>
        <div className="text-xs text-brand-200">Office of the Registrar</div>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-ivory-100 px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <div className="font-serif text-4xl font-semibold text-brand-900">UniServe</div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold-600">{UNIVERSITY}</div>
          </div>
          <div className="card p-8">
            <h1 className="mb-1 text-3xl font-semibold text-brand-900">{title}</h1>
            <div className="mb-5 h-0.5 w-10 bg-gold-500" />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { msg, run } = useAction();
  const [form, setForm] = useState({ email: '', password: '' });
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => login(form.email, form.password));
    if (ok) navigate('/');
  };
  return (
    <Shell title="Sign in">
      <form onSubmit={submit} className="space-y-3">
        <Alert type={msg.type}>{msg.text}</Alert>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn w-full" type="submit">Sign in</button>
        <p className="text-center text-sm text-slate-500">New student? Online sign-up is closed. Please visit the Registrar window to get your account. <Link className="font-semibold text-brand-700 underline" to="/board">See who is being served</Link></p>
      </form>
    </Shell>
  );
}
