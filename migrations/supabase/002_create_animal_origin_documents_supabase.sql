-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO CONTROLADA: SUPABASE (RÉPLICA HOMOLOGAÇÃO & PRODUÇÃO)
-- ARQUIVO: migrations/supabase/002_create_animal_origin_documents_supabase.sql
-- TABELA: public.animal_origin_documents
-- ==============================================================================
-- DIRETRIZES TÉCNICAS E DE SEGURANÇA:
-- 1. Armazena de forma persistente e distribuída os documentos encaminhados
--    por clínicas veterinárias conveniadas.
-- 2. Vinculação perpétua com o animal_id.
-- 3. Habilitação de RLS (Row Level Security) garantindo acesso para usuários autenticados.
-- 4. Isolamento absoluto das consultas gerais de animais (/animais, dashboards, filas).
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA
CREATE TABLE IF NOT EXISTS public.animal_origin_documents (
    id TEXT PRIMARY KEY,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    clinica_origem TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    tamanho_bytes INTEGER,
    data_anexo TEXT NOT NULL,
    arquivo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. ÍNDICES DE DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_origin_docs_animal_id 
    ON public.animal_origin_documents(animal_id);

CREATE INDEX IF NOT EXISTS idx_origin_docs_created_at 
    ON public.animal_origin_documents(created_at DESC);

-- 3. SEGURANÇA EM NÍVEL DE LINHA (RLS)
ALTER TABLE public.animal_origin_documents ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACESSO
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir acesso completo a documentos de origem" ON public.animal_origin_documents;
    CREATE POLICY "Permitir acesso completo a documentos de origem" 
        ON public.animal_origin_documents 
        FOR ALL 
        TO authenticated, anon
        USING (true) 
        WITH CHECK (true);
END $$;

-- 5. DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
COMMENT ON TABLE public.animal_origin_documents 
    IS 'Documentos de origem e fichas de atendimento de clínicas conveniadas encaminhadas ao SISBEM.';
