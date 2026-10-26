-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO CONTROLADA: CLOUD SQL (PostgreSQL Convencional / Drizzle ORM)
-- ARQUIVO: migrations/cloudsql/001_create_clinical_record_addenda_cloudsql.sql
-- TABELA: public.clinical_record_addenda
-- ==============================================================================
-- DIRETRIZES TÉCNICAS E DE ARQUITETURA:
-- 1. Este banco é a FONTE PRIMÁRIA E CANÔNICA DE GRAVAÇÃO de todos os complementos.
-- 2. Não possui dependência do ecossistema Supabase Auth (sem auth.uid(), roles
--    "authenticated" ou "service_role").
-- 3. A aplicação conecta utilizando a role institucional da aplicação/Drizzle.
-- 4. O prontuário original em "clinical_records" permanece 100% INALTERADO.
-- 5. "ON DELETE RESTRICT" impede a exclusão acidental de prontuários ou animais
--    que possuam histórico de complementos vinculados.
-- 6. "idempotency_key TEXT UNIQUE" bloqueia no nível de banco qualquer duplicação
--    causada por concorrência simultânea, cliques duplos ou retentativas.
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA PRINCIPAL
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

-- 2. GARANTIA IDEMPOTENTE DE COLUNAS ADICIONAIS (SE A TABELA JÁ EXISTIR PREVIAMENTE)
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

-- 3. ÍNDICES DE DESEMPENHO E CONSULTA
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_prontuario 
    ON public.clinical_record_addenda(prontuario_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_animal 
    ON public.clinical_record_addenda(animal_id);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_created 
    ON public.clinical_record_addenda(created_at ASC);

-- Índice parcial otimizado para fila de sincronização pendente
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_sync_status 
    ON public.clinical_record_addenda(sync_status)
    WHERE sync_status != 'SYNCED';

-- 4. PERMISSÕES DE ACESSO (CONTA OPERACIONAL DO BACKEND SISBEM)
-- A aplicação necessita de SELECT para consultas, INSERT para criação e UPDATE
-- exclusivamente para atualização de metadados de sincronização (sync_status, sync_attempts, sync_last_error, synced_at).
--
-- INSTRUÇÃO OPERACIONAL PARA HOMOLOGAÇÃO / PRODUÇÃO:
-- Conceder permissões para CURRENT_USER é suficiente caso o script seja executado
-- diretamente pela mesma conta configurada na variável de ambiente process.env.SQL_USER da aplicação.
--
-- Caso a migração seja executada por um superusuário ou DBA administrativo (ex: 'postgres'),
-- o responsável pela infraestrutura DEVE conceder as permissões à identidade SQL efetiva
-- utilizada pelo backend SISBEM (informada na variável SQL_USER do ambiente):
--
-- Exemplo:
--   GRANT SELECT, INSERT, UPDATE ON TABLE public.clinical_record_addenda TO <VALOR_DE_SQL_USER>;
--
GRANT SELECT, INSERT, UPDATE ON TABLE public.clinical_record_addenda TO CURRENT_USER;

-- 5. DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
COMMENT ON TABLE public.clinical_record_addenda 
    IS 'Armazena notas complementares e adendos clínicos posteriores a prontuários veterinários finalizados. Registros append-only e imutáveis.';

COMMENT ON COLUMN public.clinical_record_addenda.id 
    IS 'Identificador canônico (UUID) do complemento clínico.';

COMMENT ON COLUMN public.clinical_record_addenda.prontuario_id 
    IS 'Chave estrangeira para clinical_records(id) com ON DELETE RESTRICT.';

COMMENT ON COLUMN public.clinical_record_addenda.animal_id 
    IS 'Chave estrangeira para animals(id) com ON DELETE RESTRICT.';

COMMENT ON COLUMN public.clinical_record_addenda.veterinario_id 
    IS 'Chave estrangeira para users(id) identificando o médico veterinário autor.';

COMMENT ON COLUMN public.clinical_record_addenda.idempotency_key 
    IS 'Chave de idempotência única que previne duplicidades em concorrência ou reenvios.';

COMMENT ON COLUMN public.clinical_record_addenda.sync_status 
    IS 'Estado durável da sincronização com a réplica remota: PENDING, SYNCED ou FAILED.';
