-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO 001: COMPLEMENTOS CLÍNICOS EM PRONTUÁRIOS (ADENDOS)
-- ==============================================================================
-- NOTA OPERACIONAL IMPORTANTE (AUDITORIA ETAPA 2A):
-- Este script foi desmembrado em 2 arquivos especializados para evitar erros de
-- incompatibilidade de roles e funções específicas do Supabase Auth no Cloud SQL:
-- 1. Cloud SQL (PostgreSQL Convencional): migrations/cloudsql/001_create_clinical_record_addenda_cloudsql.sql
-- 2. Supabase (PostgreSQL + Auth + RLS): migrations/supabase/001_create_clinical_record_addenda_supabase.sql
-- Consulte o documento migrations/README.md para o roteiro detalhado de aplicação.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_record_addenda (
    id TEXT PRIMARY KEY,
    prontuario_id TEXT NOT NULL REFERENCES public.clinical_records(id) ON DELETE RESTRICT,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE RESTRICT,
    veterinario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    veterinario_nome TEXT,
    crmv TEXT,
    texto TEXT NOT NULL CHECK (char_length(trim(texto)) >= 3),
    motivo TEXT NOT NULL CHECK (char_length(trim(motivo)) >= 2),
    idempotency_key TEXT UNIQUE,
    sync_status TEXT DEFAULT 'PENDING' NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
    sync_attempts INTEGER DEFAULT 0 NOT NULL,
    sync_last_error TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Se a tabela já existia em versão preliminar, garante a adição das novas colunas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'idempotency_key') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'veterinario_nome') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN veterinario_nome TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'crmv') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN crmv TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_status') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_status TEXT DEFAULT 'PENDING' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_attempts') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_attempts INTEGER DEFAULT 0 NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_last_error') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_last_error TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'synced_at') THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN synced_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Índices de consulta otimizada e concorrência
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_prontuario 
    ON public.clinical_record_addenda(prontuario_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_animal 
    ON public.clinical_record_addenda(animal_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_created 
    ON public.clinical_record_addenda(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_sync_status 
    ON public.clinical_record_addenda(sync_status)
    WHERE sync_status != 'SYNCED';

-- ==============================================================================
-- PERMISSÕES DE ACESSO (GRANTs)
-- ==============================================================================
GRANT SELECT, INSERT ON TABLE public.clinical_record_addenda TO authenticated;
GRANT ALL ON TABLE public.clinical_record_addenda TO service_role;

-- ==============================================================================
-- POLÍTICAS DE SEGURANÇA EM NÍVEL DE LINHA (ROW LEVEL SECURITY - RLS) PARA SUPABASE
-- ==============================================================================
ALTER TABLE public.clinical_record_addenda ENABLE ROW LEVEL SECURITY;

-- 1. Leitura: Usuários autenticados do SISBEM podem consultar os adendos
DROP POLICY IF EXISTS clinical_addenda_select_policy ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_select_policy 
    ON public.clinical_record_addenda
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 2. Inserção: Apenas usuários autenticados podem inserir adendos (com autoria vinculada)
DROP POLICY IF EXISTS clinical_addenda_insert_policy ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_insert_policy 
    ON public.clinical_record_addenda
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND char_length(trim(texto)) >= 3
        AND char_length(trim(motivo)) >= 2
    );

-- 3. Acesso total irrestrito para o Service Role (Backend do SISBEM)
DROP POLICY IF EXISTS clinical_addenda_service_role ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_service_role 
    ON public.clinical_record_addenda
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- NOTA: Nenhuma política de UPDATE ou DELETE é criada para o papel "authenticated",
-- garantindo a inviolabilidade legal do prontuário veterinário (caráter append-only estrito).

-- ==============================================================================
-- DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
-- ==============================================================================
COMMENT ON TABLE public.clinical_record_addenda 
    IS 'Armazena notas complementares e adendos clínicos posteriores vinculados a prontuários finalizados. Registros append-only e imutáveis.';

COMMENT ON COLUMN public.clinical_record_addenda.id 
    IS 'Identificador único do adendo clínico (UUID canônico).';

COMMENT ON COLUMN public.clinical_record_addenda.prontuario_id 
    IS 'Chave estrangeira para clinical_records(id). ON DELETE RESTRICT impede a exclusão do prontuário original enquanto houver adendos vinculados.';

COMMENT ON COLUMN public.clinical_record_addenda.animal_id 
    IS 'Chave estrangeira para animals(id). Permite consulta direta de todos os adendos por animal.';

COMMENT ON COLUMN public.clinical_record_addenda.veterinario_id 
    IS 'Chave estrangeira para users(id). Identifica o profissional autenticado responsável pelo registro do adendo.';

COMMENT ON COLUMN public.clinical_record_addenda.idempotency_key 
    IS 'Chave de idempotência única enviada pelo cliente para prevenir duplicações acidentais em retentativas ou cliques duplos.';

COMMENT ON COLUMN public.clinical_record_addenda.sync_status 
    IS 'Estado durável da sincronização com o banco remoto (PENDING, SYNCED ou FAILED).';
