import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Logs from './pages/Logs';
import AIAdvisor from './pages/AIAdvisor';
import Savings from './pages/Savings';
import Limits from './pages/Limits';
import Settings from './pages/Settings';

// Protect routes — redirect to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">Fin<span>Wise</span></div>
      <div className="spinner"></div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
};

const AppLayout = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <main className="main-content">{children}</main>
  </div>
);

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">Fin<span>Wise</span></div>
      <div className="spinner"></div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/onboarding" element={
        !user ? <Navigate to="/login" /> : user.onboarded ? <Navigate to="/dashboard" /> : <Onboarding />
      } />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><AppLayout><Expenses /></AppLayout></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><AppLayout><Logs /></AppLayout></ProtectedRoute>} />
      <Route path="/ai-advisor" element={<ProtectedRoute><AppLayout><AIAdvisor /></AppLayout></ProtectedRoute>} />
      <Route path="/savings" element={<ProtectedRoute><AppLayout><Savings /></AppLayout></ProtectedRoute>} />
      <Route path="/limits" element={<ProtectedRoute><AppLayout><Limits /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;