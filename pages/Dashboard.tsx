import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { AnimalCondicao } from '../types';
import { fetchDashboardMetrics, DashboardMetrics } from '../src/lib/supabaseQueries';
import { 
  Dog, Cat, Calendar, ClipboardCheck, Clock, MapPin, Camera, Stethoscope, Heart, 
  FileText, Scissors, RotateCw, CheckCircle2, AlertCircle, WifiOff, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'sincronizado' | 'atualizando' | 'offline' | 'erro'>('atualizando');
  const [lastSyncDate, setLastSyncDate] = useState<Date | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const loadOfficialMetrics = async (isManual = false) => {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('atualizando');
    if (isManual) setFeedbackMessage(null);

    try {
      const data = await fetchDashboardMetrics();
      if (!isMountedRef.current) return;
      setMetrics(data);
      const now = new Date();
      setLastSyncDate(now);
      setSyncStatus('sincronizado');
      if (isManual) {
        setFeedbackMessage({ type: 'success', text: 'Indicadores oficiais atualizados com sucesso!' });
        setTimeout(() => setFeedbackMessage(null), 3000);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar métricas oficiais do Dashboard:', err);
      if (!isMountedRef.current) return;
      setSyncStatus('erro');
      if (isManual) {
        setFeedbackMessage({ type: 'error', text: 'Não foi possível consultar o servidor central. Verifique a conexão.' });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  };

  const scheduleDebouncedRefresh = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        loadOfficialMetrics(false);
      }
    }, 400);
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadOfficialMetrics(false);

    const handleReconcile = () => loadOfficialMetrics(false);
    const handleOnline = () => loadOfficialMetrics(false);
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('sisbem-animals-changed', scheduleDebouncedRefresh);
    window.addEventListener('sisbem-surgeries-changed', scheduleDebouncedRefresh);
    window.addEventListener('sisbem-occupations-changed', scheduleDebouncedRefresh);
    window.addEventListener('sisbem-reconcile', handleReconcile);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', scheduleDebouncedRefresh);

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      window.removeEventListener('sisbem-animals-changed', scheduleDebouncedRefresh);
      window.removeEventListener('sisbem-surgeries-changed', scheduleDebouncedRefresh);
      window.removeEventListener('sisbem-occupations-changed', scheduleDebouncedRefresh);
      window.removeEventListener('sisbem-reconcile', handleReconcile);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', scheduleDebouncedRefresh);
    };
  }, []);

  const cards = [
    { label: 'Total em Acolhimento', value: metrics?.total ?? 0, icon: ClipboardCheck, color: 'bg-indigo-500' },
    { label: 'Fila Cirúrgica / Agendadas', value: metrics?.cirurgiasAgendadas ?? 0, icon: Scissors, color: 'bg-teal-600', link: '/cirurgias/fila' },
    { label: 'Não Castrados (Pendentes)', value: metrics?.naoCastrados ?? 0, icon: Scissors, color: 'bg-amber-500', link: '/cirurgias/fila' },
    { label: 'Em Tratamento', value: metrics?.emTratamento ?? 0, icon: Stethoscope, color: 'bg-blue-600' },
    { label: 'Para Adoção', value: metrics?.disponivelAdocao ?? 0, icon: Heart, color: 'bg-emerald-500' },
    { label: 'Resgates (Mês)', value: metrics?.resgatesMes ?? 0, icon: Calendar, color: 'bg-slate-700' },
  ];

  const recentList = metrics?.recentRescues || [];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Painel de Controle Interno</h2>
            {/* Indicador Discreto de Sincronização */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
              syncStatus === 'sincronizado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              syncStatus === 'atualizando' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
              syncStatus === 'offline' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {syncStatus === 'sincronizado' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              {syncStatus === 'atualizando' && <Loader2 size={11} className="animate-spin text-indigo-600" />}
              {syncStatus === 'offline' && <WifiOff size={11} className="text-amber-600" />}
              {syncStatus === 'erro' && <AlertCircle size={11} className="text-rose-600" />}
              <span>
                {syncStatus === 'sincronizado' ? (lastSyncDate ? `Sincronizado • ${format(lastSyncDate, 'HH:mm:ss')}` : 'Sincronizado') :
                 syncStatus === 'atualizando' ? 'Atualizando...' :
                 syncStatus === 'offline' ? 'Sem conexão' :
                 'Falha na sincronização'}
              </span>
            </div>
          </div>
          <p className="text-slate-500">Visão geral das atividades e ocupação atual do Centro baseada na base oficial do Supabase.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão de Atualização Manual Oficial */}
          <button
            type="button"
            onClick={() => loadOfficialMetrics(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Consultar indicadores em tempo real no Supabase"
          >
            <RotateCw size={14} className={isSyncing ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar Informações'}</span>
          </button>

          <Link
            to="/relatorios"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <FileText size={16} /> Emitir Relatórios
          </Link>
          <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200">
            {format(new Date(), "eeee, d 'de' MMMM", { locale: ptBR })}
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all animate-in fade-in duration-200 ${
          feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const CardContent = (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all group h-full">
              <div className={`${card.color} p-3 rounded-xl shadow-inner group-hover:scale-110 transition-transform`}>
                <Icon className="text-white" size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{card.label}</p>
                <p className="text-2xl font-black text-slate-900">{card.value}</p>
              </div>
            </div>
          );

          if (card.link) {
            return (
              <Link key={idx} to={card.link} className="block transition-transform hover:-translate-y-0.5">
                {CardContent}
              </Link>
            );
          }

          return (
            <div key={idx}>
              {CardContent}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Clock size={18} className="text-teal-600" /> Resgates Mais Recentes</h3>
          {metrics && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Fonte Oficial: Supabase ({recentList.length} registros exibidos)
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Animal</th>
                <th className="px-6 py-4">Status Atual</th>
                <th className="px-6 py-4">Local do Resgate</th>
                <th className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentList.map((animal) => (
                <tr key={animal.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => window.location.hash = `#/animais/ficha/${animal.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-slate-300">
                        {animal.foto ? (
                          <img src={animal.foto} alt={animal.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Camera size={14} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors text-sm">{animal.nome}</div>
                        <div className="text-[10px] font-medium text-slate-400">{animal.raca} • {animal.especie}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      animal.condicao === AnimalCondicao.DISPONIVEL_ADOCAO ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      animal.condicao === AnimalCondicao.EM_TRATAMENTO ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      animal.condicao === AnimalCondicao.SOLTURA ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      animal.condicao === AnimalCondicao.ACOLHIDO ? 'bg-amber-50 text-amber-700 border-amber-300' :
                      animal.condicao === AnimalCondicao.AGUARDANDO_ATENDIMENTO ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      animal.condicao === AnimalCondicao.OBITO ? 'bg-slate-900 text-white border-slate-900' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>{animal.condicao}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="truncate max-w-[200px]">{animal.localResgate}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">
                    {format(new Date(animal.dataResgate), 'dd/MM/yyyy')}
                  </td>
                </tr>
              ))}
              {recentList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    {isSyncing ? 'Carregando dados oficiais do Supabase...' : 'Nenhum animal cadastrado no sistema.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
