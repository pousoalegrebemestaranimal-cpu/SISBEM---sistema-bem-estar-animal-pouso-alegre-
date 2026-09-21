-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION INICIAL PARA SUPABASE / POSTGRESQL
-- Versão: 20260918000000_sisbem_initial_schema.sql
-- ==============================================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABELA: users (Operadores, Veterinários e Administradores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE, -- UID do Firebase Auth ou Supabase Auth
    email TEXT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VETERINARIO')),
    crmv TEXT,
    matricula TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. TABELA: solicitantes (Cidadão, ONG, Protetor, Órgão Público)
-- ==============================================================================
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

-- ==============================================================================
-- 3. TABELA: tutores (Responsáveis por animais com/sem CadÚnico)
-- ==============================================================================
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

-- ==============================================================================
-- 4. TABELA: kennels (Baias e Estruturas Físicas de Acomodação)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kennels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Individual', 'Coletiva', 'Quarentena', 'Gatil', 'Pré-operatório', 'Pós-operatório')),
    capacity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABELA: animals (Cadastro de Animais Resgatados/Acolhidos)
-- ==============================================================================
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
    usuario_responsavel_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    solicitante_id TEXT REFERENCES public.solicitantes(id) ON DELETE SET NULL,
    tutor_id TEXT REFERENCES public.tutores(id) ON DELETE SET NULL,
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

-- ==============================================================================
-- 6. TABELA: kennel_occupations (Histórico de Ocupação e Movimentação em Baias)
-- ==============================================================================
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

-- ==============================================================================
-- 7. TABELA: clinical_records (Prontuários e Atendimentos Clínicos)
-- ==============================================================================
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

-- ==============================================================================
-- 8. TABELA: prescriptions (Receitas Médicas e Posologia)
-- ==============================================================================
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

-- ==============================================================================
-- 9. TABELA: referrals (Encaminhamentos para Especialidades)
-- ==============================================================================
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

-- ==============================================================================
-- 10. TABELA: surgeries (Agendamento Cirúrgico / Fila de Castração)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.surgeries (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    data_agendada TEXT NOT NULL,
    horario TEXT,
    turno TEXT CHECK (turno IN ('MANHA', 'TARDE', 'INTEGRAL')),
    tipo_cirurgia TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Agendada', 'Em Pré-operatório', 'Realizada', 'Cancelada')),
    prioridade TEXT NOT NULL CHECK (prioridade IN ('Normal', 'Urgente', 'Fila de Espera')),
    veterinario_responsavel_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    veterinario_responsavel_nome TEXT,
    observacoes_pre_operatorias TEXT,
    observacoes_pos_operatorias TEXT,
    receitas_pos_operatorias JSONB,
    data_realizacao TEXT,
    realizada_por_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    realizada_por_nome TEXT,
    motivo_cancelamento TEXT,
    data_cadastro TEXT NOT NULL,
    usuario_criador_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. TABELA: status_logs (Auditoria de Condição do Animal)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.status_logs (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    data_alteracao TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    prontuario_id TEXT REFERENCES public.clinical_records(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 12. TABELA: exam_files (Arquivos e Laudos Anexados)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_files (
    id TEXT PRIMARY KEY,
    prontuario_id TEXT NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
    nome_exame TEXT NOT NULL,
    arquivo TEXT NOT NULL,
    data_anexo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES PARA CONSULTAS DE ALTO DESEMPENHO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_animals_condicao ON public.animals(condicao);
CREATE INDEX IF NOT EXISTS idx_animals_especie ON public.animals(especie);
CREATE INDEX IF NOT EXISTS idx_animals_solicitante_id ON public.animals(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_animals_tutor_id ON public.animals(tutor_id);
CREATE INDEX IF NOT EXISTS idx_clinical_records_animal_id ON public.clinical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_animal_id ON public.prescriptions(animal_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prontuario_id ON public.prescriptions(prontuario_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_animal_id ON public.surgeries(animal_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON public.surgeries(status);
CREATE INDEX IF NOT EXISTS idx_surgeries_data_agendada ON public.surgeries(data_agendada);
CREATE INDEX IF NOT EXISTS idx_kennel_occupations_kennel_id ON public.kennel_occupations(kennel_id);
CREATE INDEX IF NOT EXISTS idx_kennel_occupations_animal_id ON public.kennel_occupations(animal_id);
CREATE INDEX IF NOT EXISTS idx_tutores_cpf ON public.tutores(cpf);
CREATE INDEX IF NOT EXISTS idx_solicitantes_cpf ON public.solicitantes(cpf);

-- ==============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kennels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kennel_occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_files ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para operadores/sistema autenticado
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
