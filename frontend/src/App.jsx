import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Login/Register en bundle principal (rutas iniciales).
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboards y páginas pesadas: lazy. Cada una en su propio chunk → primer load
// del usuario solo trae lo que su rol necesita.
const OwnerDashboard      = lazy(() => import('./pages/OwnerDashboard'));
const KitchenDashboard    = lazy(() => import('./pages/KitchenDashboard'));
const CookDashboard       = lazy(() => import('./pages/CookDashboard'));
const ReceptionDashboard  = lazy(() => import('./pages/ReceptionDashboard'));
const Supplies            = lazy(() => import('./pages/Supplies'));
const Settings            = lazy(() => import('./pages/Settings'));
const Menu                = lazy(() => import('./pages/Menu'));
const ActivityLogs        = lazy(() => import('./pages/ActivityLogs'));
const TeamManagement      = lazy(() => import('./pages/TeamManagement'));
const OrderHistory        = lazy(() => import('./pages/OrderHistory'));
const POSCounter          = lazy(() => import('./pages/POSCounter'));
const POSTable            = lazy(() => import('./pages/POSTable'));
const Reservations        = lazy(() => import('./pages/Reservations'));
const PrivacyPolicy       = lazy(() => import('./pages/PrivacyPolicy'));

import { NotificationProvider } from './components/NotificationProvider';
import { ThemeProvider } from './components/ThemeContext';

const ROLE_HOME = {
  owner: '/dashboard/owner',
  receptionist: '/dashboard/reception',
  cook: '/dashboard/kitchen',
};

function RoleRoute({ allowed, children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token) return <Navigate to="/login" replace />;
  if (allowed && !allowed.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
  }
  return children;
}

// Spinner mínimo para Suspense — evita flash en cargas rápidas.
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-secondary, #888)',
    }}>
      Cargando…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <NotificationProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Public Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              {/* Protected Dashboard Routes */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route path="owner" element={
                  <RoleRoute allowed={['owner']}><OwnerDashboard /></RoleRoute>
                } />
                <Route path="kitchen" element={
                  <RoleRoute allowed={['owner', 'cook']}><KitchenDashboard /></RoleRoute>
                } />
                <Route path="supplies" element={
                  <RoleRoute allowed={['owner']}><Supplies /></RoleRoute>
                } />
                <Route path="activity-logs" element={
                  <RoleRoute allowed={['owner']}><ActivityLogs /></RoleRoute>
                } />
                <Route path="settings" element={
                  <RoleRoute><Settings /></RoleRoute>
                } />
                <Route path="menu" element={
                  <RoleRoute allowed={['owner', 'receptionist']}><Menu /></RoleRoute>
                } />
                <Route path="cook" element={
                  <RoleRoute allowed={['cook', 'owner']}><CookDashboard /></RoleRoute>
                } />
                <Route path="reception" element={
                  <RoleRoute allowed={['owner', 'receptionist']}><ReceptionDashboard /></RoleRoute>
                } />
                <Route path="order-history" element={
                  <RoleRoute allowed={['owner']}><OrderHistory /></RoleRoute>
                } />
                <Route path="team" element={
                  <RoleRoute allowed={['owner']}><TeamManagement /></RoleRoute>
                } />
                <Route path="pos-counter" element={
                  <RoleRoute allowed={['owner', 'receptionist']}><POSCounter /></RoleRoute>
                } />
                <Route path="pos-table" element={
                  <RoleRoute allowed={['owner', 'receptionist', 'cook']}><POSTable /></RoleRoute>
                } />
                <Route path="reservations" element={
                  <RoleRoute allowed={['owner', 'receptionist']}><Reservations /></RoleRoute>
                } />
              </Route>

              {/* Public static pages — accesibles sin auth */}
              <Route path="/privacy" element={<PrivacyPolicy />} />

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
