
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { Users, UserPlus, Trash2, ShieldAlert, CheckCircle2, IdCard, Lock } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [usersList, setUsersList] = useState(db.getUsers());

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Password Match Validation
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas digitadas não coincidem.' });
      return;
    }

    setLoading(true);

    try {
      // Create a copy without confirmPassword to save in DB
      const { confirmPassword, ...dataToSave } = formData;
      db.saveUser(dataToSave);
      
      setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
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

  const handleDelete = (id: string, username: string) => {
    if (username === 'admin') {
      alert('O usuário administrador principal (admin) não pode ser removido por questões de segurança do sistema.');
      return;
    }
    
    if (confirm(`Deseja realmente remover o acesso de "${username}"?`)) {
      try {
        db.deleteUser(id);
        setUsersList(db.getUsers());
        setMessage({ type: 'success', text: 'Acesso removido com sucesso.' });
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      }
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
                      <div className="flex justify-center">
                        <button 
                          onClick={() => handleDelete(user.id, user.username)}
                          disabled={user.username === 'admin'}
                          className={`p-2 rounded transition-colors ${
                            user.username === 'admin' 
                            ? 'text-slate-200 cursor-not-allowed opacity-50' 
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={user.username === 'admin' ? "Administrador Mestre (Protegido)" : "Remover Acesso"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
