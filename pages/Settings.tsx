
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { KennelConfig, KennelType } from '../types';
import { Settings, Save, AlertTriangle, CheckCircle2, Info, RefreshCw, Database, Sparkles } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<KennelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    setConfigs(db.getKennelConfigs());
  }, []);

  const handleCountChange = (type: KennelType, value: string) => {
    const num = parseInt(value) || 0;
    setConfigs(prev => prev.map(c => c.type === type ? { ...c, count: num } : c));
  };

  const handleCapacityChange = (type: KennelType, value: string) => {
    const num = parseInt(value) || 0;
    setConfigs(prev => prev.map(c => c.type === type ? { ...c, capacity: num } : c));
  };

  const handleResetAndSeed = () => {
    if (window.confirm('Deseja recarregar o banco de dados completo de testes? Serão gerados 18 animais diversificados (cães, gatos, castrados e não castrados, com tutor e solicitantes), cirurgias gerais e castrações, prontuários detalhados, acomodações em baias e gatis.')) {
      setSeedingLoading(true);
      try {
        db.resetAndSeedAllData();
        setConfigs(db.getKennelConfigs());
        setMessage({ 
          type: 'success', 
          text: 'Banco de dados de testes gerado com sucesso! Foram cadastrados 18 animais, múltiplos tutores, ONGs, órgãos públicos, cirurgias diversas e prontuários clínicos.' 
        });
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Erro ao gerar dados de teste: ' + err.message });
      } finally {
        setSeedingLoading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      // Verificação de ocupação antes de reduzir
      const kennels = db.getKennels();
      const occupations = db.getOccupations();
      
      let hasError = false;
      configs.forEach(cfg => {
        const typeKennels = kennels.filter(k => k.type === cfg.type);
        if (cfg.count < typeKennels.length) {
          // Usuário quer reduzir a quantidade de baias desse tipo
          // Verificamos se as baias que seriam removidas (do final da lista) estão ocupadas
          const toRemove = typeKennels.slice(cfg.count);
          const occupied = toRemove.some(k => occupations.some(o => o.kennelId === k.id && !o.exitDate));
          if (occupied) {
            setMessage({ type: 'error', text: `Não é possível reduzir a quantidade de ${cfg.type} pois as unidades a serem removidas possuem animais alocados.` });
            hasError = true;
          }
        }
      });

      if (!hasError) {
        db.saveKennelConfigs(configs);
        setMessage({ type: 'success', text: 'Configurações de infraestrutura atualizadas com sucesso!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-slate-400" /> Configurações do Centro
        </h2>
        <p className="text-slate-500">Ajuste as capacidades físicas, quantitativas das baias e gerencie os dados do sistema.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Card de Geração de Cadastros de Teste */}
      <div className="bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-6 md:p-8 rounded-2xl shadow-sm border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <Sparkles size={18} className="text-indigo-600" />
            <span>Dados de Demonstração & Testes Abrangentes</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Cadastros de Teste para Todas as Funcionalidades
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Popula o sistema com <strong>18 animais</strong> variados (cães e gatos, filhotes a idosos, machos e fêmeas, castrados e não-castrados), <strong>tutores</strong> com CadÚnico, <strong>ONGs e órgãos públicos</strong>, <strong>cirurgias</strong> de castração e cirurgias gerais (agendadas e realizadas), <strong>prontuários clínicos</strong> com prescrições e <strong>acomodações</strong> em baias e gatis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAndSeed}
          disabled={seedingLoading}
          className="shrink-0 flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Database size={16} />
          {seedingLoading ? 'Gerando Cadastros...' : 'Gerar Cadastros de Teste'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8">
          <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800">
            <Info size={20} className="shrink-0" />
            <p className="text-xs leading-relaxed">
              Alterar a <strong>Quantidade</strong> criará ou removerá unidades físicas do inventário. 
              Alterar a <strong>Capacidade</strong> mudará quantas vagas cada unidade daquele tipo possui individualmente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {configs.map(cfg => (
              <div key={cfg.type} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b pb-2">{cfg.type}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Quantidade Total</label>
                    <input 
                      type="number" 
                      min="0"
                      value={cfg.count} 
                      onChange={e => handleCountChange(cfg.type, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Vagas p/ Unidade</label>
                    <input 
                      type="number" 
                      min="1"
                      value={cfg.capacity} 
                      onChange={e => handleCapacityChange(cfg.type, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button 
            type="submit" 
            disabled={loading}
            className="flex items-center gap-2 px-10 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Save size={18} /> {loading ? 'Sincronizando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
