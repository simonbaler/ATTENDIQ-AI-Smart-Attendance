import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { HodDashboard } from './pages/HodDashboard';
import { MobileCameraView } from './pages/MobileCameraView';
import { RefreshCw } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const [showLoginView, setShowLoginView] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'login';
  });

  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    return (
      params.get('mode') === 'mobile-camera' ||
      params.has('token') ||
      pathname.startsWith('/mobile/pair') ||
      pathname.startsWith('/pair') ||
      window.location.hash === '#mobile-camera'
    );
  });

  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      setIsMobileMode(
        params.get('mode') === 'mobile-camera' ||
        params.has('token') ||
        pathname.startsWith('/mobile/pair') ||
        pathname.startsWith('/pair') ||
        window.location.hash === '#mobile-camera'
      );
      if (params.get('view') === 'login') {
        setShowLoginView(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  if (isMobileMode) {
    return <MobileCameraView />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl ring-4 ring-blue-500/20">
          AI
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
          <span>Verifying ATTENDIQ AI Authentication...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showLoginView) {
      return <Login onBack={() => setShowLoginView(false)} />;
    }
    return <LandingPage onLaunchApp={() => setShowLoginView(true)} />;
  }

  if (user.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  if (user.role === 'HOD') {
    return <HodDashboard />;
  }

  // Fallback
  return <Login onBack={() => setShowLoginView(false)} />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
