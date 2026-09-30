
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './services/db';
import { supabase, resolveSupabaseProfile } from './src/lib/supabase';
import { pullFromSupabaseToLocal, initRealtimeSync } from './src/lib/supabaseSync';
import { sanitizeExistingLocalStorage, sanitizeCredentialsFromLocalStorage } from './src/lib/safeStorage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AnimalList from './pages/AnimalList';
import AnimalForm from './pages/AnimalForm';
import AnimalDetail from './pages/AnimalDetail';
import VeterinaryForm from './pages/VeterinaryForm';
import VetWaitlist from './pages/VetWaitlist';
import UserManagement from './pages/UserManagement';
import AccommodationDashboard from './pages/AccommodationDashboard';
import SettingsPage from './pages/Settings';
import SolicitanteList from './pages/SolicitanteList';
import SolicitanteDetail from './pages/SolicitanteDetail';
import TutorList from './pages/TutorList';
import TutorDetail from './pages/TutorDetail';
import ReportsPage from './pages/ReportsPage';
import SurgicalWaitlist from './pages/SurgicalWaitlist';
import Layout from './components/Layout';

const AuthGuard: React.FC<{ children: React.ReactNode, adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const [user, setUser] = React.useState<any>(() => db.getCurrentUser());

  React.useEffect(() => {
    const handleAuthChange = () => {
      setUser(db.getCurrentUser());
    };
    window.addEventListener('sisbem-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('sisbem-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/animais" element={<AuthGuard><AnimalList /></AuthGuard>} />
      <Route path="/animais/novo" element={<AuthGuard><AnimalForm /></AuthGuard>} />
      <Route path="/animais/editar/:id" element={<AuthGuard><AnimalForm /></AuthGuard>} />
      <Route path="/animais/ficha/:id" element={<AuthGuard><AnimalDetail /></AuthGuard>} />
      <Route path="/animais/atendimento/:id" element={<AuthGuard><VeterinaryForm /></AuthGuard>} />
      <Route path="/solicitantes" element={<AuthGuard><SolicitanteList /></AuthGuard>} />
      <Route path="/solicitantes/:id" element={<AuthGuard><SolicitanteDetail /></AuthGuard>} />
      <Route path="/tutores" element={<AuthGuard><TutorList /></AuthGuard>} />
      <Route path="/tutores/:id" element={<AuthGuard><TutorDetail /></AuthGuard>} />
      <Route path="/veterinario/fila" element={<AuthGuard><VetWaitlist /></AuthGuard>} />
      <Route path="/cirurgias" element={<AuthGuard><SurgicalWaitlist /></AuthGuard>} />
      <Route path="/cirurgias/fila" element={<AuthGuard><SurgicalWaitlist /></AuthGuard>} />
      <Route path="/acomodacao" element={<AuthGuard><AccommodationDashboard /></AuthGuard>} />
      <Route path="/relatorios" element={<AuthGuard><ReportsPage /></AuthGuard>} />
      <Route path="/configuracoes" element={<AuthGuard adminOnly><SettingsPage /></AuthGuard>} />
      <Route path="/usuarios" element={<AuthGuard adminOnly><UserManagement /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // 0. Saneamento preventivo de cota e expurgação estrita de credenciais locais (Fase 1.1.5)
    sanitizeExistingLocalStorage();
    sanitizeCredentialsFromLocalStorage();

    // Sincroniza dados do Supabase imediatamente ao carregar o aplicativo
    pullFromSupabaseToLocal(db).catch(err => console.warn('Supabase initial pull error:', err));

    // Inicializa a escuta em tempo real (Realtime Channel) para manter todos os usuários conectados em sincronia
    const cleanupRealtime = initRealtimeSync();

    // Restaura sessão existente do Supabase e resolve perfil institucional apenas se houver sessão ativa
    supabase.auth.getSession().then(async ({ data }) => {
      // Se não há usuário logado no storage local (ex: logout recente ou tela de login), não força auto-login
      const localUser = db.getCurrentUser();
      if (data?.session?.user && localUser) {
        const appUser = await resolveSupabaseProfile(data.session.user);
        db.setCurrentUser(appUser as any);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && event !== 'SIGNED_OUT') {
        const appUser = await resolveSupabaseProfile(session.user);
        db.setCurrentUser(appUser as any);
        if (event === 'SIGNED_IN') {
          pullFromSupabaseToLocal(db).catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        if (db.getCurrentUser()) {
          db.logout();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupRealtime();
    };
  }, []);

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};

export default App;

