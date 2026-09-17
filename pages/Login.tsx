
import React, { useState } from 'react';
import { db } from '../services/db';
import { Dog, Lock, User, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay
    setTimeout(() => {
      const user = db.login(username, password);
      if (user) {
        window.location.hash = '/';
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-8 text-center space-y-4">
          <div className="bg-teal-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-500/30">
            <Dog className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SISBEM</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-widest">Sistema de Bem-Estar Animal</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">Acesso Restrito</h2>
            <p className="text-slate-500 text-sm">Entre com suas credenciais de servidor.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Seu login"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Entrar no Sistema'
            )}
          </button>

          <div className="text-center pt-4 border-t border-slate-100">
             <p className="text-[10px] text-slate-400 uppercase font-medium">Uso exclusivo do Centro de Bem-Estar Animal</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
