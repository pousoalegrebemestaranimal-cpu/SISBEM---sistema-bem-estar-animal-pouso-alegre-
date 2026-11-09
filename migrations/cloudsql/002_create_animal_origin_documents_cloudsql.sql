-- ==============================================================================
-- SISBEM — SISTEMA DE GESTÃO DO BEM-ESTAR ANIMAL
-- MIGRAÇÃO CONTROLADA: CLOUD SQL (PostgreSQL Convencional / Drizzle ORM)
-- ARQUIVO: migrations/cloudsql/002_create_animal_origin_documents_cloudsql.sql
-- TABELA: public.animal_origin_documents
-- ==============================================================================
-- DIRETRIZES TÉCNICAS E DE ARQUITETURA:
-- 1. Armazena a ficha de atendimento e documentos encaminhados por clínicas
--    veterinárias conveniadas ao município na entrada do animal.
-- 2. Vinculado permanentemente ao animal_id com ON DELETE CASCADE.
-- 3. Totalmente isolado das consultas gerais da tabela animals, garantindo zero
--    impacto em listagens, dashboards ou filas.
-- 4. O payload pesado (coluna arquivo) é consultado estritamente sob demanda.
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA PRINCIPAL
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

-- 2. ÍNDICE DE CONSULTA POR ANIMAL
CREATE INDEX IF NOT EXISTS idx_origin_docs_animal_id 
    ON public.animal_origin_documents(animal_id);

CREATE INDEX IF NOT EXISTS idx_origin_docs_created_at 
    ON public.animal_origin_documents(created_at DESC);

-- 3. PERMISSÕES DE ACESSO
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.animal_origin_documents TO CURRENT_USER;

-- 4. DOCUMENTAÇÃO NO CATÁLOGO DO BANCO
COMMENT ON TABLE public.animal_origin_documents 
    IS 'Documentos de origem e fichas de atendimento de clínicas conveniadas encaminhadas na triagem/cadastro de animais.';

COMMENT ON COLUMN public.animal_origin_documents.id 
    IS 'Identificador único do documento anexado (UUID).';

COMMENT ON COLUMN public.animal_origin_documents.animal_id 
    IS 'Identificador do animal ao qual o documento está permanentemente vinculado.';

COMMENT ON COLUMN public.animal_origin_documents.clinica_origem 
    IS 'Nome da clínica veterinária conveniada de origem.';

COMMENT ON COLUMN public.animal_origin_documents.nome_arquivo 
    IS 'Nome original do arquivo anexado (ex: ficha_clinica.pdf).';

COMMENT ON COLUMN public.animal_origin_documents.tipo_mime 
    IS 'Tipo MIME do documento (application/pdf, image/jpeg, image/png).';

COMMENT ON COLUMN public.animal_origin_documents.arquivo 
    IS 'Conteúdo do arquivo persistido (Base64 dataURL ou URL pública do Supabase Storage).';
