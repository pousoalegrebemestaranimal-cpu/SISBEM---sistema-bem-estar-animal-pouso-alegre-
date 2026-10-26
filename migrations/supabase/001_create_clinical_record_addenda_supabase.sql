-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO CONTROLADA: SUPABASE (PostgreSQL com Supabase Auth & RLS)
-- ARQUIVO: migrations/supabase/001_create_clinical_record_addenda_supabase.sql
-- TABELA: public.clinical_record_addenda
-- ==============================================================================
-- DIRETRIZES TÉCNICAS E DE SEGURANÇA:
-- 1. Este banco atua como RÉPLICA REMOTA e fonte de consultas em tempo real para
--    o frontend web do SISBEM.
-- 2. POLÍTICA DE SEGURANÇA RIGOROSA (RLS):
--    - "authenticated": Concede ESTRITAMENTE SELECT (leitura de histórico clínico).
--    - "anon": NENHUM acesso permitido (REVOKE ALL).
--    - "INSERT", "UPDATE" e "DELETE": TERMINANTEMENTE PROIBIDOS para usuários do navegador.
--      Todas as inserções de complementos devem passar obrigatoriamente pelo backend seguro
--      (POST /api/attendance/records/:id/addendum), garantindo validação de autoria e integridade.
-- 3. "service_role": Acesso total para operações de backend (upsert e sincronização).
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA NA RÉPLICA SUPABASE
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

-- 2. GARANTIA IDEMPOTENTE DE COLUNAS ADICIONAIS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'veterinario_nome'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN veterinario_nome TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'crmv'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN crmv TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_status'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_status TEXT DEFAULT 'PENDING' NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_attempts'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_attempts INTEGER DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'sync_last_error'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_last_error TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clinical_record_addenda' AND column_name = 'synced_at'
    ) THEN
        ALTER TABLE public.clinical_record_addenda ADD COLUMN synced_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. ÍNDICES DE CONSULTA E CONCORRÊNCIA
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_prontuario 
    ON public.clinical_record_addenda(prontuario_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_animal 
    ON public.clinical_record_addenda(animal_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_created 
    ON public.clinical_record_addenda(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_sync_status 
    ON public.clinical_record_addenda(sync_status)
    WHERE sync_status != 'SYNCED';

-- 4. PERMISSÕES EXPLÍCITAS (GRANTs / REVOKEs)
-- Bloqueio total a acessos anônimos
REVOKE ALL ON TABLE public.clinical_record_addenda FROM anon;

-- Usuários autenticados no navegador possuem ESTRITAMENTE consulta (leitura)
GRANT SELECT ON TABLE public.clinical_record_addenda TO authenticated;

-- Proíbe expressamente inserção, mutação e exclusão direta por usuários autenticados no navegador
-- Todas as inserções devem passar obrigatoriamente pelo backend Node.js autenticado
REVOKE INSERT, UPDATE, DELETE ON TABLE public.clinical_record_addenda FROM authenticated;

-- Papel "service_role" (usado exclusivamente pelo backend Node.js) possui privilégio total de sincronização
GRANT ALL ON TABLE public.clinical_record_addenda TO service_role;

-- 5. SEGURANÇA EM NÍVEL DE LINHA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.clinical_record_addenda ENABLE ROW LEVEL SECURITY;

-- Política 1: Leitura de notas complementares por profissionais autenticados
DROP POLICY IF EXISTS clinical_addenda_select_policy ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_select_policy 
    ON public.clinical_record_addenda
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Drop da política anterior de inserção direta pelo cliente (para garantir que não permaneça ativa)
DROP POLICY IF EXISTS clinical_addenda_insert_policy ON public.clinical_record_addenda;

-- Política 2: Acesso irrestrito de sincronização para o Service Role (Backend SISBEM)
DROP POLICY IF EXISTS clinical_addenda_service_role ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_service_role 
    ON public.clinical_record_addenda
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 6. DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
COMMENT ON TABLE public.clinical_record_addenda 
    IS 'Réplica remota Supabase de notas complementares clínicas (append-only e imutável).';
