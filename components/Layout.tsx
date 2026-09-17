
import React from 'react';
import Sidebar from './Sidebar';
import { db } from '../services/db';
import { User as UserIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const user = db.getCurrentUser();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'VETERINARIO': return 'Médico Veterinário';
      case 'OPERATOR': return 'Operador';
      default: return role || '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-64 print:pl-0">
        <header className="no-print h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="text-sm text-slate-500">
            Painel de Controle Interno
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 leading-none">{user?.name}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                {getRoleLabel(user?.role)}
              </p>
            </div>
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
              <UserIcon size={20} className="text-slate-600" />
            </div>
          </div>
        </header>
        <main className="p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
