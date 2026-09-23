
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { KennelConfig, KennelType } from '../types';
import { Settings, Save, AlertTriangle, CheckCircle2, Info, RefreshCw, Database, Sparkles, Copy, Check, Download, Terminal, Server, Code2, Layers, Globe, Key, Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY, testSupabaseConnection } from '../src/lib/supabase';
import { pullFromSupabaseToLocal } from '../src/lib/supabaseSync';
import { isBase64Image, migrateLegacyPhotosToStorage, ANIMAL_PHOTOS_BUCKET } from '../src/lib/storageService';

const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<KennelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [migratingPhotos, setMigratingPhotos] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ migrated: number; skipped: number; errors: string[] } | null>(null);

  const localAnimals = db.getAnimals();
  const base64PhotosCount = localAnimals.filter(a => isBase64Image(a.foto)).length;
  const storagePhotosCount = localAnimals.filter(a => a.foto && !isBase64Image(a.foto)).length;

  const handleMigratePhotos = async () => {
    if (base64PhotosCount === 0) {
      alert('Não há fotos em Base64 pendentes para migração.');
      return;
    }
    if (!window.confirm(`Deseja iniciar a migração de ${base64PhotosCount} foto(s) em Base64 para o Supabase Storage? O processo é seguro e manterá as fotos protegidas.`)) {
      return;
    }
    setMigratingPhotos(true);
    setMigrationResult(null);
    try {
      const res = await migrateLegacyPhotosToStorage(localAnimals, (current, total) => {
        setMigrationProgress({ current, total });
      });
      setMigrationResult(res);
      setMessage({ type: 'success', text: `Migração finalizada: ${res.migrated} fotos enviadas para o Supabase Storage com sucesso!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Erro durante migração: ' + err.message });
    } finally {
      setMigratingPhotos(false);
      setMigrationProgress(null);
    }
  };

  const handleSyncCloud = async () => {
    setSyncingCloud(true);
    try {
      await pullFromSupabaseToLocal(db);
      setConfigs(db.getKennelConfigs());
      setMessage({ type: 'success', text: 'Configurações e baias sincronizadas com o banco em tempo real!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Erro ao sincronizar com nuvem: ' + err.message });
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseTestResult(res);
    } catch (err: any) {
      setSupabaseTestResult({
        success: false,
        message: err?.message || 'Falha ao contatar endpoint do Supabase',
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleCopyText = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const migrationSql = `-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION INICIAL PARA SUPABASE / POSTGRESQL (12 TABELAS + RLS + ÍNDICES)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE TABLE IF NOT EXISTS public.solicitantes (
    id TEXT PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL,
    telefone TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('CIDADAO', 'ONG', 'PROTETOR', 'ORGAO_PUBLICO', 'DESCONHECIDO')),
    codigo_ong TEXT,
    responsavel TEXT,
    endereco TEXT,
    email TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tutores (
    id TEXT PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT,
    tem_cad_unico BOOLEAN NOT NULL DEFAULT FALSE,
    documento_cad_unico TEXT,
    data_cadastro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kennels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.animals (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    peso DOUBLE PRECISION NOT NULL DEFAULT 0,
    idade TEXT,
    cor_pelagem TEXT NOT NULL,
    especie TEXT NOT NULL CHECK (especie IN ('Cão', 'Gato')),
    raca TEXT NOT NULL,
    porte TEXT NOT NULL CHECK (porte IN ('Pequeno', 'Médio', 'Grande')),
    sexo TEXT NOT NULL CHECK (sexo IN ('Macho', 'Fêmea')),
    castrado BOOLEAN NOT NULL DEFAULT FALSE,
    microchipado BOOLEAN DEFAULT FALSE,
    numero_microchip TEXT,
    tem_tutor BOOLEAN NOT NULL DEFAULT FALSE,
    local_resgate TEXT NOT NULL,
    data_resgate TEXT NOT NULL,
    motivo TEXT DEFAULT '',
    data_cadastro TEXT NOT NULL,
    usuario_responsavel_id TEXT REFERENCES public.users(id),
    solicitante_id TEXT REFERENCES public.solicitantes(id),
    tutor_id TEXT REFERENCES public.tutores(id),
    condicao TEXT NOT NULL,
    resgate_samuvet BOOLEAN NOT NULL DEFAULT FALSE,
    responsavel_samuvet TEXT,
    foto TEXT,
    data_obito TEXT,
    causa_obito TEXT,
    data_soltura TEXT,
    local_soltura TEXT,
    data_adocao TEXT,
    adotante_nome TEXT,
    adotante_cpf TEXT,
    adotante_telefone TEXT,
    necessita_internacao BOOLEAN DEFAULT FALSE,
    tipo_acomodacao_sugerida TEXT,
    justificativa_internacao TEXT,
    data_internacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kennel_occupations (
    id TEXT PRIMARY KEY,
    kennel_id TEXT NOT NULL REFERENCES public.kennels(id) ON DELETE CASCADE,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    exit_date TEXT,
    vet_id TEXT NOT NULL,
    clinical_record_id TEXT,
    justification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clinical_records (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    veterinario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data_atendimento TEXT NOT NULL,
    inativo BOOLEAN NOT NULL DEFAULT FALSE,
    vacinas TEXT,
    parasitas TEXT,
    temperatura TEXT,
    peso TEXT,
    mucosa TEXT,
    palpacao_abdominal TEXT,
    hidratacao TEXT,
    ausculta_cardiaca TEXT,
    ausculta_pulmonar TEXT,
    frequencia_cardiaca TEXT,
    frequencia_respiratoria TEXT,
    observacoes_gerais TEXT,
    exames_solicitados TEXT,
    tratamento_ambulatorial TEXT,
    diagnostico_clinico TEXT,
    status_resultante TEXT NOT NULL,
    data_obito TEXT,
    causa_obito TEXT,
    data_soltura TEXT,
    local_soltura TEXT,
    recommended_kennel_type TEXT,
    accommodation_justification TEXT,
    necessita_internacao BOOLEAN DEFAULT FALSE,
    v10_aplicada BOOLEAN DEFAULT FALSE,
    v10_data TEXT,
    antirrabica_aplicada BOOLEAN DEFAULT FALSE,
    antirrabica_data TEXT,
    vermifugo_aplicado BOOLEAN DEFAULT FALSE,
    vermifugo_data TEXT,
    microchip_aplicado BOOLEAN DEFAULT FALSE,
    numero_microchip_aplicado TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    prontuario_id TEXT REFERENCES public.clinical_records(id) ON DELETE CASCADE,
    veterinario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    medicamento TEXT NOT NULL,
    dosagem TEXT NOT NULL,
    via TEXT NOT NULL,
    frequencia TEXT NOT NULL,
    duracao TEXT NOT NULL,
    observacoes TEXT,
    data_emissao TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    veterinario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    especialidade TEXT NOT NULL,
    motivo TEXT NOT NULL,
    local_sugerido TEXT,
    urgencia TEXT NOT NULL CHECK (urgencia IN ('BAIXA', 'MEDIA', 'ALTA', 'EMERGENCIA')),
    data_emissao TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.surgeries (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    data_agendada TEXT NOT NULL,
    horario TEXT,
    turno TEXT CHECK (turno IN ('MANHA', 'TARDE', 'INTEGRAL')),
    tipo_cirurgia TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Agendada', 'Em Pré-operatório', 'Realizada', 'Cancelada')),
    prioridade TEXT NOT NULL CHECK (prioridade IN ('Normal', 'Urgente', 'Fila de Espera')),
    veterinario_responsavel_id TEXT REFERENCES public.users(id),
    veterinario_responsavel_nome TEXT,
    observacoes_pre_operatorias TEXT,
    observacoes_pos_operatorias TEXT,
    receitas_pos_operatorias JSONB,
    data_realizacao TEXT,
    realizada_por_id TEXT REFERENCES public.users(id),
    realizada_por_nome TEXT,
    motivo_cancelamento TEXT,
    data_cadastro TEXT NOT NULL,
    usuario_criador_id TEXT NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.status_logs (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    data_alteracao TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES public.users(id),
    prontuario_id TEXT REFERENCES public.clinical_records(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_files (
    id TEXT PRIMARY KEY,
    prontuario_id TEXT NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
    nome_exame TEXT NOT NULL,
    arquivo TEXT NOT NULL,
    data_anexo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE ALTO DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_animals_condicao ON public.animals(condicao);
CREATE INDEX IF NOT EXISTS idx_animals_especie ON public.animals(especie);
CREATE INDEX IF NOT EXISTS idx_clinical_records_animal_id ON public.clinical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_animal_id ON public.surgeries(animal_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON public.surgeries(status);
CREATE INDEX IF NOT EXISTS idx_kennel_occupations_kennel_id ON public.kennel_occupations(kennel_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kennels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kennel_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_files ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE ACESSO COMPLETO (RLS)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir leitura para todos os usuários autenticados" ON public.users;
    DROP POLICY IF EXISTS "Permitir acesso completo a users" ON public.users;
    CREATE POLICY "Permitir acesso completo a users" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a animais" ON public.animals;
    CREATE POLICY "Permitir acesso completo a animais" ON public.animals FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a prontuários" ON public.clinical_records;
    CREATE POLICY "Permitir acesso completo a prontuários" ON public.clinical_records FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a cirurgias" ON public.surgeries;
    CREATE POLICY "Permitir acesso completo a cirurgias" ON public.surgeries FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a baias" ON public.kennels;
    CREATE POLICY "Permitir acesso completo a baias" ON public.kennels FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a ocupações" ON public.kennel_occupations;
    CREATE POLICY "Permitir acesso completo a ocupações" ON public.kennel_occupations FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a tutores" ON public.tutores;
    CREATE POLICY "Permitir acesso completo a tutores" ON public.tutores FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a solicitantes" ON public.solicitantes;
    CREATE POLICY "Permitir acesso completo a solicitantes" ON public.solicitantes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a prescrições" ON public.prescriptions;
    CREATE POLICY "Permitir acesso completo a prescrições" ON public.prescriptions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a encaminhamentos" ON public.referrals;
    CREATE POLICY "Permitir acesso completo a encaminhamentos" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a logs de status" ON public.status_logs;
    CREATE POLICY "Permitir acesso completo a logs de status" ON public.status_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir acesso completo a arquivos de exame" ON public.exam_files;
    CREATE POLICY "Permitir acesso completo a arquivos de exame" ON public.exam_files FOR ALL USING (true) WITH CHECK (true);
END $$;

-- CONFIGURAÇÃO DO SUPABASE STORAGE (BUCKET 'animal-photos' P/ CONTROLE DE EGRESS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('animal-photos', 'animal-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- POLÍTICAS DE ACESSO DO STORAGE PARA FOTOS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Fotos públicas para leitura" ON storage.objects;
    CREATE POLICY "Fotos públicas para leitura" ON storage.objects FOR SELECT USING (bucket_id = 'animal-photos');

    DROP POLICY IF EXISTS "Permitir upload de fotos" ON storage.objects;
    CREATE POLICY "Permitir upload de fotos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'animal-photos');

    DROP POLICY IF EXISTS "Permitir atualização de fotos" ON storage.objects;
    CREATE POLICY "Permitir atualização de fotos" ON storage.objects FOR UPDATE USING (bucket_id = 'animal-photos');
END $$;`;

  const handleCopyMigration = () => {
    navigator.clipboard.writeText(migrationSql);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2500);
  };

  const handleDownloadMigration = () => {
    const element = document.createElement('a');
    const file = new Blob([migrationSql], { type: 'text/sql' });
    element.href = URL.createObjectURL(file);
    element.download = '20260918000000_sisbem_initial_schema.sql';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  useEffect(() => {
    setConfigs(db.getKennelConfigs());

    const handleSettingsChanged = (e: any) => {
      const newConfigs = e.detail?.configs || db.getKennelConfigs();
      setConfigs(newConfigs);
      if (e.detail?.source === 'realtime') {
        setMessage({ 
          type: 'success', 
          text: 'Configurações de infraestrutura atualizadas em tempo real a partir de outro usuário/dispositivo!' 
        });
      }
    };

    const handleKennelsChanged = () => {
      setConfigs(db.getKennelConfigs());
    };

    window.addEventListener('sisbem-settings-changed', handleSettingsChanged);
    window.addEventListener('sisbem-kennels-changed', handleKennelsChanged);
    window.addEventListener('storage', handleKennelsChanged);

    return () => {
      window.removeEventListener('sisbem-settings-changed', handleSettingsChanged);
      window.removeEventListener('sisbem-kennels-changed', handleKennelsChanged);
      window.removeEventListener('storage', handleKennelsChanged);
    };
  }, []);

  const handleCountChange = (type: KennelType, value: string) => {
    const num = parseInt(value) || 0;
    setConfigs(prev => prev.map(c => c.type === type ? { ...c, count: num } : c));
  };

  const handleCapacityChange = (type: KennelType, value: string) => {
    const num = parseInt(value) || 0;
    setConfigs(prev => prev.map(c => c.type === type ? { ...c, capacity: num } : c));
  };

  const handleClearFictitiousData = () => {
    if (window.confirm('Tem certeza de que deseja apagar todos os cadastros fictícios de teste? Esta ação removerá permanentemente todos os animais, tutores, cirurgias e prontuários de teste, deixando o sistema pronto para cadastros reais.')) {
      setSeedingLoading(true);
      try {
        db.clearAllFictitiousData();
        setConfigs(db.getKennelConfigs());
        setMessage({ 
          type: 'success', 
          text: 'Todos os cadastros fictícios foram apagados com sucesso! A base está limpa para uso oficial.' 
        });
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Erro ao apagar cadastros fictícios: ' + err.message });
      } finally {
        setSeedingLoading(false);
      }
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        await db.saveKennelConfigsAsync(configs);
        setMessage({ type: 'success', text: 'Configurações de infraestrutura atualizadas e propagadas automaticamente para todos os usuários em tempo real!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="text-slate-400" /> Configurações do Centro
          </h2>
          <p className="text-slate-500">Ajuste as capacidades físicas, quantitativas das baias e gerencie os dados do sistema.</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync em Tempo Real Ativo
          </span>

          <button
            type="button"
            onClick={handleSyncCloud}
            disabled={syncingCloud}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Sincronizar configurações com o banco agora"
          >
            <RefreshCw size={14} className={syncingCloud ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            {syncingCloud ? 'Sincronizando...' : 'Atualizar da Nuvem'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Card de Limpeza e Gerenciamento de Dados de Teste */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Apagar Cadastros Fictícios */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
              <Trash2 size={16} />
              <span>Limpeza de Dados</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Apagar Cadastros Fictícios de Teste
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Exclui permanentemente todos os <strong>animais, tutores, cirurgias e prontuários</strong> criados para testes. Libera e desocupa todas as baias e gatis, mantendo a estrutura do sistema intacta para uso real.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearFictitiousData}
            disabled={seedingLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 hover:border-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={15} />
            {seedingLoading ? 'Processando...' : 'Apagar Todos os Cadastros Fictícios'}
          </button>
        </div>

        {/* Card: Repovoar para Demonstração (Opcional) */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
              <Sparkles size={16} />
              <span>Demonstração & Testes</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Gerar Cadastros de Demonstração
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Caso precise demonstrar o sistema para novos operadores ou veterinários, esta opção preenche o sistema com animais fictícios para treinamento.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetAndSeed}
            disabled={seedingLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <Database size={15} />
            {seedingLoading ? 'Gerando...' : 'Gerar Cadastros de Demonstração'}
          </button>
        </div>
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            * As alterações serão sincronizadas e aplicadas para <strong>todos os usuários logados</strong> automaticamente em tempo real.
          </p>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Save size={18} /> {loading ? 'Sincronizando em tempo real...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Card de Integração Supabase / PostgreSQL & Migrations */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="text-emerald-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Integração Supabase & PostgreSQL (Drizzle)</h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ativo & Migrado
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Banco relacional provisionado e sincronizado com 12 tabelas, chaves estrangeiras, índices e políticas de Row Level Security (RLS).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyMigration}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              {copiedMigration ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copiedMigration ? 'Copiado!' : 'Copiar SQL Migration'}
            </button>
            <button
              type="button"
              onClick={handleDownloadMigration}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Download size={14} />
              Baixar Migration (.sql)
            </button>
          </div>
        </div>

        {/* Credenciais e Endpoint Ativo do Supabase */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Globe size={15} className="text-indigo-600" />
              Configurações de Conexão Supabase Client (Públicas)
            </h4>
            <a
              href="https://supabase.com/dashboard/project/azufmdknlvbfaxnfiwwg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              Abrir Dashboard Supabase <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Supabase URL */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                  <Globe size={13} className="text-slate-400" />
                  NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(SUPABASE_URL, setCopiedUrl)}
                  className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedUrl ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 select-all break-all">
                {SUPABASE_URL}
              </div>
            </div>

            {/* Supabase Anon Key */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                  <Key size={13} className="text-slate-400" />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-slate-500 hover:text-slate-700 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showKey ? 'Ocultar' : 'Exibir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyText(SUPABASE_ANON_KEY, setCopiedKey)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedKey ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 select-all break-all">
                {showKey ? SUPABASE_ANON_KEY : `${SUPABASE_ANON_KEY.substring(0, 16)}••••••••••••••••••••••••••••••••`}
              </div>
            </div>
          </div>

          {/* Teste de Conexão do Client */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={testingSupabase}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-xs rounded-lg transition cursor-pointer"
              >
                {testingSupabase ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {testingSupabase ? 'Testando Conexão...' : 'Testar Conexão Supabase'}
              </button>
              <span className="text-[11px] text-slate-500">
                Verifica conectividade HTTP/REST e autenticação com <code className="font-mono text-slate-700 font-semibold">azufmdknlvbfaxnfiwwg</code>.
              </span>
            </div>

            {supabaseTestResult && (
              <div className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                supabaseTestResult.success ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {supabaseTestResult.success ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
                {supabaseTestResult.message}
              </div>
            )}
          </div>

          {/* OTIMIZAÇÃO DE EGRESS E STORAGE DE FOTOS */}
          <div className="mt-4 p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <Database size={14} className="text-teal-600" />
                  Otimização de Egress & Supabase Storage (Bucket <code className="font-mono">{ANIMAL_PHOTOS_BUCKET}</code>)
                </h4>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Evita tráfego excessivo (Egress) convertendo fotos Base64 em arquivos WebP compactados no Supabase Storage com CDN.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-teal-200">
                  {storagePhotosCount} no Storage CDN | {base64PhotosCount} em Base64
                </span>
                <button
                  type="button"
                  onClick={handleMigratePhotos}
                  disabled={migratingPhotos || base64PhotosCount === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-300 text-white font-bold text-xs rounded-lg transition shadow-sm"
                >
                  {migratingPhotos ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {migratingPhotos ? `Migrando (${migrationProgress?.current || 0}/${migrationProgress?.total || 0})...` : 'Migrar Fotos p/ Storage'}
                </button>
              </div>
            </div>

            {migrationProgress && (
              <div className="w-full bg-teal-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.round((migrationProgress.current / migrationProgress.total) * 100)}%` }}
                />
              </div>
            )}

            {migrationResult && (
              <div className="text-[11px] text-teal-900 bg-white/80 p-2.5 rounded-lg border border-teal-200">
                ✅ <strong>{migrationResult.migrated}</strong> fotos migradas com sucesso. {migrationResult.skipped > 0 && `(${migrationResult.skipped} ignoradas)`}
                {migrationResult.errors.length > 0 && (
                  <p className="text-red-600 mt-1 font-mono text-[10px]">
                    Avisos: {migrationResult.errors.join(' | ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resumo das 12 tabelas criadas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
          {[
            { name: 'animals', cols: '37 colunas', desc: 'Animais & Triagem' },
            { name: 'clinical_records', cols: '37 colunas', desc: 'Prontuários Médicos' },
            { name: 'surgeries', cols: '20 colunas', desc: 'Castrações & Cirurgias' },
            { name: 'kennels', cols: '5 colunas', desc: 'Baias & Acomodações' },
            { name: 'kennel_occupations', cols: '9 colunas', desc: 'Ocupação & Vagas' },
            { name: 'users', cols: '9 colunas', desc: 'Vets, Admins & Operadores' },
            { name: 'tutores', cols: '9 colunas', desc: 'Tutores & CadÚnico' },
            { name: 'solicitantes', cols: '11 colunas', desc: 'Cidadãos, ONGs e PM' },
            { name: 'prescriptions', cols: '12 colunas', desc: 'Receituários & Posologia' },
            { name: 'referrals', cols: '9 colunas', desc: 'Encaminhamentos' },
            { name: 'status_logs', cols: '8 colunas', desc: 'Auditoria de Condição' },
            { name: 'exam_files', cols: '6 colunas', desc: 'Laudos & Anexos' }
          ].map(tbl => (
            <div key={tbl.name} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-800 text-[11px]">{tbl.name}</span>
                <span className="text-[10px] text-emerald-600 font-semibold">{tbl.cols}</span>
              </div>
              <p className="text-[10px] text-slate-500">{tbl.desc}</p>
            </div>
          ))}
        </div>

        {/* Informações de Execução no Supabase */}
        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs space-y-2.5 font-mono">
          <div className="flex items-center justify-between text-slate-400 font-sans text-[11px] border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <Terminal size={14} className="text-emerald-400" />
              Como aplicar no Supabase CLI ou Dashboard
            </span>
            <button
              onClick={() => setShowSqlPreview(!showSqlPreview)}
              className="text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px] cursor-pointer"
            >
              {showSqlPreview ? 'Ocultar Código SQL' : 'Visualizar Código SQL'}
            </button>
          </div>

          <div className="space-y-1 text-[11px] font-mono text-slate-300">
            <p><span className="text-slate-500"># 1. No Supabase Web Studio:</span> Copie o SQL acima e cole no menu "SQL Editor" &gt; Run</p>
            <p><span className="text-slate-500"># 2. Ou via Supabase CLI localmente:</span></p>
            <p className="text-emerald-400">supabase db push</p>
            <p><span className="text-slate-500"># Arquivo salvo em:</span> <span className="text-indigo-300">supabase/migrations/20260918000000_sisbem_initial_schema.sql</span></p>
          </div>

          {showSqlPreview && (
            <pre className="mt-3 p-3 bg-slate-950 rounded-lg text-[10px] text-slate-300 max-h-60 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed border border-slate-800">
              {migrationSql}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
