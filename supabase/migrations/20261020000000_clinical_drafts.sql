-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION: 20261020000000_clinical_drafts.sql
-- FASE: RASCUNHOS CLÍNICOS PERSISTENTES & PAUSA DE ATENDIMENTO VETERINÁRIO
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA public.clinical_drafts
-- Armazena o estado intermediário de consultas veterinárias em andamento ou pausadas
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_drafts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    attendance_id TEXT NOT NULL,
    vet_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paused', 'finished', 'cancelled')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 2. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ------------------------------------------------------------------------------
-- Garante no máximo 1 rascunho ativo ou pausado por animal
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_drafts_active_animal
ON public.clinical_drafts (animal_id)
WHERE status IN ('draft', 'paused');

CREATE INDEX IF NOT EXISTS idx_clinical_drafts_vet_id
ON public.clinical_drafts (vet_id);

CREATE INDEX IF NOT EXISTS idx_clinical_drafts_status
ON public.clinical_drafts (status);

CREATE INDEX IF NOT EXISTS idx_clinical_drafts_updated_at
ON public.clinical_drafts (updated_at DESC);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ------------------------------------------------------------------------------
ALTER TABLE public.clinical_drafts ENABLE ROW LEVEL SECURITY;

-- Política de Leitura:
-- O veterinário dono do rascunho, ADMINs ou profissionais autorizados para consulta de fila/bloqueio
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clinical_drafts' AND policyname = 'clinical_drafts_select_policy'
    ) THEN
        CREATE POLICY "clinical_drafts_select_policy"
        ON public.clinical_drafts
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Política de Modificação (Insert/Update/Delete):
-- Apenas o veterinário responsável pelo rascunho ou Administrador
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clinical_drafts' AND policyname = 'clinical_drafts_modify_policy'
    ) THEN
        CREATE POLICY "clinical_drafts_modify_policy"
        ON public.clinical_drafts
        FOR ALL
        TO authenticated
        USING (
            vet_id = (SELECT id FROM public.users WHERE uid = auth.uid()::text OR id = auth.uid()::text LIMIT 1)
            OR EXISTS (
                SELECT 1 FROM public.users 
                WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
                  AND role = 'ADMIN'
            )
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. RPC TRANSACIONAL: save_clinical_draft
-- Permite salvar ou atualizar o rascunho de forma atômica, controlando concorrência
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_clinical_draft(
    p_animal_id TEXT,
    p_vet_id TEXT,
    p_attendance_id TEXT,
    p_form_data JSONB,
    p_status TEXT DEFAULT 'draft',
    p_client_version INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actual_vet_id TEXT := p_vet_id;
    v_draft RECORD;
    v_animal RECORD;
    v_vet RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_new_version INTEGER := 1;
    v_draft_id TEXT;
BEGIN
    -- 1. Validação de parâmetros
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'animal_id é obrigatório.');
    END IF;

    IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'vet_id é obrigatório.');
    END IF;

    -- Valida veterinário
    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_actual_vet_id;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Veterinário responsável não localizado.');
    END IF;

    -- 2. Valida o animal e bloqueio de concorrência
    SELECT id, nome, condicao, em_atendimento_vet_id INTO v_animal
    FROM public.animals
    WHERE id = p_animal_id;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'ANIMAL_NOT_FOUND', 'message', 'Animal não localizado.');
    END IF;

    -- Proteção contra edição de atendimento alheio
    IF v_animal.em_atendimento_vet_id IS NOT NULL 
       AND v_animal.em_atendimento_vet_id <> v_actual_vet_id 
       AND v_vet.role <> 'ADMIN' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'message', 'Este atendimento pertence a outro profissional e não pode ser alterado.'
        );
    END IF;

    -- 3. Busca rascunho existente
    SELECT id, version, updated_at, vet_id, status INTO v_draft
    FROM public.clinical_drafts
    WHERE animal_id = p_animal_id AND status IN ('draft', 'paused')
    FOR UPDATE;

    IF FOUND THEN
        -- Detecção de conflito de versão
        IF p_client_version IS NOT NULL AND p_client_version < v_draft.version THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'code', 'VERSION_CONFLICT',
                'message', 'Existe uma versão mais recente deste rascunho gravada no servidor.',
                'server_version', v_draft.version,
                'updated_at', v_draft.updated_at
            );
        END IF;

        v_new_version := v_draft.version + 1;
        v_draft_id := v_draft.id;

        UPDATE public.clinical_drafts
        SET form_data = p_form_data,
            status = p_status,
            version = v_new_version,
            updated_at = v_now_ts
        WHERE id = v_draft.id;
    ELSE
        v_draft_id := pg_catalog.gen_random_uuid()::text;
        v_new_version := 1;

        INSERT INTO public.clinical_drafts (
            id,
            animal_id,
            attendance_id,
            vet_id,
            form_data,
            status,
            version,
            created_at,
            updated_at
        ) VALUES (
            v_draft_id,
            p_animal_id,
            COALESCE(p_attendance_id, 'att_' || p_animal_id || '_' || pg_catalog.to_char(v_now_ts, 'YYYYMMDDHH24MISS')),
            v_actual_vet_id,
            p_form_data,
            p_status,
            v_new_version,
            v_now_ts,
            v_now_ts
        );
    END IF;

    -- Se o status for 'paused', assegura que a trava no animal continua ativa
    IF p_status = 'paused' AND v_animal.condicao <> 'Em Atendimento' THEN
        UPDATE public.animals
        SET condicao = 'Em Atendimento',
            em_atendimento_vet_id = v_actual_vet_id,
            em_atendimento_inicio = COALESCE(v_animal.em_atendimento_inicio, v_now_ts)
        WHERE id = p_animal_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'draft_id', v_draft_id,
        'animal_id', p_animal_id,
        'version', v_new_version,
        'status', p_status,
        'updated_at', v_now_iso
    );
END;
$$;
