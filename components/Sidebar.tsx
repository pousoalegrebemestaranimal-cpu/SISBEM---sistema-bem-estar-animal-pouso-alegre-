
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Dog, LogOut, PlusCircle, ClipboardList, Users, Stethoscope, Home, Settings, UserSearch, UserCircle, FileText, Scissors } from 'lucide-react';
import { db } from '../services/db';
import { supabase } from '../src/lib/supabase';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const user = db.getCurrentUser();
  const isVetOrAdmin = user?.role === 'VETERINARIO' || user?.role === 'ADMIN';
  
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    db.logout();
    window.location.hash = '/login';
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/animais', label: 'Lista de Animais', icon: ClipboardList },
    { path: '/animais/novo', label: 'Novo Cadastro', icon: PlusCircle },
    { path: '/cirurgias/fila', label: 'Fila Cirúrgica', icon: Scissors },
    { path: '/tutores', label: 'Banco de Tutores', icon: UserCircle },
    { path: '/solicitantes', label: 'Solicitantes', icon: UserSearch },
    { path: '/acomodacao', label: 'Acomodação', icon: Home },
    { path: '/relatorios', label: 'Relatórios', icon: FileText },
  ];

  return (
    <aside className="no-print sidebar-container w-64 bg-slate-900 text-white min-h-screen flex flex-col fixed left-0 top-0 h-full z-10">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-teal-500 p-2 rounded-lg">
          <Dog className="text-white" size={24} />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight">SISBEM</h1>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Bem-Estar Animal</p>
        </div>
      </div>
      
      <nav className="flex-1 mt-6 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-teal-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {isVetOrAdmin && (
          <Link
            to="/veterinario/fila"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === '/veterinario/fila' 
                ? 'bg-teal-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Stethoscope size={20} />
            <span className="font-medium">Fila Veterinária</span>
          </Link>
        )}

        {user?.role === 'ADMIN' && (
          <>
            <Link
              to="/usuarios"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === '/usuarios' 
                  ? 'bg-teal-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users size={20} />
              <span className="font-medium">Usuários</span>
            </Link>
            <Link
              to="/configuracoes"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === '/configuracoes' 
                  ? 'bg-teal-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings size={20} />
              <span className="font-medium">Configurações</span>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
