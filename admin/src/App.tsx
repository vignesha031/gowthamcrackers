import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Loading } from './ui';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Payments from './pages/Payments';
import Dues from './pages/Dues';
import Customers from './pages/Customers';
import Referrals from './pages/Referrals';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Plans from './pages/Plans';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Activity from './pages/Activity';

const NAV = [
  { to: '/', label: 'Dashboard', ico: '▦', perm: 'dashboard.view', end: true },
  { to: '/payments', label: 'Payments', ico: '₹', perm: 'payments.view', badge: 'waiting' },
  { to: '/dues', label: 'Dues', ico: '⏰', perm: 'dues.view', badge: 'overdue' },
  { to: '/customers', label: 'Customers', ico: '☺', perm: 'customers.view' },
  { to: '/referrals', label: 'Referrals', ico: '↗', perm: 'customers.view' },
  { to: '/members', label: 'Members', ico: '✦', perm: 'enrolments.view' },
  { to: '/plans', label: 'Plans & Scheme', ico: '❖', perm: 'scheme.view' },
  { to: '/notifications', label: 'Notifications', ico: '✉', perm: 'notifications.view' },
  { to: '/reports', label: 'Reports', ico: '▤', perm: 'reports.view' },
  { to: '/staff', label: 'Staff', ico: '♟', perm: 'staff.view' },
  { to: '/activity', label: 'Activity log', ico: '☰', perm: 'activity.view' },
] as const;

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) return <div className="card"><h2>No access</h2><p className="muted">Your account cannot open this section. Ask the owner to give you access.</p></div>;
  return <>{children}</>;
}

function Shell() {
  const { me, can, badges, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const first = NAV.find((n) => can(n.perm));
  return (
    <div className="shell">
      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand"><div className="logo">G</div><div><b>Gowtham Crackers</b><small>Chit fund admin</small></div></div>
        <nav className="nav">
          {NAV.filter((n) => can(n.perm)).map((n) => {
            const c = 'badge' in n ? badges[n.badge as 'waiting' | 'overdue'] : 0;
            return <NavLink key={n.to} to={n.to} end={'end' in n} className={({ isActive }) => (isActive ? 'active' : '')}><span className="ico">{n.ico}</span>{n.label}{c > 0 && <span className="count">{c}</span>}</NavLink>;
          })}
        </nav>
        <div className="side-foot"><b>{me?.name}</b><span style={{ opacity: .7 }}>{me?.role.replace('_', ' ')}</span><NavLink to="/change-password">Change password</NavLink><button className="btn sm ghost" onClick={logout}>Sign out</button></div>
      </aside>
      <div className="main">
        <div className="topbar"><button className="icon-btn" style={{ color: '#fff' }} onClick={() => setOpen(true)} aria-label="Open menu">☰</button><b>Gowtham Crackers · Admin</b></div>
        <div className="content">
          <Routes>
            <Route path="/" element={can('dashboard.view') ? <Dashboard /> : first ? <Navigate to={first.to} replace /> : <Guard perm="dashboard.view"><></></Guard>} />
            <Route path="/payments" element={<Guard perm="payments.view"><Payments /></Guard>} />
            <Route path="/dues" element={<Guard perm="dues.view"><Dues /></Guard>} />
            <Route path="/customers" element={<Guard perm="customers.view"><Customers /></Guard>} />
            <Route path="/customers/:id" element={<Guard perm="customers.view"><Customers /></Guard>} />
            <Route path="/referrals" element={<Guard perm="customers.view"><Referrals /></Guard>} />
            <Route path="/members" element={<Guard perm="enrolments.view"><Members /></Guard>} />
            <Route path="/members/:id" element={<Guard perm="enrolments.view"><MemberDetail /></Guard>} />
            <Route path="/plans" element={<Guard perm="scheme.view"><Plans /></Guard>} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/notifications" element={<Guard perm="notifications.view"><Notifications /></Guard>} />
            <Route path="/reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
            <Route path="/staff" element={<Guard perm="staff.view"><Staff /></Guard>} />
            <Route path="/activity" element={<Guard perm="activity.view"><Activity /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Login />;
  if (me.mustChangePassword) return <ChangePassword forced />;
  return <Shell />;
}
