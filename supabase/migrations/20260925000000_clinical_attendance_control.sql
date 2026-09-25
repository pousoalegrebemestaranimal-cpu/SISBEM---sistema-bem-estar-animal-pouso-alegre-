-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION: 20260925000000_clinical_attendance_control.sql
-- FASE 1: CONTROLE TRANSACIONAL DE ATENDIMENTO VETERINÁRIO & BLOQUEIO DE DUPLICIDADE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOVAS COLUNAS EM public.animals
-- ------------------------------------------------------------------------------
ALTER TABLE public.animals 
ADD COLUMN IF NOT EXISTS em_atendimento_vet_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS em_atendimento_inicio TIMESTAMPTZ;

-- Índices para busca rápida de atendimentos em andamento
CREATE INDEX IF NOT EXISTS idx_animals_em_atendimento_vet_id 
ON public.animals (em_atendimento_vet_id);

CREATE INDEX IF NOT EXISTS idx_animals_condicao_atendimento 
ON public.animals (condicao);

-- ------------------------------------------------------------------------------
-- 2. PROTEÇÃO ESTRUTURAL CONTRA ATENDIMENTO DUPLICADO (UNIQUE PARTIAL INDEX)
-- ------------------------------------------------------------------------------
-- Garante que um animal só possa ter no máximo 1 estado de 'Em Atendimento' ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_animals_single_active_attendance
ON public.animals (id)
WHERE condicao = 'Em Atendimento';

-- ------------------------------------------------------------------------------
-- 3. RPC TRANSACIONAL: start_clinical_attendance
-- ------------------------------------------------------------------------------
-- Serializa o início de atendimento utilizando SELECT ... FOR UPDATE.
-- Impede condição de corrida mesmo em milissegundos entre computadores distintos.
-- Retorna o nome do veterinário responsável caso já esteja em atendimento.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_clinical_attendance(
    p_animal_id TEXT,
    p_vet_id TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_uid TEXT;
    v_actual_vet_id TEXT;
    v_vet RECORD;
    v_animal RECORD;
    v_occupying_vet RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
    -- 1. Validação do parâmetro do animal
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_PARAM',
            'message', 'Identificador do animal é obrigatório.'
        );
    END IF;

    -- 2. Identificação e Validação do Veterinário Chamador
    v_actual_vet_id := p_vet_id;

    -- Se não informado diretamente, tenta resolver via UID do JWT
    IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
        v_caller_uid := pg_catalog.current_setting('request.jwt.claim.sub', true);
        IF v_caller_uid IS NOT NULL AND v_caller_uid <> '' THEN
            SELECT id INTO v_actual_vet_id FROM public.users WHERE uid = v_caller_uid OR id = v_caller_uid LIMIT 1;
        END IF;
    END IF;

    IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'UNAUTHORIZED',
            'message', 'Veterinário não identificado para iniciar atendimento.'
        );
    END IF;

    -- Valida se o usuário existe e possui papel autorizado (VETERINARIO ou ADMIN)
    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_actual_vet_id;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'USER_NOT_FOUND',
            'message', 'Usuário veterinário informado não existe no sistema.'
        );
    END IF;

    IF v_vet.role NOT IN ('VETERINARIO', 'ADMIN') THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'message', 'Apenas profissionais veterinários e administradores podem assumir atendimento.'
        );
    END IF;

    -- 3. BLOQUEIO PESSIMISTA EXCLUSIVO (FOR UPDATE) DO ANIMAL
    SELECT id, nome, condicao, em_atendimento_vet_id, em_atendimento_inicio
    INTO v_animal
    FROM public.animals
    WHERE id = p_animal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'ANIMAL_NOT_FOUND',
            'message', 'Animal não localizado no cadastro.'
        );
    END IF;

    -- 4. VERIFICAÇÃO DE ATENDIMENTO CONCORRENTE
    IF v_animal.condicao = 'Em Atendimento' THEN
        -- Se for o próprio veterinário reabrindo a mesma tela, permite continuidade
        IF v_animal.em_atendimento_vet_id = v_actual_vet_id THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', true,
                'animal_id', v_animal.id,
                'animal_nome', v_animal.nome,
                'condicao', v_animal.condicao,
                'vet_id', v_vet.id,
                'vet_nome', v_vet.name,
                'inicio', v_animal.em_atendimento_inicio,
                'already_yours', true
            );
        END IF;

        -- Busca os dados do outro veterinário que já assumiu
        SELECT id, name INTO v_occupying_vet FROM public.users WHERE id = v_animal.em_atendimento_vet_id;

        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'ALREADY_IN_ATTENDANCE',
            'message', 'Este animal já está em atendimento pelo veterinário ' || COALESCE(v_occupying_vet.name, 'outro profissional') || '.',
            'vet_id', v_animal.em_atendimento_vet_id,
            'vet_nome', COALESCE(v_occupying_vet.name, 'Outro Veterinário'),
            'inicio', v_animal.em_atendimento_inicio
        );
    END IF;

    -- 5. ATUALIZAÇÃO ATÔMICA PARA "Em Atendimento"
    UPDATE public.animals
    SET condicao = 'Em Atendimento',
        em_atendimento_vet_id = v_actual_vet_id,
        em_atendimento_inicio = v_now_ts
    WHERE id = p_animal_id;

    -- 6. REGISTRO DE AUDITORIA EM status_logs
    INSERT INTO public.status_logs (
        id,
        animal_id,
        status_anterior,
        status_novo,
        data_alteracao,
        usuario_id
    ) VALUES (
        pg_catalog.gen_random_uuid()::text,
        p_animal_id,
        v_animal.condicao,
        'Em Atendimento',
        v_now_iso,
        v_actual_vet_id
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'animal_id', p_animal_id,
        'animal_nome', v_animal.nome,
        'condicao', 'Em Atendimento',
        'vet_id', v_vet.id,
        'vet_nome', v_vet.name,
        'inicio', v_now_iso,
        'status_anterior', v_animal.condicao
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC TRANSACIONAL: cancel_clinical_attendance
-- ------------------------------------------------------------------------------
-- Libera o animal de volta para a fila caso o veterinário desista ou feche a tela.
-- Apenas o veterinário responsável ou um ADMIN pode liberar o atendimento.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_clinical_attendance(
    p_animal_id TEXT,
    p_vet_id TEXT DEFAULT NULL,
    p_motivo TEXT DEFAULT 'Cancelamento de atendimento'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actual_vet_id TEXT;
    v_vet RECORD;
    v_animal RECORD;
    v_target_status TEXT;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'ID do animal obrigatório.');
    END IF;

    v_actual_vet_id := p_vet_id;
    IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
        SELECT id INTO v_actual_vet_id FROM public.users LIMIT 1;
    END IF;

    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_actual_vet_id;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Usuário não encontrado.');
    END IF;

    -- Bloqueio FOR UPDATE
    SELECT id, nome, condicao, tem_tutor, em_atendimento_vet_id
    INTO v_animal
    FROM public.animals
    WHERE id = p_animal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Animal não encontrado.');
    END IF;

    IF v_animal.condicao <> 'Em Atendimento' THEN
        RETURN pg_catalog.jsonb_build_object('success', true, 'message', 'O animal já não se encontra em atendimento.');
    END IF;

    -- Apenas o próprio veterinário ou ADMIN pode cancelar
    IF v_animal.em_atendimento_vet_id <> v_actual_vet_id AND v_vet.role <> 'ADMIN' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'message', 'Apenas o veterinário responsável ou administrador pode liberar este atendimento.'
        );
    END IF;

    -- Determina o status correto para retorno à fila
    IF v_animal.tem_tutor THEN
        v_target_status := 'Aguardando Atendimento';
    ELSE
        v_target_status := 'Acolhido';
    END IF;

    UPDATE public.animals
    SET condicao = v_target_status,
        em_atendimento_vet_id = NULL,
        em_atendimento_inicio = NULL
    WHERE id = p_animal_id;

    -- Log de auditoria
    INSERT INTO public.status_logs (
        id, animal_id, status_anterior, status_novo, data_alteracao, usuario_id
    ) VALUES (
        pg_catalog.gen_random_uuid()::text,
        p_animal_id,
        'Em Atendimento',
        v_target_status,
        v_now_iso,
        v_actual_vet_id
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'animal_id', p_animal_id,
        'status_restaurado', v_target_status,
        'message', 'Atendimento cancelado e animal devolvido à fila com sucesso.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC TRANSACIONAL ATÔMICA E IDEMPOTENTE: finish_clinical_attendance
-- ------------------------------------------------------------------------------
-- Executa em UMA ÚNICA TRANSAÇÃO:
-- 1. Verificação de concorrência com FOR UPDATE
-- 2. Idempotência por record_id (duplo clique não duplica prontuário nem receitas)
-- 3. Inserção em public.clinical_records
-- 4. Inserção em public.prescriptions (se houver)
-- 5. Atualização atômica em public.animals com status_resultante e liberação do lock
-- 6. Inserção do log definitivo em public.status_logs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_clinical_attendance(
    p_payload JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record JSONB := p_payload->'record';
    v_prescriptions JSONB := p_payload->'prescriptions';
    v_animal_id TEXT;
    v_vet_id TEXT;
    v_record_id TEXT;
    v_status_resultante TEXT;
    v_animal RECORD;
    v_vet RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_prescription_item JSONB;
    v_presc_id TEXT;
BEGIN
    IF v_record IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD', 'message', 'Dados do prontuário ausentes.');
    END IF;

    v_animal_id := v_record->>'animalId';
    v_vet_id := v_record->>'veterinarioId';
    v_record_id := v_record->>'id';
    v_status_resultante := v_record->>'statusResultante';

    IF v_animal_id IS NULL OR pg_catalog.btrim(v_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'animalId obrigatório.');
    END IF;

    IF v_vet_id IS NULL OR pg_catalog.btrim(v_vet_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'veterinarioId obrigatório.');
    END IF;

    IF v_record_id IS NULL OR pg_catalog.btrim(v_record_id) = '' THEN
        v_record_id := pg_catalog.gen_random_uuid()::text;
    END IF;

    -- 1. IDEMPOTÊNCIA: Se o prontuário com este ID já existe, retorna sucesso sem duplicar
    IF EXISTS (SELECT 1 FROM public.clinical_records WHERE id = v_record_id) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', true,
            'idempotent', true,
            'record_id', v_record_id,
            'message', 'Atendimento já havia sido finalizado anteriormente com sucesso.'
        );
    END IF;

    -- Valida veterinário
    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_vet_id;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Veterinário responsável não existe.');
    END IF;

    -- 2. BLOQUEIO PESSIMISTA EXCLUSIVO (FOR UPDATE)
    SELECT id, condicao, tem_tutor, em_atendimento_vet_id
    INTO v_animal
    FROM public.animals
    WHERE id = v_animal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'ANIMAL_NOT_FOUND', 'message', 'Animal não encontrado.');
    END IF;

    -- Garante que outro profissional não está finalizando indevidamente
    IF v_animal.condicao = 'Em Atendimento' AND v_animal.em_atendimento_vet_id <> v_vet_id AND v_vet.role <> 'ADMIN' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'FORBIDDEN',
            'message', 'Este atendimento pertence a outro veterinário e não pode ser finalizado por este usuário.'
        );
    END IF;

    -- Define status resultante padrão se não enviado
    IF v_status_resultante IS NULL OR pg_catalog.btrim(v_status_resultante) = '' THEN
        IF v_animal.tem_tutor THEN
            v_status_resultante := 'Atendido';
        ELSE
            v_status_resultante := 'Em Tratamento';
        END IF;
    END IF;

    -- 3. INSERÇÃO DO PRONTUÁRIO CLÍNICO (clinical_records)
    INSERT INTO public.clinical_records (
        id,
        animal_id,
        veterinario_id,
        data_atendimento,
        inativo,
        vacinas,
        parasitas,
        temperatura,
        peso,
        mucosa,
        palpacao_abdominal,
        hidratacao,
        ausculta_cardiaca,
        ausculta_pulmonar,
        frequencia_cardiaca,
        frequencia_respiratoria,
        observacoes_gerais,
        exames_solicitados,
        tratamento_ambulatorial,
        diagnostico_clinico,
        status_resultante,
        data_obito,
        causa_obito,
        data_soltura,
        local_soltura,
        recommended_kennel_type,
        accommodation_justification,
        necessita_internacao,
        v10_aplicada,
        v10_data,
        antirrabica_aplicada,
        antirrabica_data,
        vermifugo_aplicado,
        vermifugo_data,
        microchip_aplicado,
        numero_microchip_aplicado,
        created_at
    ) VALUES (
        v_record_id,
        v_animal_id,
        v_vet_id,
        COALESCE(v_record->>'dataAtendimento', v_now_iso),
        false,
        v_record->>'vacinas',
        v_record->>'parasitas',
        v_record->>'temperatura',
        v_record->>'peso',
        v_record->>'mucosa',
        v_record->>'palpacaoAbdominal',
        v_record->>'hidratacao',
        v_record->>'auscultaCardiaca',
        v_record->>'auscultaPulmonar',
        v_record->>'frequenciaCardiaca',
        v_record->>'frequenciaRespiratoria',
        v_record->>'observacoesGerais',
        v_record->>'examesSolicitados',
        v_record->>'tratamentoAmbulatorial',
        v_record->>'diagnosticoClinico',
        v_status_resultante,
        v_record->>'dataObito',
        v_record->>'causaObito',
        v_record->>'dataSoltura',
        v_record->>'localSoltura',
        v_record->>'recommendedKennelType',
        v_record->>'accommodationJustification',
        COALESCE((v_record->>'necessitaInternacao')::boolean, false),
        COALESCE((v_record->>'v10Aplicada')::boolean, false),
        v_record->>'v10Data',
        COALESCE((v_record->>'antirrabicaAplicada')::boolean, false),
        v_record->>'antirrabicaData',
        COALESCE((v_record->>'vermifugoAplicado')::boolean, false),
        v_record->>'vermifugoData',
        COALESCE((v_record->>'microchipAplicado')::boolean, false),
        v_record->>'numeroMicrochipAplicado',
        v_now_ts
    );

    -- 4. INSERÇÃO DAS RECEITAS / PRESCRIÇÕES (se houver)
    IF v_prescriptions IS NOT NULL AND pg_catalog.jsonb_typeof(v_prescriptions) = 'array' THEN
        FOR v_prescription_item IN SELECT * FROM pg_catalog.jsonb_array_elements(v_prescriptions)
        LOOP
            v_presc_id := v_prescription_item->>'id';
            IF v_presc_id IS NULL OR pg_catalog.btrim(v_presc_id) = '' THEN
                v_presc_id := pg_catalog.gen_random_uuid()::text;
            END IF;

            INSERT INTO public.prescriptions (
                id,
                animal_id,
                prontuario_id,
                veterinario_id,
                medicamento,
                dosagem,
                via,
                frequencia,
                duracao,
                observacoes,
                data_emissao,
                created_at
            ) VALUES (
                v_presc_id,
                v_animal_id,
                v_record_id,
                v_vet_id,
                COALESCE(v_prescription_item->>'medicamento', 'Não informado'),
                COALESCE(v_prescription_item->>'dosagem', ''),
                COALESCE(v_prescription_item->>'via', 'Oral'),
                COALESCE(v_prescription_item->>'frequencia', ''),
                COALESCE(v_prescription_item->>'duracao', ''),
                v_prescription_item->>'observacoes',
                COALESCE(v_prescription_item->>'dataEmissao', v_now_iso),
                v_now_ts
            ) ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END IF;

    -- 5. ATUALIZAÇÃO DO ANIMAL: NOVO STATUS RESULTANTE E LIBERAÇÃO DO BLOQUEIO
    UPDATE public.animals
    SET condicao = v_status_resultante,
        em_atendimento_vet_id = NULL,
        em_atendimento_inicio = NULL,
        peso = CASE 
            WHEN v_record->>'peso' IS NOT NULL AND (v_record->>'peso') ~ '^[0-9]+(\.[0-9]+)?$' 
            THEN (v_record->>'peso')::double precision 
            ELSE peso 
        END,
        necessita_internacao = COALESCE((v_record->>'necessitaInternacao')::boolean, necessita_internacao),
        tipo_acomodacao_sugerida = COALESCE(v_record->>'recommendedKennelType', tipo_acomodacao_sugerida),
        justificativa_internacao = COALESCE(v_record->>'accommodationJustification', justificativa_internacao),
        data_obito = COALESCE(v_record->>'dataObito', data_obito),
        causa_obito = COALESCE(v_record->>'causaObito', causa_obito),
        data_soltura = COALESCE(v_record->>'dataSoltura', data_soltura),
        local_soltura = COALESCE(v_record->>'localSoltura', local_soltura),
        microchipado = CASE WHEN (v_record->>'microchipAplicado')::boolean THEN true ELSE microchipado END,
        numero_microchip = COALESCE(v_record->>'numeroMicrochipAplicado', numero_microchip)
    WHERE id = v_animal_id;

    -- 6. REGISTRO DE AUDITORIA EM status_logs
    INSERT INTO public.status_logs (
        id,
        animal_id,
        status_anterior,
        status_novo,
        data_alteracao,
        usuario_id,
        prontuario_id
    ) VALUES (
        pg_catalog.gen_random_uuid()::text,
        v_animal_id,
        v_animal.condicao,
        v_status_resultante,
        v_now_iso,
        v_vet_id,
        v_record_id
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'record_id', v_record_id,
        'animal_id', v_animal_id,
        'status_resultante', v_status_resultante,
        'necessita_internacao', COALESCE((v_record->>'necessitaInternacao')::boolean, false),
        'message', 'Atendimento finalizado com sucesso com integridade transacional garantida.'
    );
END;
$$;

-- Permissões de execução para authenticated
REVOKE ALL ON FUNCTION public.start_clinical_attendance(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_clinical_attendance(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_clinical_attendance(JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_clinical_attendance(TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.cancel_clinical_attendance(TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.finish_clinical_attendance(JSONB) TO authenticated, service_role, anon;
