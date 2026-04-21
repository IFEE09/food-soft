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

import { NotificationProvider } from './components/NotificationProvider';

function App() {
  return (
    <BrowserRouter>
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
            <Route path="owner" element={<OwnerDashboard />} />
            <Route path="kitchen" element={<KitchenDashboard />} />
            <Route path="supplies" element={<Supplies />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="menu" element={<Menu />} />
            <Route path="cook" element={<CookDashboard />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
