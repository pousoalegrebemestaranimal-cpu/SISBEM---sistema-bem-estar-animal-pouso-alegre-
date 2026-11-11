-- Migração: Correção da identificação do médico veterinário em start e finish attendance
-- Permite localizar o profissional tanto pelo id canônico quanto pelo uid oficial do Supabase Auth

CREATE OR REPLACE FUNCTION public.start_clinical_attendance(p_animal_id text, p_vet_id text DEFAULT NULL::text) 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
    v_actual_vet_id TEXT := p_vet_id;
    v_jwt_uid TEXT;
    v_jwt_user RECORD;
    v_vet RECORD;
    v_animal RECORD;
    v_occupying_vet RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
    IF p_animal_id IS NULL OR pg_catalog.btrim(p_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'INVALID_PARAM',
            'message', 'Identificador do animal é obrigatório.'
        );
    END IF;

    v_jwt_uid := pg_catalog.current_setting('request.jwt.claim.sub', true);
    IF v_jwt_uid IS NOT NULL AND v_jwt_uid <> '' THEN
        SELECT id, name, role INTO v_jwt_user FROM public.users WHERE uid = v_jwt_uid OR id = v_jwt_uid LIMIT 1;
        IF FOUND THEN
            IF v_actual_vet_id IS NOT NULL AND v_actual_vet_id <> v_jwt_user.id AND v_jwt_user.role <> 'ADMIN' THEN
                RETURN pg_catalog.jsonb_build_object(
                    'success', false,
                    'code', 'UNAUTHORIZED_VET',
                    'message', 'Tentativa de impersonação de veterinário bloqueada: o ID informado difere do usuário autenticado.'
                );
            END IF;
            IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
                v_actual_vet_id := v_jwt_user.id;
            END IF;
        END IF;
    END IF;

    IF v_actual_vet_id IS NULL OR pg_catalog.btrim(v_actual_vet_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Identidade do veterinário não informada ou não autenticada.'
        );
    END IF;

    -- Valida existência e papel do usuário (por id ou uid oficial do Supabase Auth)
    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_actual_vet_id OR uid = v_actual_vet_id LIMIT 1;
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

    v_actual_vet_id := v_vet.id;

    -- BLOQUEIO PESSIMISTA EXCLUSIVO (FOR UPDATE)
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

    IF v_animal.condicao = 'Em Atendimento' AND v_animal.em_atendimento_vet_id IS NOT NULL AND pg_catalog.btrim(v_animal.em_atendimento_vet_id) <> '' THEN
        IF v_animal.em_atendimento_vet_id = v_actual_vet_id OR v_animal.em_atendimento_vet_id = v_vet.uid THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', true,
                'animal_id', v_animal.id,
                'animal_nome', v_animal.nome,
                'condicao', v_animal.condicao,
                'vet_id', v_vet.id,
                'vet_nome', v_vet.name,
                'inicio', v_animal.em_atendimento_inicio,
                'reentry', true,
                'message', 'Atendimento em andamento retomado pelo mesmo profissional.'
            );
        ELSE
            SELECT id, name INTO v_occupying_vet FROM public.users WHERE id = v_animal.em_atendimento_vet_id OR uid = v_animal.em_atendimento_vet_id LIMIT 1;
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'code', 'ALREADY_IN_ATTENDANCE',
                'animal_id', v_animal.id,
                'animal_nome', v_animal.nome,
                'vet_id', v_animal.em_atendimento_vet_id,
                'vet_nome', COALESCE(v_occupying_vet.name, 'outro profissional'),
                'inicio', v_animal.em_atendimento_inicio,
                'message', 'Este animal já está em atendimento por ' || COALESCE(v_occupying_vet.name, 'outro profissional') || '.'
            );
        END IF;
    END IF;

    UPDATE public.animals
    SET condicao = 'Em Atendimento',
        em_atendimento_vet_id = v_actual_vet_id,
        em_atendimento_inicio = v_now_iso
    WHERE id = p_animal_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'animal_id', v_animal.id,
        'animal_nome', v_animal.nome,
        'condicao', 'Em Atendimento',
        'vet_id', v_vet.id,
        'vet_nome', v_vet.name,
        'inicio', v_now_iso,
        'message', 'Atendimento iniciado com sucesso.'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finish_clinical_attendance(p_payload jsonb) 
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
    v_record JSONB := p_payload->'record';
    v_prescriptions JSONB := p_payload->'prescriptions';
    v_animal_id TEXT;
    v_vet_id TEXT;
    v_record_id TEXT;
    v_status_resultante TEXT;
    v_necessita_internacao BOOLEAN;
    v_data_atendimento TEXT;
    v_parsed_date TIMESTAMPTZ;
    v_animal RECORD;
    v_vet RECORD;
    v_existing_record RECORD;
    v_jwt_uid TEXT;
    v_jwt_user RECORD;
    v_now_ts TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_now_iso TEXT := pg_catalog.to_char(v_now_ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_prescription_item JSONB;
    v_presc_id TEXT;
BEGIN
    IF v_record IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PAYLOAD', 'message', 'Dados do prontuário ausentes.');
    END IF;

    v_animal_id := v_record->>'animalId';
    v_vet_id := COALESCE(v_record->>'authenticatedVetId', v_record->>'veterinarioId');
    v_record_id := v_record->>'id';
    v_status_resultante := v_record->>'statusResultante';
    v_necessita_internacao := COALESCE((v_record->>'necessitaInternacao')::boolean, false);
    v_data_atendimento := v_record->>'dataAtendimento';

    IF v_animal_id IS NULL OR pg_catalog.btrim(v_animal_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'INVALID_PARAM', 'message', 'animalId obrigatório.');
    END IF;

    v_jwt_uid := pg_catalog.current_setting('request.jwt.claim.sub', true);
    IF v_jwt_uid IS NOT NULL AND v_jwt_uid <> '' THEN
        SELECT id, name, role INTO v_jwt_user FROM public.users WHERE uid = v_jwt_uid OR id = v_jwt_uid LIMIT 1;
        IF FOUND THEN
            IF v_vet_id IS NOT NULL AND v_vet_id <> v_jwt_user.id AND v_jwt_user.role <> 'ADMIN' THEN
                RETURN pg_catalog.jsonb_build_object(
                    'success', false,
                    'code', 'UNAUTHORIZED_VET',
                    'message', 'Tentativa de impersonação de veterinário bloqueada: veterinarioId difere do usuário autenticado.'
                );
            END IF;
            IF v_vet_id IS NULL OR pg_catalog.btrim(v_vet_id) = '' THEN
                v_vet_id := v_jwt_user.id;
            END IF;
        END IF;
    END IF;

    IF v_vet_id IS NULL OR pg_catalog.btrim(v_vet_id) = '' THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'Identidade do veterinário não informada ou não autenticada.');
    END IF;

    IF v_record_id IS NULL OR pg_catalog.btrim(v_record_id) = '' THEN
        v_record_id := pg_catalog.gen_random_uuid()::text;
    END IF;

    -- Valida veterinário por id ou uid oficial
    SELECT id, name, role INTO v_vet FROM public.users WHERE id = v_vet_id OR uid = v_vet_id LIMIT 1;
    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Veterinário responsável não existe no sistema.');
    END IF;

    IF v_vet.role NOT IN ('VETERINARIO', 'ADMIN') THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Apenas veterinários e administradores podem finalizar atendimentos.');
    END IF;

    v_vet_id := v_vet.id;

    -- IDEMPOTÊNCIA & CONFLITO DE IDEMPOTÊNCIA
    SELECT id, animal_id, veterinario_id INTO v_existing_record
    FROM public.clinical_records
    WHERE id = v_record_id;

    IF FOUND THEN
        IF v_existing_record.animal_id = v_animal_id AND (v_existing_record.veterinario_id = v_vet_id OR v_existing_record.veterinario_id = v_vet.uid) THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', true,
                'idempotent', true,
                'record_id', v_record_id,
                'message', 'Atendimento já havia sido finalizado anteriormente com sucesso.'
            );
        ELSE
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'code', 'IDEMPOTENCY_CONFLICT',
                'message', 'Conflito de idempotência: o recordId informado já existe com dados divergentes (animal ou veterinário incompatível).'
            );
        END IF;
    END IF;

    -- BLOQUEIO PESSIMISTA EXCLUSIVO (FOR UPDATE)
    SELECT id, condicao, tem_tutor, em_atendimento_vet_id
    INTO v_animal
    FROM public.animals
    WHERE id = v_animal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'code', 'ANIMAL_NOT_FOUND', 'message', 'Animal não encontrado.');
    END IF;

    IF v_status_resultante IS NULL OR pg_catalog.btrim(v_status_resultante) = '' THEN
        IF v_animal.tem_tutor THEN
            v_status_resultante := 'Atendido';
        ELSE
            v_status_resultante := 'Em Tratamento';
        END IF;
    END IF;

    IF v_data_atendimento IS NOT NULL AND pg_catalog.btrim(v_data_atendimento) <> '' THEN
        BEGIN
            v_parsed_date := v_data_atendimento::TIMESTAMPTZ;
        EXCEPTION WHEN OTHERS THEN
            v_data_atendimento := v_now_iso;
        END;
    ELSE
        v_data_atendimento := v_now_iso;
    END IF;

    -- INSERÇÃO DO PRONTUÁRIO CLÍNICO (clinical_records)
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
        v_vet.id,
        v_data_atendimento,
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
        v_necessita_internacao,
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

    -- INSERÇÃO DAS RECEITAS
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
                v_vet.id,
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

    -- ATUALIZAÇÃO DO ANIMAL: LIBERAÇÃO DO LOCK E NOVO STATUS
    UPDATE public.animals
    SET condicao = v_status_resultante,
        em_atendimento_vet_id = NULL,
        em_atendimento_inicio = NULL,
        peso = CASE 
            WHEN v_record->>'peso' IS NOT NULL AND (v_record->>'peso') ~ '^[0-9]+(\.[0-9]+)?$' 
            THEN (v_record->>'peso')::double precision 
            ELSE peso 
        END,
        necessita_internacao = v_necessita_internacao,
        tipo_acomodacao_sugerida = COALESCE(v_record->>'recommendedKennelType', tipo_acomodacao_sugerida),
        justificativa_internacao = COALESCE(v_record->>'accommodationJustification', justificativa_internacao),
        data_obito = COALESCE(v_record->>'dataObito', data_obito),
        causa_obito = COALESCE(v_record->>'causaObito', causa_obito),
        data_soltura = COALESCE(v_record->>'dataSoltura', data_soltura),
        local_soltura = COALESCE(v_record->>'localSoltura', local_soltura),
        microchipado = CASE WHEN (v_record->>'microchipAplicado')::boolean THEN true ELSE microchipado END,
        numero_microchip = COALESCE(v_record->>'numeroMicrochipAplicado', numero_microchip)
    WHERE id = v_animal_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'record_id', v_record_id,
        'animal_id', v_animal_id,
        'status_resultante', v_status_resultante,
        'vet_id', v_vet.id,
        'vet_nome', v_vet.name,
        'necessita_internacao', v_necessita_internacao,
        'message', 'Atendimento finalizado com sucesso com integridade transacional garantida.'
    );
END;
$function$;
