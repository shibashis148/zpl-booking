import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';
import BookingsPage from './pages/BookingsPage';
import LoginPage from './pages/LoginPage';
import NewBookingPage from './pages/NewBookingPage';
import PartnersPage from './pages/PartnersPage';

function ProtectedLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center bg-canvas text-sm font-bold text-slate-500">Opening booking desk…</div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/new" element={<NewBookingPage />} />
      <Route path="/bookings" element={<BookingsPage />} />
      <Route path="/partners" element={<PartnersPage />} />
      <Route index element={<Navigate to="/new" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/new" replace />} />
  </Routes>;
}
