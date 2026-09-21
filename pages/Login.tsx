import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import {
  supabase,
  authenticateWithSupabase,
  registerWithSupabase,
  resendSupabaseConfirmation,
  resetSupabasePassword,
  testSupabaseConnection,
} from '../src/lib/supabase';
import {
  Dog,
  Lock,
  User as UserIcon,
  Mail,
  AlertCircle,
  CheckCircle2,
  Database,
  ArrowRight,
  Shield,
  KeyRound,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';

const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<'ADMIN' | 'OPERATOR' | 'VETERINARIO'>('ADMIN');
  const [regCrmv, setRegCrmv] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');

  // Feedback states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Supabase status
  const [supabaseOnline, setSupabaseOnline] = useState<boolean | null>(null);

  useEffect(() => {
    testSupabaseConnection().then(res => {
      setSupabaseOnline(res.success);
    });
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setUnconfirmedEmail(null);
  };

  // Submissão do Login (Supabase + Contingência Local)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    const cleanInput = identifier.trim();
    const isEmail = cleanInput.includes('@');

    try {
      if (isEmail) {
        // Tenta login com Supabase Auth
        const result = await authenticateWithSupabase(cleanInput, password);

        if (result.success && result.user) {
          db.setCurrentUser(result.user);
          window.location.hash = '/';
          return;
        }

        // Se o Supabase retornou que o e-mail não foi confirmado
        if (
          result.error?.toLowerCase().includes('email not confirmed') ||
          result.code === 'email_not_confirmed'
        ) {
          setUnconfirmedEmail(cleanInput);
          setError(
            'O usuário está cadastrado no Supabase, mas a confirmação de e-mail ainda está pendente.'
          );
          setLoading(false);
          return;
        }

        // Se o Supabase rejeitou credenciais, verifica contingência local
        const localUser = db.login(cleanInput, password);
        if (localUser) {
          window.location.hash = '/';
          return;
        }

        setError(
          'E-mail ou senha incorretos no Supabase. Verifique se a senha está correta ou se o usuário foi criado no projeto.'
        );
      } else {
        // Nome de usuário tradicional (ex: admin, vet01, etc.)
        const localUser = db.login(cleanInput, password);
        if (localUser) {
          window.location.hash = '/';
          return;
        }

        // Se não encontrou localmente, verifica se o usuário digitou sem @ mas é um email
        setError(
          'Usuário ou senha incorretos. Se você cadastrou o usuário no Supabase, digite o e-mail completo (ex: nome@gmail.com).'
        );
      }
    } catch (err: any) {
      // Fallback local em caso de erro de conexão
      const localUser = db.login(cleanInput, password);
      if (localUser) {
        window.location.hash = '/';
        return;
      }
      setError(err?.message || 'Erro ao processar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  // Submissão de Cadastro Direto no Supabase
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (regPassword.length < 6) {
      setError('A senha no Supabase deve conter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithSupabase(regEmail, regPassword, regName, regRole);

      if (!result.success) {
        setError(result.error || 'Erro ao registrar usuário no Supabase.');
        setLoading(false);
        return;
      }

      if (result.hasSession && result.user) {
        // Login automático imediato
        db.setCurrentUser(result.user);
        window.location.hash = '/';
        return;
      }

      if (result.needsEmailConfirmation) {
        setSuccess(
          `Usuário "${regEmail}" criado com sucesso no Supabase! Um e-mail de confirmação foi enviado. Caso prefira aprovar imediatamente sem e-mail, abra o Supabase (Authentication > Users) e clique em "Confirm user".`
        );
        setMode('login');
        setIdentifier(regEmail);
      } else {
        setSuccess('Usuário cadastrado com sucesso no Supabase! Você já pode entrar.');
        setMode('login');
        setIdentifier(regEmail);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  // Reenviar E-mail de Confirmação do Supabase
  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResendingEmail(true);
    try {
      const res = await resendSupabaseConfirmation(unconfirmedEmail);
      if (res.success) {
        setSuccess(`E-mail de confirmação reenviado para ${unconfirmedEmail}. Verifique sua caixa de entrada e spam.`);
        setUnconfirmedEmail(null);
      } else {
        setError(res.error || 'Falha ao reenviar e-mail de confirmação.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar.');
    } finally {
      setResendingEmail(false);
    }
  };

  // Recuperação de Senha
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const res = await resetSupabasePassword(forgotEmail);
      if (res.success) {
        setSuccess(`Link de redefinição de senha enviado para ${forgotEmail}! Verifique sua caixa de entrada.`);
        setForgotEmail('');
      } else {
        setError(res.error || 'Não foi possível solicitar redefinição de senha.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  // Preenchimento rápido para contingência
  const fillAdmin = () => {
    setIdentifier('admin');
    setPassword('admin');
    clearMessages();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transition-all">
        
        {/* Cabeçalho do App */}
        <div className="bg-slate-950 p-6 md:p-8 text-center relative">
          <div className="bg-teal-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-teal-500/20 mb-3">
            <Dog className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SISBEM</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-widest mt-0.5">
            Sistema de Bem-Estar Animal
          </p>

          {/* Status do Supabase */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <span className={`w-2 h-2 rounded-full ${supabaseOnline === false ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span>Supabase: <strong className="text-white font-mono">azufmdknlvbfaxnfiwwg</strong></span>
          </div>
        </div>

        {/* Abas / Alternador de Modo */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('login'); clearMessages(); }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <KeyRound size={14} />
            <span>Entrar</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('register'); clearMessages(); }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Shield size={14} />
            <span>Criar Acesso Supabase</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('forgot'); clearMessages(); }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'forgot'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <HelpCircle size={14} />
            <span>Recuperar</span>
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Mensagens de Sucesso e Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                {unconfirmedEmail && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendingEmail}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={12} className={resendingEmail ? 'animate-spin' : ''} />
                      {resendingEmail ? 'Reenviando...' : 'Reenviar E-mail de Confirmação'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-start gap-3">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <p className="font-medium leading-relaxed">{success}</p>
            </div>
          )}

          {/* Dica para Usuário Supabase Não Confirmado */}
          {unconfirmedEmail && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <Info size={14} />
                <span>Como liberar o usuário no Supabase:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                No painel do Supabase, acesse <strong>Authentication → Users</strong>, localize o usuário <strong>{unconfirmedEmail}</strong>, clique no menu de opções (...) e selecione <strong>Confirm User</strong>. Isso liberará o acesso imediatamente sem depender de link de e-mail.
              </p>
            </div>
          )}

          {/* MODO 1: ENTRAR */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Autenticação</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Entre com seu <strong>e-mail do Supabase</strong> ou <strong>usuário local</strong>.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    E-mail ou Usuário
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="seu-email@gmail.com ou admin"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="Sua senha secreta"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
                      tabIndex={-1}
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Botão Rápido de Contingência */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Acesso Local de Emergência:</span>
                <button
                  type="button"
                  onClick={fillAdmin}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-mono font-bold transition-all cursor-pointer"
                >
                  admin / admin
                </button>
              </div>
            </form>
          )}

          {/* MODO 2: CADASTRAR NO SUPABASE */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Novo Acesso no Supabase</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Cria uma conta real no Supabase Auth para a equipe do SISBEM.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Nome Completo</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="Ex: Dr. Roberto Santos ou Mariana"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">E-mail (Supabase)</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="pousoalegrebemestaranimal@gmail.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Senha (mínimo 6 dígitos)</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="w-full pl-11 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="Defina uma senha segura"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
                      tabIndex={-1}
                      title={showRegPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Perfil</label>
                    <select
                      value={regRole}
                      onChange={e => setRegRole(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-xs font-bold text-slate-800"
                    >
                      <option value="ADMIN">Administrador</option>
                      <option value="VETERINARIO">Médico Veterinário</option>
                      <option value="OPERATOR">Operador / Recepcionista</option>
                    </select>
                  </div>

                  {regRole === 'VETERINARIO' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">CRMV</label>
                      <input
                        type="text"
                        placeholder="Ex: 12345/MG"
                        value={regCrmv}
                        onChange={e => setRegCrmv(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield size={16} />
                    <span>Criar Conta no Supabase</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Ao cadastrar, o usuário será registrado no Supabase Auth do projeto <code className="text-slate-700 font-mono">azufmdknlvbfaxnfiwwg</code>.
              </p>
            </form>
          )}

          {/* MODO 3: RECUPERAR SENHA */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Recuperação de Senha</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Informe o e-mail cadastrado no Supabase para receber as instruções de recuperação.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">E-mail Cadastrado</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="seu-email@gmail.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enviar Link de Recuperação</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold text-center cursor-pointer"
              >
                Voltar para a tela de login
              </button>
            </form>
          )}

        </div>

        {/* Rodapé Informativo */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-slate-400" />
            <span>Centro de Bem-Estar Animal de Pouso Alegre</span>
          </div>
          <a
            href="https://supabase.com/dashboard/project/azufmdknlvbfaxnfiwwg/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-1"
          >
            <span>Painel Supabase</span>
            <ExternalLink size={11} />
          </a>
        </div>

      </div>
    </div>
  );
};

export default Login;
