import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RelationshipPerformance } from './pages/RelationshipPerformance';
import { Numbering } from './pages/Numbering';
import { CallDiagnostic } from './pages/CallDiagnostic';
import { SendPayment } from './pages/SendPayment';
import { Invoices } from './pages/Invoices';
import { ViewRates } from './pages/ViewRates';
import { CarrierPayments } from './pages/CarrierPayments';
import { AdminPortal } from './pages/AdminPortal';
import type { JSX, ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Send each role to its home. */
function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

const PAGES: Array<[string, () => JSX.Element]> = [
  ['/dashboard', Dashboard],
  ['/reportings/relationship', RelationshipPerformance],
  ['/reportings/numbering', Numbering],
  ['/call-diagnostic', CallDiagnostic],
  ['/accounting/send-payment', SendPayment],
  ['/accounting/invoices', Invoices],
  ['/accounting/view-rates', ViewRates],
  ['/accounting/carrier-payments', CarrierPayments],
];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPortal />
          </RequireAdmin>
        }
      />
      {PAGES.map(([path, Page]) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireAuth>
              <Page />
            </RequireAuth>
          }
        />
      ))}
      <Route path="/reports" element={<Navigate to="/reportings/relationship" replace />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
