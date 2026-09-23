
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { registerWithSupabase, supabase } from '../src/lib/supabase';
import { mapUserToSupabase } from '../src/lib/supabaseSync';
import { hashPassword } from '../src/lib/authCrypto';
import { 
  Users, UserPlus, Trash2, ShieldAlert, CheckCircle2, IdCard, Lock, Globe, 
  AlertTriangle, X, ShieldCheck, Database, RefreshCw, Copy, Check, ExternalLink, Code2, Terminal, KeyRound
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [usersList, setUsersList] = useState<any[]>(() => db.getUsers());

  // Modal de alteração de senha
  const [userToChangePassword, setUserToChangePassword] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordMessage, setChangePasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Modal de exclusão in-app (sem usar window.confirm que é bloqueado em iframes)
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [protectedAdminNotice, setProtectedAdminNotice] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Estado da Sincronização e Diagnóstico Supabase
  const [supabaseUsersCount, setSupabaseUsersCount] = useState<number | null>(null);
  const [supabaseTableStatus, setSupabaseTableStatus] = useState<'checking' | 'exists' | 'missing' | 'error'>('checking');
  const [supabaseErrorDetails, setSupabaseErrorDetails] = useState<string | null>(null);
  const [syncingSupabaseUsers, setSyncingSupabaseUsers] = useState(false);
  const [syncSupabaseMessage, setSyncSupabaseMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const currentUser = useMemo(() => db.getCurrentUser(), []);

  const sqlFixUsersRls = `-- ==============================================================================
-- SISBEM: LIBERAR ACESSO À TABELA DE USUÁRIOS NO SUPABASE (RLS)
-- Execute este script no menu "SQL Editor" do painel do Supabase:
-- ==============================================================================

-- 1. Garante que a tabela public.users existe
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE,
    email TEXT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VETERINARIO')),
    crmv TEXT,
    matricula TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilita RLS e cria política irrestrita de leitura/escrita
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos os usuários autenticados" ON public.users;
DROP POLICY IF EXISTS "Permitir acesso completo a users" ON public.users;

CREATE POLICY "Permitir acesso completo a users" 
ON public.users 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Notifica o PostgREST para recarregar o cache de esquemas
NOTIFY pgrst, 'reload schema';`;

  // Atualiza lista unificada de usuários (Local + Supabase)
  const refreshUsers = async () => {
    const localUsers = db.getUsers() || [];
    try {
      const { data: remoteUsers } = await supabase
        .from('users')
        .select('id, name, username, role, crmv, matricula, email, uid');
      if (remoteUsers && remoteUsers.length > 0) {
        const map = new Map<string, any>();
        localUsers.forEach((u: any) => map.set(u.id, u));
        remoteUsers.forEach((r: any) => {
          const existing = map.get(r.id);
          map.set(r.id, {
            id: r.id,
            name: r.name,
            username: r.username,
            role: r.role,
            crmv: r.crmv || undefined,
            matricula: r.matricula || undefined,
            email: r.email || undefined,
            uid: r.uid || undefined,
            password: existing?.password || undefined,
            syncedWithSupabase: true
          });
        });
        const merged = Array.from(map.values());
        setUsersList(merged);
        return;
      }
    } catch {
      // ignore
    }
    setUsersList(localUsers);
  };

  // Função para verificar se a tabela users existe no Supabase e quantos registros tem
  const checkSupabaseUsers = async () => {
    setSupabaseTableStatus('checking');
    setSupabaseErrorDetails(null);
    try {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('not find the table')) {
          setSupabaseTableStatus('missing');
          setSupabaseErrorDetails('Tabela public.users não foi encontrada no banco do Supabase.');
        } else {
          setSupabaseTableStatus('error');
          setSupabaseErrorDetails(error.message);
        }
        setSupabaseUsersCount(null);
      } else {
        setSupabaseTableStatus('exists');
        setSupabaseUsersCount(count ?? 0);
      }
    } catch (err: any) {
      setSupabaseTableStatus('error');
      setSupabaseErrorDetails(err?.message || 'Falha ao contatar Supabase');
    }
  };

  useEffect(() => {
    checkSupabaseUsers();
    refreshUsers();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlFixUsersRls);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Sincroniza todos os usuários locais para o Supabase com senhas seguras
  const handleSyncAllUsersToSupabase = async () => {
    setSyncingSupabaseUsers(true);
    setSyncSupabaseMessage(null);
    try {
      const localUsers = db.getUsers();
      if (localUsers.length === 0) {
        setSyncSupabaseMessage({ type: 'error', text: 'Nenhum usuário local cadastrado para sincronizar.' });
        return;
      }

      // Senhas padrão caso não haja senha cadastrada no objeto
      const defaultPasswords: Record<string, string> = {
        admin: 'admin123',
        vet01: 'vet123',
        vet02: 'vet123',
        vet03: 'vet123',
        op01: 'op123'
      };

      const payload = await Promise.all(localUsers.map(async (u: any) => {
        let credHash = u.uid || null;
        if (!credHash) {
          const pass = u.password || defaultPasswords[u.username] || '123456';
          credHash = await hashPassword(pass, u.id);
        }
        return mapUserToSupabase(u, credHash);
      }));

      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });

      if (error) {
        if (error.message.includes('row-level security') || error.code === '42501') {
          setSyncSupabaseMessage({ 
            type: 'error', 
            text: `Erro de Permissão (RLS): ${error.message}. Execute o script SQL abaixo no SQL Editor do Supabase para liberar o acesso.` 
          });
        } else {
          setSyncSupabaseMessage({ 
            type: 'error', 
            text: `Erro ao enviar usuários: ${error.message}` 
          });
        }
      } else {
        setSyncSupabaseMessage({ 
          type: 'success', 
          text: `Sucesso! ${localUsers.length} usuários locais foram sincronizados na tabela "public.users" do Supabase com credenciais ativas.` 
        });
        await checkSupabaseUsers();
        await refreshUsers();
      }
    } catch (err: any) {
      setSyncSupabaseMessage({ 
        type: 'error', 
        text: err?.message || 'Erro inesperado na sincronização.' 
      });
    } finally {
      setSyncingSupabaseUsers(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
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

    if (formData.password.length < 4) {
      setMessage({ type: 'error', text: 'A senha provisória deve ter pelo menos 4 caracteres.' });
      return;
    }

    setLoading(true);

    try {
      const newUserId = crypto.randomUUID();
      const cleanPass = formData.password.trim();
      const pwdHash = await hashPassword(cleanPass, newUserId);

      // Se o usuário digitou um e-mail, sincroniza também com o Supabase Auth
      let supabaseMsg = '';
      const emailToRegister = formData.email.trim() || (formData.username.includes('@') ? formData.username : '');
      if (emailToRegister) {
        const sbRes = await registerWithSupabase(emailToRegister, cleanPass, formData.name, formData.role);
        if (sbRes.success) {
          supabaseMsg = ' Conta sincronizada no Supabase Auth.';
        } else if (sbRes.error) {
          console.warn('Aviso ao sincronizar com Supabase Auth:', sbRes.error);
        }
      }

      // Create object to save in DB and Supabase
      const { confirmPassword, ...dataToSave } = formData;
      const userRecord = {
        ...dataToSave,
        id: newUserId,
        email: emailToRegister || undefined,
        password: cleanPass,
        uid: pwdHash,
      };

      db.saveUser(userRecord);

      // Salva explicitamente no Supabase
      await supabase.from('users').upsert([mapUserToSupabase(userRecord, pwdHash)]);
      
      setMessage({ type: 'success', text: `Usuário cadastrado com sucesso!${supabaseMsg} Credenciais ativas para login pelo site.` });
      setFormData({ 
        name: '', 
        username: '', 
        email: '',
        password: '', 
        confirmPassword: '',
        role: 'OPERATOR', 
        crmv: '', 
        matricula: '' 
      });
      await refreshUsers();
      await checkSupabaseUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao cadastrar usuário.' });
    } finally {
      setLoading(false);
    }
  };

  // Funções para Alteração de Senha
  const handleOpenChangePassword = (user: any) => {
    setUserToChangePassword(user);
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setChangePasswordMessage(null);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToChangePassword) return;

    if (newPasswordInput.length < 4) {
      setChangePasswordMessage({ type: 'error', text: 'A senha deve conter no mínimo 4 caracteres.' });
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePasswordMessage({ type: 'error', text: 'A confirmação de senha não confere.' });
      return;
    }

    setChangePasswordLoading(true);
    setChangePasswordMessage(null);

    try {
      const cleanPass = newPasswordInput.trim();
      const newHash = await hashPassword(cleanPass, userToChangePassword.id);

      // 1. Atualiza no Supabase
      const { error: sbErr } = await supabase
        .from('users')
        .update({ uid: newHash })
        .eq('id', userToChangePassword.id);

      if (sbErr) {
        console.warn('Aviso ao atualizar senha no Supabase:', sbErr.message);
      }

      // 2. Atualiza localmente
      const updatedUser = {
        ...userToChangePassword,
        password: cleanPass,
        uid: newHash,
      };
      db.saveUser(updatedUser);

      setChangePasswordMessage({
        type: 'success',
        text: `Senha de "${userToChangePassword.name}" atualizada com sucesso! O acesso pelo site já está liberado.`
      });

      setTimeout(() => {
        setUserToChangePassword(null);
        refreshUsers();
      }, 1600);
    } catch (err: any) {
      setChangePasswordMessage({ type: 'error', text: err?.message || 'Erro ao alterar senha.' });
    } finally {
      setChangePasswordLoading(false);
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
                placeholder="ex: joaosilva"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">E-mail (opcional)</label>
              <input 
                type="email"
                placeholder="ex: joao@gmail.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value.toLowerCase().trim()})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
              <p className="text-[10px] text-slate-400">Permite login no site tanto com o usuário quanto com o e-mail.</p>
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
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenChangePassword(user)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all cursor-pointer group"
                          title={`Alterar senha de ${user.name}`}
                        >
                          <KeyRound size={16} className="group-hover:scale-110 transition-transform text-slate-500 hover:text-teal-600" />
                        </button>

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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer group"
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

      {/* Card de Diagnóstico e Sincronização Supabase */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Database className="text-indigo-600" size={22} />
              <h3 className="text-lg font-bold text-slate-900">Sincronização com Supabase (Tabela public.users)</h3>
              {supabaseTableStatus === 'checking' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  <RefreshCw size={11} className="animate-spin" /> Verificando...
                </span>
              ) : supabaseTableStatus === 'exists' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Tabela Ativa ({supabaseUsersCount ?? 0} no Supabase)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertTriangle size={12} className="text-amber-600" />
                  RLS / Permissão Pendente
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              O SISBEM armazena os servidores internamente e sincroniza com a tabela relacional <code className="font-mono text-indigo-700 font-bold">public.users</code> no PostgreSQL do Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={checkSupabaseUsers}
              disabled={supabaseTableStatus === 'checking'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Verificar se a tabela users responde no Supabase"
            >
              <RefreshCw size={13} className={supabaseTableStatus === 'checking' ? 'animate-spin' : ''} />
              Verificar Tabela
            </button>
            <button
              type="button"
              onClick={handleSyncAllUsersToSupabase}
              disabled={syncingSupabaseUsers}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {syncingSupabaseUsers ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />}
              {syncingSupabaseUsers ? 'Sincronizando...' : 'Sincronizar Usuários no Supabase'}
            </button>
          </div>
        </div>

        {syncSupabaseMessage && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
            syncSupabaseMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {syncSupabaseMessage.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <ShieldAlert size={18} className="shrink-0 mt-0.5" />}
            <div>
              <p className="font-bold">{syncSupabaseMessage.text}</p>
            </div>
          </div>
        )}

        {/* Guia explicativo: Onde encontrar os usuários no Supabase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Database size={15} className="text-indigo-600" />
              <span>1. Table Editor &gt; Tabela "users" (public)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              No menu lateral esquerdo do Supabase, clique em <strong>Table Editor</strong> e certifique-se de estar no esquema <strong>public</strong>. A tabela chama-se <strong>users</strong> e guarda o cadastro institucional (nome, login, papel, CRMV e matrícula).
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Lock size={15} className="text-amber-600" />
              <span>2. Authentication &gt; Users (auth.users)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              O menu <strong>Authentication</strong> guarda apenas contas que possuem <strong>e-mail e senha</strong> registrados via Supabase Auth. Os servidores locais (como <em>admin</em>, <em>vet01</em>) ficam registrados na tabela do Table Editor.
            </p>
          </div>
        </div>

        {/* Script SQL para liberar permissões da tabela users */}
        <div className="bg-slate-900 text-slate-300 p-4 md:p-5 rounded-xl text-xs space-y-3 font-mono">
          <div className="flex items-center justify-between text-slate-400 font-sans text-xs border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-emerald-400" />
              <span className="font-bold text-slate-200">
                A tabela não aparece ou deu erro de RLS no Supabase?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://supabase.com/dashboard/project/azufmdknlvbfaxnfiwwg/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
              >
                Abrir SQL Editor <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[11px] rounded-lg transition cursor-pointer"
              >
                {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                {copiedSql ? 'Copiado!' : 'Copiar Script SQL'}
              </button>
            </div>
          </div>

          <p className="font-sans text-[11px] text-slate-400 leading-relaxed">
            Se a tabela <code className="text-emerald-400">users</code> estiver vazia ou com mensagem de <em>"violates row-level security"</em>, copie o script abaixo, cole no menu <strong>SQL Editor</strong> do painel Supabase e clique em <strong>Run</strong>:
          </p>

          <pre className="p-3 bg-slate-950 rounded-lg text-[10px] text-slate-300 max-h-44 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed border border-slate-800">
            {sqlFixUsersRls}
          </pre>
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

      {/* Modal de Alteração de Senha */}
      {userToChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-teal-600">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <KeyRound size={22} className="text-teal-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Alterar Senha de Acesso</h3>
                  <p className="text-xs text-slate-500">
                    Servidor: <strong>{userToChangePassword.name}</strong> (@{userToChangePassword.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToChangePassword(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {changePasswordMessage && (
              <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                changePasswordMessage.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {changePasswordMessage.type === 'success' ? <Check size={16} className="shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 text-red-600 mt-0.5" />}
                <p>{changePasswordMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleSaveNewPassword} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nova Senha</label>
                <input 
                  type="password"
                  required
                  placeholder="Mínimo 4 caracteres"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confirmar Nova Senha</label>
                <input 
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirmNewPasswordInput}
                  onChange={e => setConfirmNewPasswordInput(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 text-sm transition-colors ${
                    confirmNewPasswordInput && newPasswordInput !== confirmNewPasswordInput 
                      ? 'bg-red-50 border-red-300 focus:ring-red-500' 
                      : 'bg-slate-50 border-slate-200 focus:ring-teal-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToChangePassword(null)}
                  disabled={changePasswordLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changePasswordLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-teal-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound size={14} />
                  <span>{changePasswordLoading ? 'Salvando...' : 'Salvar Nova Senha'}</span>
                </button>
              </div>
            </form>
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
