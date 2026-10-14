import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import api from '../services/api';
import { UNIVERSITY, fmtDate } from './ui';

export const NAV = {
  student: [
    ['/student/enroll', 'Enrollment'], ['/student/schedule', 'Schedule'], ['/student/grades', 'Grades'],
    ['/student/clearance', 'Clearance'], ['/student/documents', 'Documents'], ['/student/balance', 'Balance'], ['/student/profile', 'Profile'],
  ],
  registrar: [['/registrar/enrollments', 'Enrollments'], ['/registrar/subjects', 'Subjects & Sections'], ['/registrar/grades', 'Grades'], ['/registrar/documents', 'Document Requests'], ['/registrar/students', 'Students'], ['/registrar/counter', 'Counter Desk'], ['/queue', 'Queue Window']],
  cashier: [['/cashier/payments', 'Record Payment'], ['/cashier/history', 'Payment History'], ['/cashier/documents', 'Document Requests'], ['/queue', 'Queue Window']],
  dept_staff: [['/department/clearance', 'Clearance Queue'], ['/queue', 'Queue Window']],
  instructor: [['/instructor/grades', 'Grade Encoding']],
  admin: [['/admin/dashboard', 'Dashboard'], ['/admin/users', 'Users'], ['/admin/settings', 'Settings'], ['/queue', 'Queue Window'], ['/admin/audit', 'Audit Logs']],
};

function Bell() {
  const [open, setOpen] = useState(false);
  const { data, reload } = useFetch('/notifications', []);
  const unread = (data || []).filter((n) => !n.read).length;
  const toggle = () => { setOpen(!open); if (!open) reload(); };
  const markRead = async (id) => { await api.patch(`/notifications/${id}/read`); reload(); };
  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications" className="relative rounded-md px-2 py-1 text-white hover:bg-brand-600">
        🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border bg-white p-2 text-slate-800 shadow-lg">
          {(data || []).length === 0 && <p className="p-2 text-sm text-slate-500">No notifications.</p>}
          {(data || []).map((n) => (
            <button key={n.id} onClick={() => markRead(n.id)} className={`block w-full rounded p-2 text-left text-sm hover:bg-slate-50 ${n.read ? 'text-slate-500' : 'font-medium'}`}>
              {n.message}<span className="block text-xs text-slate-400">{fmtDate(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const links = NAV[user.role] || [];
  const out = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-gold-500 bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden" aria-label="Menu" onClick={() => setMenu(!menu)}>☰</button>
            <div>
              <div className="font-serif text-2xl font-semibold leading-none tracking-wide">UniServe</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gold-400">{UNIVERSITY}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Bell />
            <span className="hidden sm:inline">{user.fullName}</span>
            <button className="rounded-md border border-gold-400 px-3 py-1 text-xs uppercase tracking-wider hover:bg-brand-700" onClick={out}>Log out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav className={`${menu ? 'block' : 'hidden'} w-full shrink-0 md:block md:w-52`}>
          <ul className="space-y-1">
            {links.map(([to, label]) => (
              <li key={to}>
                <NavLink to={to} onClick={() => setMenu(false)} className={({ isActive }) => `block border-l-4 px-3 py-2 text-sm ${isActive ? 'border-gold-500 bg-brand-100 font-semibold text-brand-900' : 'border-transparent text-slate-700 hover:bg-ivory-200'}`}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
