-- ==============================================================================
-- SISBEM - Auditoria, Integridade e Segurança: public.kennel_occupations
-- Migração: Garantir no máximo UMA ocupação ativa (exit_date IS NULL) por animal
-- Revisão de Segurança da RPC allocate_kennel_atomic (SECURITY DEFINER + search_path)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HISTÓRICO DE REGULARIZAÇÃO DAS DUPLICIDADES (JÁ EXECUTADO EM PRODUÇÃO)
-- ------------------------------------------------------------------------------
-- As ocupações anteriores mais antigas de TRIPEZINHA e RAFAELA foram finalizadas
-- preservando integralmente seu histórico e mantendo a ocupação mais recente ativa:
-- - Tripezinha: id 'bcfc8048-0aab-4d95-a276-9f46f9129038' (exit_date = '2026-09-23T17:44:14.335Z')
-- - Rafaela:    id '28588449-deea-4094-a4cf-f9ce75260721' (exit_date = '2026-09-23T17:43:08.976Z')

-- ------------------------------------------------------------------------------
-- 2. UNIQUE PARTIAL INDEX (PROTEÇÃO ESTRUTURAL NO POSTGRESQL / SUPABASE)
-- ------------------------------------------------------------------------------
-- Garante que cada animal possa ter no máximo UMA ocupação ativa simultaneamente.
-- Registros históricos finalizados (exit_date IS NOT NULL) continuam ilimitados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kennel_occupations_single_active
ON public.kennel_occupations (animal_id)
WHERE exit_date IS NULL;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO RPC ATÔMICA, TRANSACIONAL E SEGURA: allocate_kennel_atomic
-- ------------------------------------------------------------------------------
-- - Bloqueio exclusivo pessimista (FOR UPDATE) para serialização entre múltiplos clientes
-- - Validação rigorosa de todos os identificadores (animal_id, kennel_id, vet_id)
-- - Validação de autorização do usuário responsável (perfil ADMIN, VETERINARIO ou OPERATOR)
-- - Validação de disponibilidade e capacidade da baia de destino
-- - Encerramento atômico da ocupação anterior com timestamp de relógio
-- - Criação da nova ocupação ativa (exit_date = NULL)
-- - Preservação total do histórico
-- - Proteção contra Search-Path Hijacking (SET search_path = '')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_kennel_atomic(
    p_animal_id TEXT,
    p_kennel_id TEXT,
    p_vet_id TEXT,
    p_justification TEXT DEFAULT 'Alocação de baia',
    p_new_id TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_role TEXT;
    v_user_role TEXT;
    v_kennel RECORD;
    v_current_active_in_kennel INT;
    v_new_id TEXT;
    v_now TEXT := pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_result jsonb;
BEGIN
    ----------------------------------------------------------------------------
    -- A. AUTENTICAÇÃO E AUTORIZAÇÃO DO CHAMADOR
    ----------------------------------------------------------------------------
    -- Extrai o papel da sessão JWT do PostgREST / Supabase
    v_caller_role := pg_catalog.current_setting('request.jwt.claim.role', true);

    -- Quando executado via PostgREST/Supabase HTTP API, bloqueia role anon ou roles desconhecidas
    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('authenticated', 'service_role') THEN
        RAISE EXCEPTION 'Acesso negado: a função só pode ser executada por usuários autenticados (role: %).', v_caller_role
            USING ERRCODE = '42501';
    END IF;

    ----------------------------------------------------------------------------
    -- B. VALIDAÇÃO DOS PARÂMETROS DE ENTRADA
    ----------------------------------------------------------------------------
    -- 1. Validação de animal_id
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RAISE EXCEPTION 'ID do animal é obrigatório e não pode ser vazio.'
            USING ERRCODE = '22023';
    END IF;

    -- 2. Validação de kennel_id
    IF p_kennel_id IS NULL OR pg_catalog.btrim(p_kennel_id) = '' THEN
        RAISE EXCEPTION 'ID da baia é obrigatório e não pode ser vazio.'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Validação de vet_id (responsável técnico/operacional pela movimentação)
    IF p_vet_id IS NULL OR pg_catalog.btrim(p_vet_id) = '' THEN
        RAISE EXCEPTION 'Identificador do veterinário ou operador responsável (vet_id) é obrigatório.'
            USING ERRCODE = '22023';
    END IF;

    -- Valida se o usuário informado em vet_id existe no sistema e possui perfil autorizado
    SELECT role INTO v_user_role
    FROM public.users
    WHERE id = p_vet_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário responsável informado (vet_id: %) não existe no sistema SISBEM.', p_vet_id
            USING ERRCODE = '02000';
    END IF;

    IF v_user_role NOT IN ('ADMIN', 'VETERINARIO', 'OPERATOR') THEN
        RAISE EXCEPTION 'Usuário (vet_id: %) não possui perfil autorizado para movimentar animais (perfil: %).', p_vet_id, v_user_role
            USING ERRCODE = '42501';
    END IF;

    ----------------------------------------------------------------------------
    -- C. BLOQUEIO PESSIMISTA DO ANIMAL (SERIALIZAÇÃO DE CONCORRÊNCIA)
    ----------------------------------------------------------------------------
    PERFORM id FROM public.animals WHERE id = p_animal_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Animal com ID % não encontrado.', p_animal_id
            USING ERRCODE = '02000';
    END IF;

    ----------------------------------------------------------------------------
    -- D. BLOQUEIO PESSIMISTA DA BAIA E CHECAGEM DE DISPONIBILIDADE / CAPACIDADE
    ----------------------------------------------------------------------------
    SELECT id, name, type, capacity INTO v_kennel
    FROM public.kennels
    WHERE id = p_kennel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Baia com ID % não encontrada.', p_kennel_id
            USING ERRCODE = '02000';
    END IF;

    -- Conta ocupações ativas na baia de destino (excluindo o próprio animal, se já estiver nela)
    SELECT pg_catalog.count(*) INTO v_current_active_in_kennel
    FROM public.kennel_occupations
    WHERE kennel_id = p_kennel_id
      AND exit_date IS NULL
      AND animal_id <> p_animal_id;

    IF v_kennel.capacity IS NOT NULL AND v_kennel.capacity > 0 AND v_current_active_in_kennel >= v_kennel.capacity THEN
        RAISE EXCEPTION 'A baia "%" está com a capacidade máxima esgotada (% de % vagas ocupadas).',
            v_kennel.name, v_current_active_in_kennel, v_kennel.capacity
            USING ERRCODE = '23514';
    END IF;

    ----------------------------------------------------------------------------
    -- E. ENCERRAMENTO ATÔMICO DA OCUPAÇÃO ATIVA ANTERIOR (SE HOUVER)
    ----------------------------------------------------------------------------
    UPDATE public.kennel_occupations
    SET exit_date = v_now
    WHERE animal_id = p_animal_id
      AND exit_date IS NULL;

    ----------------------------------------------------------------------------
    -- F. CRIAÇÃO DA NOVA OCUPAÇÃO ATIVA (exit_date = NULL)
    ----------------------------------------------------------------------------
    v_new_id := COALESCE(p_new_id, pg_catalog.gen_random_uuid()::text);

    INSERT INTO public.kennel_occupations (
        id, kennel_id, animal_id, entry_date, exit_date, vet_id, justification, created_at
    ) VALUES (
        v_new_id,
        p_kennel_id,
        p_animal_id,
        v_now,
        NULL,
        p_vet_id,
        COALESCE(p_justification, 'Alocação de baia'),
        pg_catalog.clock_timestamp()
    );

    ----------------------------------------------------------------------------
    -- G. RETORNO DO REGISTRO CRIADO COM INFORMAÇÕES DA BAIA
    ----------------------------------------------------------------------------
    SELECT pg_catalog.json_build_object(
        'id', o.id,
        'animal_id', o.animal_id,
        'kennel_id', o.kennel_id,
        'entry_date', o.entry_date,
        'exit_date', o.exit_date,
        'vet_id', o.vet_id,
        'justification', o.justification,
        'kennels', pg_catalog.json_build_object(
            'id', k.id,
            'name', k.name,
            'type', k.type,
            'capacity', k.capacity
        )
    ) INTO v_result
    FROM public.kennel_occupations o
    LEFT JOIN public.kennels k ON k.id = o.kennel_id
    WHERE o.id = v_new_id;

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. REVISÃO DE PRIVILÉGIOS (RBAC): BLOQUEIO DE ANON E RESTRIÇÃO A AUTHENTICATED
-- ------------------------------------------------------------------------------
-- 1. Revoga privilégios para usuários não autenticados e role pública
REVOKE ALL ON FUNCTION public.allocate_kennel_atomic(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.allocate_kennel_atomic(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.allocate_kennel_atomic(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
    END IF;
END $$;
