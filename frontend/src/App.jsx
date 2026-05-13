import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Login/Register en bundle principal (rutas iniciales).
import Login from './pages/Login';
import Register from './pages/Register';

// ── Páginas contenedor nuevas (arquitectura consolidada) ──────────────────
const POS             = lazy(() => import('./pages/POS'));
const Metricas        = lazy(() => import('./pages/Metricas'));
const MenuStock       = lazy(() => import('./pages/MenuStock'));

// ── Páginas individuales (siguen existiendo para deep-links) ─────────────
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
const ChatSimulator       = lazy(() => import('./pages/ChatSimulator'));

import { NotificationProvider } from './components/NotificationProvider';
import { ThemeProvider } from './context/ThemeContext';

// ── Redirección por rol al entrar al dashboard ────────────────────────────
const ROLE_HOME = {
  owner:        '/dashboard/metricas',
  receptionist: '/dashboard/pedidos',
  cook:         '/dashboard/cook',
};

function RoleRoute({ allowed, children }) {
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');
  if (!token) return <Navigate to="/login" replace />;
  if (allowed && !allowed.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
  }
  return children;
}

// Spinner mínimo para Suspense
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
    <ThemeProvider>
    <BrowserRouter>
      <NotificationProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Rutas públicas de autenticación */}
            <Route element={<AuthLayout />}>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Rutas protegidas del dashboard */}
            <Route path="/dashboard" element={<DashboardLayout />}>

              {/* ── NUEVAS RUTAS CONSOLIDADAS (arquitectura 5 destinos) ── */}

              {/* Pedidos: Recepción (vista unificada de pedidos) */}
              <Route path="pedidos" element={
                <RoleRoute allowed={['owner', 'receptionist', 'cook']}>
                  <ReceptionDashboard />
                </RoleRoute>
              } />

              {/* Punto de Venta: Mostrador + Mesas en tabs */}
              <Route path="pos" element={
                <RoleRoute allowed={['owner', 'receptionist']}>
                  <POS />
                </RoleRoute>
              } />

              {/* Métricas: Dashboard + Historial + Actividad en tabs */}
              <Route path="metricas" element={
                <RoleRoute allowed={['owner']}>
                  <Metricas />
                </RoleRoute>
              } />

              {/* Menú & Stock: Menú + Supplies en tabs */}
              <Route path="menu-stock" element={
                <RoleRoute allowed={['owner', 'receptionist']}>
                  <MenuStock />
                </RoleRoute>
              } />

              {/* Mi Negocio: Sucursales + Equipo en tabs */}
              <Route path="negocio" element={
                <RoleRoute allowed={['owner', 'receptionist', 'cook']}>
                  <KitchenDashboard />
                </RoleRoute>
              } />

              {/* Bot Simulator */}
              <Route path="bot" element={
                <RoleRoute allowed={['owner', 'receptionist', 'cook']}>
                  <ChatSimulator />
                </RoleRoute>
              } />

              {/* ── RUTAS INDIVIDUALES (siguen funcionando como deep-links) ── */}
              <Route path="cook" element={
                <RoleRoute allowed={['cook', 'owner']}><CookDashboard /></RoleRoute>
              } />
              <Route path="reservations" element={
                <RoleRoute allowed={['owner', 'receptionist']}><Reservations /></RoleRoute>
              } />
              <Route path="settings" element={
                <RoleRoute><Settings /></RoleRoute>
              } />
              <Route path="team" element={
                <RoleRoute allowed={['owner']}><TeamManagement /></RoleRoute>
              } />

              {/* ── ALIASES LEGACY (redirigen a las nuevas rutas) ── */}
              <Route path="owner"         element={<Navigate to="/dashboard/metricas"   replace />} />
              <Route path="kitchen"       element={<Navigate to="/dashboard/negocio"    replace />} />
              <Route path="reception"     element={<Navigate to="/dashboard/pedidos"    replace />} />
              <Route path="pos-counter"   element={<Navigate to="/dashboard/pos"        replace />} />
              <Route path="pos-table"     element={<Navigate to="/dashboard/pos"        replace />} />
              <Route path="menu"          element={<Navigate to="/dashboard/menu-stock" replace />} />
              <Route path="supplies"      element={<Navigate to="/dashboard/menu-stock" replace />} />
              <Route path="order-history" element={<Navigate to="/dashboard/metricas"   replace />} />
              <Route path="activity-logs" element={<Navigate to="/dashboard/metricas"   replace />} />
              <Route path="chat-simulator" element={<Navigate to="/dashboard/bot"       replace />} />

            </Route>

            {/* Página pública de privacidad */}
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Bot público sin login */}
            <Route path="/bot" element={
              <div style={{
                minHeight: '100vh',
                background: 'var(--bg-color)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}>
                <ChatSimulator />
              </div>
            } />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </NotificationProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
