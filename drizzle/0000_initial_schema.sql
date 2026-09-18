CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text,
	"email" text,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"role" text NOT NULL,
	"crmv" text,
	"matricula" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "solicitantes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome_completo" text NOT NULL,
	"cpf" text NOT NULL,
	"telefone" text NOT NULL,
	"tipo" text,
	"codigo_ong" text,
	"responsavel" text,
	"endereco" text,
	"email" text,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tutores" (
	"id" text PRIMARY KEY NOT NULL,
	"nome_completo" text NOT NULL,
	"cpf" text NOT NULL,
	"telefone" text NOT NULL,
	"endereco" text,
	"tem_cad_unico" boolean DEFAULT false NOT NULL,
	"documento_cad_unico" text,
	"data_cadastro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kennels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "animals" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"peso" double precision DEFAULT 0 NOT NULL,
	"idade" text,
	"cor_pelagem" text NOT NULL,
	"especie" text NOT NULL,
	"raca" text NOT NULL,
	"porte" text NOT NULL,
	"sexo" text NOT NULL,
	"castrado" boolean DEFAULT false NOT NULL,
	"microchipado" boolean DEFAULT false,
	"numero_microchip" text,
	"tem_tutor" boolean DEFAULT false NOT NULL,
	"local_resgate" text NOT NULL,
	"data_resgate" text NOT NULL,
	"motivo" text DEFAULT '',
	"data_cadastro" text NOT NULL,
	"usuario_responsavel_id" text,
	"solicitante_id" text,
	"tutor_id" text,
	"condicao" text NOT NULL,
	"resgate_samuvet" boolean DEFAULT false NOT NULL,
	"responsavel_samuvet" text,
	"foto" text,
	"data_obito" text,
	"causa_obito" text,
	"data_soltura" text,
	"local_soltura" text,
	"data_adocao" text,
	"adotante_nome" text,
	"adotante_cpf" text,
	"adotante_telefone" text,
	"necessita_internacao" boolean DEFAULT false,
	"tipo_acomodacao_sugerida" text,
	"justificativa_internacao" text,
	"data_internacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kennel_occupations" (
	"id" text PRIMARY KEY NOT NULL,
	"kennel_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"entry_date" text NOT NULL,
	"exit_date" text,
	"vet_id" text NOT NULL,
	"clinical_record_id" text,
	"justification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinical_records" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_id" text NOT NULL,
	"veterinario_id" text NOT NULL,
	"data_atendimento" text NOT NULL,
	"inativo" boolean DEFAULT false NOT NULL,
	"vacinas" text,
	"parasitas" text,
	"temperatura" text,
	"peso" text,
	"mucosa" text,
	"palpacao_abdominal" text,
	"hidratacao" text,
	"ausculta_cardiaca" text,
	"ausculta_pulmonar" text,
	"frequencia_cardiaca" text,
	"frequencia_respiratoria" text,
	"observacoes_gerais" text,
	"exames_solicitados" text,
	"tratamento_ambulatorial" text,
	"diagnostico_clinico" text,
	"status_resultante" text NOT NULL,
	"data_obito" text,
	"causa_obito" text,
	"data_soltura" text,
	"local_soltura" text,
	"recommended_kennel_type" text,
	"accommodation_justification" text,
	"necessita_internacao" boolean DEFAULT false,
	"v10_aplicada" boolean DEFAULT false,
	"v10_data" text,
	"antirrabica_aplicada" boolean DEFAULT false,
	"antirrabica_data" text,
	"vermifugo_aplicado" boolean DEFAULT false,
	"vermifugo_data" text,
	"microchip_aplicado" boolean DEFAULT false,
	"numero_microchip_aplicado" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "prescriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_id" text NOT NULL,
	"prontuario_id" text,
	"veterinario_id" text NOT NULL,
	"medicamento" text NOT NULL,
	"dosagem" text NOT NULL,
	"via" text NOT NULL,
	"frequencia" text NOT NULL,
	"duracao" text NOT NULL,
	"observacoes" text,
	"data_emissao" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_id" text NOT NULL,
	"veterinario_id" text NOT NULL,
	"especialidade" text NOT NULL,
	"motivo" text NOT NULL,
	"local_sugerido" text,
	"urgencia" text NOT NULL,
	"data_emissao" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "surgeries" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_id" text NOT NULL,
	"data_agendada" text NOT NULL,
	"horario" text,
	"turno" text,
	"tipo_cirurgia" text NOT NULL,
	"status" text NOT NULL,
	"prioridade" text NOT NULL,
	"veterinario_responsavel_id" text,
	"veterinario_responsavel_nome" text,
	"observacoes_pre_operatorias" text,
	"observacoes_pos_operatorias" text,
	"receitas_pos_operatorias" jsonb,
	"data_realizacao" text,
	"realizada_por_id" text,
	"realizada_por_nome" text,
	"motivo_cancelamento" text,
	"data_cadastro" text NOT NULL,
	"usuario_criador_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "status_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_id" text NOT NULL,
	"status_anterior" text,
	"status_novo" text NOT NULL,
	"data_alteracao" text NOT NULL,
	"usuario_id" text NOT NULL,
	"prontuario_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_files" (
	"id" text PRIMARY KEY NOT NULL,
	"prontuario_id" text NOT NULL,
	"nome_exame" text NOT NULL,
	"arquivo" text NOT NULL,
	"data_anexo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
