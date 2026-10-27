-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO CONTROLADA: SUPABASE (RÉPLICA HOMOLOGAÇÃO)
-- ARQUIVO: migrations/supabase/001_create_clinical_record_addenda_supabase.sql
-- TABELA: public.clinical_record_addenda
-- ==============================================================================
-- DIRETRIZES TÉCNICAS E DE REPLICAÇÃO:
-- 1. Este banco Supabase atua exclusivamente como RÉPLICA SECUNDÁRIA e fonte de
--    consultas para a interface do SISBEM. O banco primário autoritativo é o Cloud SQL.
-- 2. As notas complementares chegam ao Supabase através de sincronização segura via backend
--    (Service Role Key), sendo registros append-only (imutáveis).
-- 3. NÃO há restrições rígidas de FK (como REFERENCES public.users(id)), pois em
--    ambientes distribuídos e replicados tais restrições causam falhas de replicação
--    (Postgres 23503) caso o usuário ou registro correlato esteja particionado ou
--    pertencente ao schema auth.
-- 4. O status padrão nesta réplica é 'SYNCED' com 'synced_at = NOW()', visto que
--    qualquer registro que aporta nesta tabela já foi validado e persistido no Cloud SQL.
-- 5. POLÍTICA DE SEGURANÇA RIGOROSA (RLS):
--    - "anon": Bloqueio total (REVOKE ALL).
--    - "authenticated": Concede ESTRITAMENTE SELECT (leitura de histórico clínico).
--    - "authenticated": Revoga explicitamente INSERT, UPDATE, DELETE.
--    - "service_role": Acesso irrestrito (GRANT ALL) para sincronização backend.
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA NA RÉPLICA SUPABASE (IDEMPOTENTE)
CREATE TABLE IF NOT EXISTS public.clinical_record_addenda (
    id TEXT PRIMARY KEY,
    prontuario_id TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    veterinario_id TEXT NOT NULL,
    veterinario_nome TEXT,
    crmv TEXT,
    texto TEXT NOT NULL CHECK (char_length(trim(texto)) >= 3),
    motivo TEXT NOT NULL CHECK (char_length(trim(motivo)) >= 2),
    idempotency_key TEXT UNIQUE,
    sync_status TEXT DEFAULT 'SYNCED' NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
    sync_attempts INTEGER DEFAULT 0 NOT NULL,
    sync_last_error TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. GARANTIA IDEMPOTENTE DE COLUNAS ADICIONAIS CASO A TABELA JÁ TENHA SIDO CRIADA
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
        ALTER TABLE public.clinical_record_addenda ADD COLUMN sync_status TEXT DEFAULT 'SYNCED' NOT NULL;
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
        ALTER TABLE public.clinical_record_addenda ADD COLUMN synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. ÍNDICES EFICIENTES DE CONSULTA
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_prontuario 
    ON public.clinical_record_addenda(prontuario_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_animal 
    ON public.clinical_record_addenda(animal_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_created 
    ON public.clinical_record_addenda(created_at ASC);

-- 4. PERMISSÕES EXPLÍCITAS (GRANTS & REVOKES)
-- Bloqueio total ao perfil anônimo
REVOKE ALL ON TABLE public.clinical_record_addenda FROM anon;

-- Usuários autenticados no frontend recebem estritamente permissão de LEITURA (SELECT)
GRANT SELECT ON TABLE public.clinical_record_addenda TO authenticated;

-- Proíbe qualquer inserção, atualização ou exclusão direta por clientes do navegador
REVOKE INSERT, UPDATE, DELETE ON TABLE public.clinical_record_addenda FROM authenticated;

-- Papel "service_role" (utilizado exclusivamente pelo backend Node.js) possui controle total
GRANT ALL ON TABLE public.clinical_record_addenda TO service_role;

-- 5. SEGURANÇA EM NÍVEL DE LINHA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.clinical_record_addenda ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuários autenticados podem visualizar os complementos dos prontuários
DROP POLICY IF EXISTS clinical_addenda_select_policy ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_select_policy 
    ON public.clinical_record_addenda
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Assegura a remoção de qualquer política indevida de escrita direta por clientes autenticados
DROP POLICY IF EXISTS clinical_addenda_insert_policy ON public.clinical_record_addenda;

-- Política de replicação/gestão: service_role possui acesso total para sincronização e reprocessamento
DROP POLICY IF EXISTS clinical_addenda_service_role ON public.clinical_record_addenda;
CREATE POLICY clinical_addenda_service_role 
    ON public.clinical_record_addenda
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 6. DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
COMMENT ON TABLE public.clinical_record_addenda 
    IS 'Réplica remota Supabase de complementos clínicos (append-only, somente leitura para clientes autenticados).';
