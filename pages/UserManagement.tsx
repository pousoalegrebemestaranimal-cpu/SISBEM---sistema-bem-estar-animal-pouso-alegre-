
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { registerWithSupabase } from '../src/lib/supabase';
import { Users, UserPlus, Trash2, ShieldAlert, CheckCircle2, IdCard, Lock, Globe, AlertTriangle, X, ShieldCheck } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [usersList, setUsersList] = useState<any[]>(() => db.getUsers());

  // Modal de exclusão in-app (sem usar window.confirm que é bloqueado em iframes)
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [protectedAdminNotice, setProtectedAdminNotice] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const currentUser = useMemo(() => db.getCurrentUser(), []);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'OPERATOR' as 'ADMIN' | 'OPERATOR' | 'VETERINARIO',
    crmv: '',
    matricula: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Password Match Validation
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas digitadas não coincidem.' });
      return;
    }

    setLoading(true);

    try {
      // Se o usuário digitou um e-mail, sincroniza também com o Supabase Auth
      let supabaseMsg = '';
      if (formData.username.includes('@')) {
        const sbRes = await registerWithSupabase(formData.username, formData.password, formData.name, formData.role);
        if (sbRes.success) {
          supabaseMsg = ' Conta sincronizada no Supabase Auth.';
        } else if (sbRes.error) {
          console.warn('Aviso ao sincronizar com Supabase:', sbRes.error);
        }
      }

      // Create a copy without confirmPassword to save in DB
      const { confirmPassword, ...dataToSave } = formData;
      db.saveUser(dataToSave);
      
      setMessage({ type: 'success', text: `Usuário cadastrado com sucesso!${supabaseMsg}` });
      setFormData({ 
        name: '', 
        username: '', 
        password: '', 
        confirmPassword: '',
        role: 'OPERATOR', 
        crmv: '', 
        matricula: '' 
      });
      setUsersList(db.getUsers());
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao cadastrar usuário.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (user: any) => {
    if (user.username === 'admin') {
      setProtectedAdminNotice(true);
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    setDeletingLoading(true);

    try {
      // Exclui por id e por username para garantir remoção completa
      db.deleteUser(userToDelete.id);
      if (userToDelete.username) {
        db.deleteUser(userToDelete.username);
      }

      const updated = db.getUsers();
      setUsersList(updated);
      setMessage({
        type: 'success',
        text: `O acesso do servidor "${userToDelete.name}" (@${userToDelete.username}) foi removido com sucesso.`
      });

      const wasSelf = currentUser && (
        currentUser.id === userToDelete.id || 
        currentUser.username === userToDelete.username
      );

      setUserToDelete(null);

      if (wasSelf) {
        db.logout();
        window.location.hash = '/login';
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erro ao excluir usuário.' });
    } finally {
      setDeletingLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'VETERINARIO': return 'Médico Veterinário';
      case 'OPERATOR': return 'Operador';
      default: return role;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Credenciais</h2>
        <p className="text-slate-500">Controle quem tem acesso ao sistema interno SISBEM.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <UserPlus size={20} className="text-teal-600" />
            <h3 className="font-bold text-slate-900">Novo Servidor</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Completo</label>
              <input 
                type="text" required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Usuário (Login)</label>
              <input 
                type="text" required
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senha Provisória</label>
                <input 
                  type="password" required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repetir Senha</label>
                <input 
                  type="password" required
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 text-sm transition-colors ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword 
                      ? 'bg-red-50 border-red-300 focus:ring-red-500' 
                      : 'bg-slate-50 border-slate-200 focus:ring-teal-500'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cargo / Nível</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as any})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="OPERATOR">Operador (Acesso padrão)</option>
                <option value="VETERINARIO">Médico Veterinário</option>
                <option value="ADMIN">Administrador (Acesso total)</option>
              </select>
            </div>

            {/* Conditional Extra Fields */}
            {(formData.role === 'VETERINARIO' || formData.role === 'ADMIN') && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                {formData.role === 'VETERINARIO' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Número do CRMV</label>
                    <input 
                      type="text" required
                      placeholder="Ex: 12345/UF"
                      value={formData.crmv}
                      onChange={e => setFormData({...formData, crmv: e.target.value})}
                      className="w-full px-3 py-2 bg-teal-50/30 border border-teal-100 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Número da Matrícula</label>
                  <input 
                    type="text" required
                    placeholder="Ex: 987654"
                    value={formData.matricula}
                    onChange={e => setFormData({...formData, matricula: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-50/30 border border-teal-100 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Cadastrar Servidor'}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <Users size={20} className="text-slate-400" />
            <h3 className="font-bold text-slate-900">Usuários Ativos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome / Login</th>
                  <th className="px-6 py-4">Nível de Acesso / Info</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                      <div className="text-xs text-slate-400">@{user.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          user.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 
                          user.role === 'VETERINARIO' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {getRoleLabel(user.role)}
                        </span>
                        {(user.role === 'VETERINARIO' || user.role === 'ADMIN') && (
                          <div className="text-[9px] text-slate-500 space-y-0.5">
                            {user.role === 'VETERINARIO' && <p><strong>CRMV:</strong> {user.crmv || '-'}</p>}
                            <p><strong>Matrícula:</strong> {user.matricula || '-'}</p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center">
                        {user.username === 'admin' ? (
                          <button
                            type="button"
                            onClick={() => setProtectedAdminNotice(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold border border-amber-200 transition-colors cursor-pointer"
                            title="Credencial mestre protegida pelo sistema"
                          >
                            <ShieldCheck size={13} className="text-amber-600" />
                            <span>Protegido</span>
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handleDeleteClick(user)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer group"
                            title={`Remover acesso de ${user.name}`}
                          >
                            <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Servidor */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Excluir Servidor</h3>
                  <p className="text-xs text-slate-500">Revogação de acesso ao SISBEM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nome Completo:</span>
                <span className="font-bold text-slate-900">{userToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Usuário / Login:</span>
                <span className="font-mono font-bold text-slate-800">@{userToDelete.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nível de Acesso:</span>
                <span className="font-semibold text-slate-800">{getRoleLabel(userToDelete.role)}</span>
              </div>

              {currentUser && (currentUser.id === userToDelete.id || currentUser.username === userToDelete.username) && (
                <div className="mt-2 pt-2.5 border-t border-slate-200 flex items-start gap-2 text-amber-800 bg-amber-50 p-2.5 rounded-lg">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Atenção:</strong> Você está excluindo o seu próprio usuário logado no momento. Se confirmar, sua sessão será encerrada e você será desconectado.
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tem certeza de que deseja remover este acesso? Esta ação é definitiva e removerá as permissões deste servidor.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deletingLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingLoading}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-red-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{deletingLoading ? 'Removendo...' : 'Sim, Excluir Usuário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Administrador Protegido */}
      {protectedAdminNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} className="text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Administrador Mestre Protegido</h3>
                  <p className="text-xs text-slate-500">Regra de Segurança do SISBEM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProtectedAdminNotice(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O usuário <strong>admin</strong> é a credencial mestre essencial para a administração e recuperação do sistema. Por segurança e integridade das políticas internas, ele não pode ser removido.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setProtectedAdminNotice(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
