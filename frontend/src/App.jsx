import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import OwnerDashboard from './pages/OwnerDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import CookDashboard from './pages/CookDashboard';
import Supplies from './pages/Supplies';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route path="owner" element={<OwnerDashboard />} />
          <Route path="kitchen" element={<KitchenDashboard />} />
          <Route path="supplies" element={<Supplies />} />
          <Route path="settings" element={<Settings />} />
          <Route path="cook" element={<CookDashboard />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
