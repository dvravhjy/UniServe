import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import { Login, homeFor } from './pages/Auth';
import { CounterDesk, QueueBoard, QueueWindow } from './pages/QueuePages';
import { Balance, Clearance, Documents, Enroll, Grades, Profile, Schedule } from './pages/StudentPages';
import {
  CashierHistory, CashierPayments, DepartmentClearance, DocumentRequests, GradeEncoding,
  RegistrarEnrollments, RegistrarStudents, RegistrarSubjects,
} from './pages/StaffPages';
import { AdminAudit, AdminDashboard, AdminSettings, AdminUsers } from './pages/AdminPages';

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

const guard = (role, element) => <RequireRole role={role}>{element}</RequireRole>;

function RequireAnyRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/board" element={<QueueBoard />} />
      <Route path="/" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Navigate to="/login" replace />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/student/enroll" element={guard('student', <Enroll />)} />
        <Route path="/student/schedule" element={guard('student', <Schedule />)} />
        <Route path="/student/grades" element={guard('student', <Grades />)} />
        <Route path="/student/clearance" element={guard('student', <Clearance />)} />
        <Route path="/student/documents" element={guard('student', <Documents />)} />
        <Route path="/student/balance" element={guard('student', <Balance />)} />
        <Route path="/student/profile" element={guard('student', <Profile />)} />

        <Route path="/registrar/enrollments" element={guard('registrar', <RegistrarEnrollments />)} />
        <Route path="/registrar/subjects" element={guard('registrar', <RegistrarSubjects />)} />
        <Route path="/registrar/grades" element={guard('registrar', <GradeEncoding canRelease />)} />
        <Route path="/registrar/documents" element={guard('registrar', <DocumentRequests role="registrar" />)} />
        <Route path="/registrar/students" element={guard('registrar', <RegistrarStudents />)} />
        <Route path="/registrar/counter" element={guard('registrar', <CounterDesk />)} />
        <Route path="/queue" element={<RequireAnyRole roles={['registrar', 'cashier', 'dept_staff', 'admin']}><QueueWindow /></RequireAnyRole>} />

        <Route path="/cashier/payments" element={guard('cashier', <CashierPayments />)} />
        <Route path="/cashier/history" element={guard('cashier', <CashierHistory />)} />
        <Route path="/cashier/documents" element={guard('cashier', <DocumentRequests role="cashier" />)} />

        <Route path="/department/clearance" element={guard('dept_staff', <DepartmentClearance />)} />
        <Route path="/instructor/grades" element={guard('instructor', <GradeEncoding />)} />

        <Route path="/admin/dashboard" element={guard('admin', <AdminDashboard />)} />
        <Route path="/admin/users" element={guard('admin', <AdminUsers />)} />
        <Route path="/admin/settings" element={guard('admin', <AdminSettings />)} />
        <Route path="/admin/audit" element={guard('admin', <AdminAudit />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
