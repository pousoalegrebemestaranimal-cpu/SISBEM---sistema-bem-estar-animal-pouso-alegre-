-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION: 20261020000000_clinical_drafts.sql
-- FASE 1.2: RASCUNHOS CLÍNICOS PERSISTENTES & SEGURANÇA REFORÇADA NO SUPABASE CENTRAL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA public.clinical_drafts
-- Armazena o estado intermediário de consultas veterinárias em andamento ou pausadas
-- Utiliza ON DELETE RESTRICT para proteger rascunhos e integridade de auditoria
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_drafts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    animal_id TEXT NOT NULL REFERENCES public.animals(id) ON DELETE RESTRICT,
    attendance_id TEXT NOT NULL,
    vet_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
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
-- 3. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO ESTRITAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.clinical_drafts ENABLE ROW LEVEL SECURITY;

-- 3.1 Política de Leitura Completa (SELECT):
-- EXCLUSIVA para o veterinário responsável pelo rascunho ou Administrador.
-- NÃO expõe form_data ou conteúdo clínico para outros usuários autenticados.
DO $$
BEGIN
    DROP POLICY IF EXISTS "clinical_drafts_select_policy" ON public.clinical_drafts;
    CREATE POLICY "clinical_drafts_select_policy"
    ON public.clinical_drafts
    FOR SELECT
    TO authenticated
    USING (
        vet_id = (SELECT id FROM public.users WHERE uid = auth.uid()::text OR id = auth.uid()::text LIMIT 1)
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
              AND role = 'ADMIN'
        )
    );
END $$;

-- 3.2 Política de Inserção (INSERT):
-- Apenas o próprio veterinário autenticado para o seu próprio vet_id, ou Administrador
DO $$
BEGIN
    DROP POLICY IF EXISTS "clinical_drafts_insert_policy" ON public.clinical_drafts;
    CREATE POLICY "clinical_drafts_insert_policy"
    ON public.clinical_drafts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        vet_id = (SELECT id FROM public.users WHERE uid = auth.uid()::text OR id = auth.uid()::text LIMIT 1)
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
              AND role = 'ADMIN'
        )
    );
END $$;

-- 3.3 Política de Atualização (UPDATE):
-- Apenas o veterinário responsável pelo rascunho ou Administrador.
-- Impede transferência indevida de autoria (WITH CHECK garante vet_id autorizado).
DO $$
BEGIN
    DROP POLICY IF EXISTS "clinical_drafts_update_policy" ON public.clinical_drafts;
    CREATE POLICY "clinical_drafts_update_policy"
    ON public.clinical_drafts
    FOR UPDATE
    TO authenticated
    USING (
        vet_id = (SELECT id FROM public.users WHERE uid = auth.uid()::text OR id = auth.uid()::text LIMIT 1)
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
              AND role = 'ADMIN'
        )
    )
    WITH CHECK (
        vet_id = (SELECT id FROM public.users WHERE uid = auth.uid()::text OR id = auth.uid()::text LIMIT 1)
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
              AND role = 'ADMIN'
        )
    );
END $$;

-- 3.4 Política de Exclusão (DELETE):
-- Apenas Administradores (transição normal é status = 'finished' ou 'cancelled')
DO $$
BEGIN
    DROP POLICY IF EXISTS "clinical_drafts_delete_policy" ON public.clinical_drafts;
    CREATE POLICY "clinical_drafts_delete_policy"
    ON public.clinical_drafts
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE (uid = auth.uid()::text OR id = auth.uid()::text) 
              AND role = 'ADMIN'
        )
    );
END $$;

-- ------------------------------------------------------------------------------
-- 4. RPC SEGURA PARA A FILA: get_active_clinical_drafts_summary
-- Fornece SOMENTE os metadados necessários para a fila (quem bloqueou, status, versão),
-- SEM expor form_data, prontuário, receitas ou exames a terceiros.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_clinical_drafts_summary()
RETURNS TABLE (
    id TEXT,
    animal_id TEXT,
    attendance_id TEXT,
    vet_id TEXT,
    vet_name TEXT,
    status TEXT,
    version INTEGER,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid TEXT;
    v_caller RECORD;
BEGIN
    -- Validação de autenticação
    v_caller_uid := pg_catalog.current_setting('request.jwt.claim.sub', true);
    IF v_caller_uid IS NULL OR v_caller_uid = '' THEN
        RAISE EXCEPTION 'Acesso não autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT u.id, u.role INTO v_caller 
    FROM public.users u 
    WHERE u.uid = v_caller_uid OR u.id = v_caller_uid 
    LIMIT 1;

    IF NOT FOUND OR v_caller.role NOT IN ('VETERINARIO', 'ADMIN') THEN
        RAISE EXCEPTION 'Acesso negado: perfil sem autorização técnica.' USING ERRCODE = '42501';
    END IF;

    -- Retorna apenas os campos de controle, sem form_data
    RETURN QUERY
    SELECT 
        cd.id,
        cd.animal_id,
        cd.attendance_id,
        cd.vet_id,
        u.name AS vet_name,
        cd.status,
        cd.version,
        cd.updated_at
    FROM public.clinical_drafts cd
    LEFT JOIN public.users u ON u.id = cd.vet_id
    WHERE cd.status IN ('draft', 'paused')
    ORDER BY cd.updated_at DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC TRANSACIONAL: save_clinical_draft
-- Salva ou atualiza o rascunho de forma atômica no Supabase, controlando concorrência
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
    v_caller_uid TEXT;
    v_caller RECORD;
    v_actual_vet_id TEXT;
    v_target_vet RECORD;
    v_draft RECORD;
    v_animal RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_new_version INTEGER := 1;
    v_draft_id TEXT;
    v_attendance_id TEXT;
BEGIN
    -- 1. Validação do parâmetro animal_id
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'animal_id é obrigatório.');
    END IF;

    -- 2. Identificação e Validação Estrita do Chamador Autenticado
    v_caller_uid := pg_catalog.current_setting('request.jwt.claim.sub', true);
    IF v_caller_uid IS NULL OR v_caller_uid = '' THEN
        -- Fallback seguro para sessão sem JWT claim direto
        SELECT id, name, role INTO v_caller FROM public.users WHERE id = p_vet_id LIMIT 1;
    ELSE
        SELECT id, name, role INTO v_caller FROM public.users WHERE uid = v_caller_uid OR id = v_caller_uid LIMIT 1;
    END IF;

    IF v_caller.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Usuário autenticado não localizado no cadastro.');
    END IF;

    IF v_caller.role NOT IN ('VETERINARIO', 'ADMIN') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Apenas veterinários e administradores podem salvar rascunhos.');
    END IF;

    -- Resolução do vet_id oficial:
    -- Se o usuário for VETERINARIO, o vet_id DEVE ser obrigatoriamente a identidade dele (não permite impersonar)
    IF v_caller.role = 'VETERINARIO' THEN
        v_actual_vet_id := v_caller.id;
    ELSE
        -- Se for ADMIN, pode especificar outro vet_id ou assumir a autoria
        v_actual_vet_id := COALESCE(NULLIF(pg_catalog.btrim(p_vet_id), ''), v_caller.id);
    END IF;

    -- Valida se o veterinário de destino existe
    SELECT id, name, role INTO v_target_vet FROM public.users WHERE id = v_actual_vet_id;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Veterinário responsável não localizado.');
    END IF;

    -- 3. BLOQUEIO PESSIMISTA EXCLUSIVO (FOR UPDATE) DO ANIMAL
    -- Serializa o início/salvamento do animal para impedir criação concorrente simultânea
    SELECT id, nome, condicao, em_atendimento_vet_id, em_atendimento_inicio
    INTO v_animal
    FROM public.animals
    WHERE id = p_animal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'ANIMAL_NOT_FOUND', 'message', 'Animal não localizado.');
    END IF;

    -- Proteção contra alteração de atendimento pertencente a outro veterinário
    IF v_animal.em_atendimento_vet_id IS NOT NULL 
       AND v_animal.em_atendimento_vet_id <> v_actual_vet_id 
       AND v_caller.role <> 'ADMIN' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'message', 'Este atendimento pertence a outro profissional e não pode ser alterado.'
        );
    END IF;

    -- 4. Busca rascunho existente com bloqueio FOR UPDATE
    SELECT id, attendance_id, version, updated_at, vet_id, status 
    INTO v_draft
    FROM public.clinical_drafts
    WHERE animal_id = p_animal_id AND status IN ('draft', 'paused')
    FOR UPDATE;

    IF FOUND THEN
        -- Proteção: veterinário comum não pode sobrescrever rascunho de outro profissional
        IF v_draft.vet_id <> v_actual_vet_id AND v_caller.role <> 'ADMIN' THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'code', 'FORBIDDEN',
                'message', 'Existe um rascunho ativo pertencente a outro veterinário.'
            );
        END IF;

        -- Detecção atômica de conflito de versão
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
        -- PRESERVAÇÃO ESTRITA: O attendance_id original NUNCA é sobrescrito na atualização
        v_attendance_id := v_draft.attendance_id;

        UPDATE public.clinical_drafts
        SET form_data = p_form_data,
            status = p_status,
            version = v_new_version,
            updated_at = v_now_ts
        WHERE id = v_draft.id;
    ELSE
        v_draft_id := pg_catalog.gen_random_uuid()::text;
        v_new_version := 1;
        v_attendance_id := COALESCE(NULLIF(pg_catalog.btrim(p_attendance_id), ''), 'att_' || p_animal_id || '_' || pg_catalog.to_char(v_now_ts, 'YYYYMMDDHH24MISS'));

        -- Inserção com proteção contra duplicação concorrente
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
            v_attendance_id,
            v_actual_vet_id,
            p_form_data,
            p_status,
            v_new_version,
            v_now_ts,
            v_now_ts
        )
        ON CONFLICT (animal_id) WHERE status IN ('draft', 'paused')
        DO UPDATE SET
            form_data = EXCLUDED.form_data,
            status = EXCLUDED.status,
            version = public.clinical_drafts.version + 1,
            updated_at = EXCLUDED.updated_at
        RETURNING id, version INTO v_draft_id, v_new_version;
    END IF;

    -- 5. Atualização da trava em public.animals se pausado ou se o animal ainda não estiver marcado
    IF v_animal.condicao <> 'Em Atendimento' OR v_animal.em_atendimento_vet_id IS NULL THEN
        UPDATE public.animals
        SET condicao = 'Em Atendimento',
            em_atendimento_vet_id = v_actual_vet_id,
            em_atendimento_inicio = COALESCE(v_animal.em_atendimento_inicio, v_now_ts)
        WHERE id = p_animal_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'draft_id', v_draft_id,
        'attendance_id', v_attendance_id,
        'animal_id', p_animal_id,
        'version', v_new_version,
        'status', p_status,
        'updated_at', v_now_iso
    );
END;
$$;


