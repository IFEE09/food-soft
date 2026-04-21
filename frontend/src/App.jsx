import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import OwnerDashboard from './pages/OwnerDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import CookDashboard from './pages/CookDashboard';
import Supplies from './pages/Supplies';
import Settings from './pages/Settings';
import Register from './pages/Register';
import Menu from './pages/Menu';
import ActivityLogs from './pages/ActivityLogs';
import ReceptionDashboard from './pages/ReceptionDashboard';
import TeamManagement from './pages/TeamManagement';

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

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <NotificationProvider>
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
              <Route path="team" element={
                <RoleRoute allowed={['owner']}><TeamManagement /></RoleRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </NotificationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
