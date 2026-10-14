import { useState } from 'react';

export const UNIVERSITY = import.meta.env.VITE_UNIVERSITY_NAME || 'UniServe University';

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-3xl font-semibold text-brand-900">{title}</h1>
        <div className="mt-1 h-0.5 w-12 bg-gold-500" />
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const styles = { error: 'bg-red-50 text-red-700 border-red-200', success: 'bg-green-50 text-green-700 border-green-200', info: 'bg-brand-50 text-brand-700 border-brand-200' };
  return <div role="alert" className={`mb-3 rounded-md border px-3 py-2 text-sm ${styles[type]}`}>{children}</div>;
}

const BADGE = {
  Pending: 'bg-slate-100 text-slate-700', Submitted: 'bg-brand-100 text-brand-700', Validated: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700', Cleared: 'bg-green-100 text-green-700', Hold: 'bg-red-100 text-red-700',
  'Payment Pending': 'bg-amber-100 text-amber-800', Paid: 'bg-green-100 text-green-700', Processing: 'bg-gold-400/20 text-gold-600',
  Ready: 'bg-teal-100 text-teal-700', Released: 'bg-slate-200 text-slate-700', Unpaid: 'bg-red-100 text-red-700', Partial: 'bg-amber-100 text-amber-800',
};
export const Badge = ({ value }) => (
  <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-semibold tracking-wide ${BADGE[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>
);

export const Loading = ({ loading, error }) => {
  if (loading) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>;
  if (error) return <Alert>{error}</Alert>;
  return null;
};

// columns: [{ header, render: (row) => node }]
export function Table({ columns, rows, empty = 'Nothing to show yet.' }) {
  if (!rows || rows.length === 0) return <p className="card text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-sm border border-ivory-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-ivory-200 text-sm">
        <thead className="bg-brand-900 text-left text-xs uppercase tracking-wider text-ivory-100">
          <tr>{columns.map((c) => <th key={c.header} className="px-3 py-2 font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ivory-200">
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>{columns.map((c) => <td key={c.header} className="px-3 py-2 align-top">{c.render(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
  </label>
);

export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '');

// Run an async action with shared error/success feedback
export function useAction() {
  const [msg, setMsg] = useState({ type: '', text: '' });
  const run = async (fn, okText) => {
    setMsg({ type: '', text: '' });
    try {
      await fn();
      if (okText) setMsg({ type: 'success', text: okText });
      return true;
    } catch (e) {
      const d = e.response?.data;
      setMsg({ type: 'error', text: d?.details?.map((x) => x.message).join('. ') || d?.error || e.message });
      return false;
    }
  };
  return { msg, run, setMsg };
}
