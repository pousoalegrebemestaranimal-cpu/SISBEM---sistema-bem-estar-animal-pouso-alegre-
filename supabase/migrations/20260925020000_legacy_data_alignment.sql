-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION: 20260925020000_legacy_data_alignment.sql
-- FASE 1.1.3: ALINHAMENTO DE IDENTIDADE E DADOS LEGADOS
-- Sincronização e compatibilidade entre Supabase e Cloud SQL
-- ==============================================================================

-- 1. Sincronização de Usuários (Preservando IDs, Roles e Hashes de Autenticação)
INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '03632964-ac64-43c1-a94d-f80352e0af99',
  'sb_sha256:fe96a1180a2ea1fde29020acbdc89030f76ae8a3ed18fc1264009516c1d3ca80',
  'Naiara Souza',
  'naiara',
  'OPERATOR',
  NULL,
  NULL,
  NULL,
  '2026-09-21T12:51:44.638851+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '061aa334-5762-44b5-b4ba-b680b31d39f5',
  'sb_sha256:b21c7f2fe2631907646cea0ae118ae8fdf19b113f6e75929370cafd4866ede9b',
  'Maira de Carvalho Simões ',
  'maira',
  'VETERINARIO',
  '28919',
  '23961',
  NULL,
  '2026-09-21T14:12:55.280923+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '1',
  'sb_sha256:8d872adb68b63106ca7d10edf97f3fb59f6804bbc1f54a686d9bd8f99c6daef8',
  'Administrador SISBEM',
  'admin',
  'ADMIN',
  NULL,
  NULL,
  NULL,
  '2026-09-21T12:16:31.464525+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '2',
  'sb_sha256:dd6a4ffd57e73c840d8254f33ad42af2abfb0448763710c0da68d4b6a1b10111',
  'Dr. Roberto Santos',
  'vet01',
  'VETERINARIO',
  '12345/MG',
  '99887',
  NULL,
  '2026-09-25T16:30:39.951449+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '3',
  'sb_sha256:45151df59c5d8a9aed1f6e9e94e0328da9f4ec3db3b7a5e3746367cf3ec1b224',
  'Dra. Camila Rocha',
  'vet02',
  'VETERINARIO',
  '18492/MG',
  '99888',
  NULL,
  '2026-09-25T16:30:39.951449+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '300540f5-a64b-45e5-9195-a7a677318d9a',
  'sb_sha256:8af235ec435b721dd4fecf612fb432d31ec648e5ae97a2665789b42af364db7a',
  'Daniel José de Paula',
  'daniel',
  'VETERINARIO',
  '34377/MG',
  '23742',
  NULL,
  '2026-09-21T13:25:27.221162+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '35416324-db29-4c43-94c2-574d92434c00',
  'sb_sha256:bbb6c50bf6a42d99a12ab3e1a35686b19abd3de784340ae0a8a0317482de1a64',
  'Tatiane Cristina Moreira da Silva',
  'tatiane',
  'VETERINARIO',
  '15704',
  '24163-1',
  'tatianevet11@gmail.com',
  '2026-09-24T17:02:27.820603+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '4',
  'sb_sha256:aac1defb2d4af816832c4bbd0bb8d8fb2ee9b9fe80d3cefacde028cf5dfacfdd',
  'Dr. Marcos Alvarenga',
  'vet03',
  'VETERINARIO',
  '22110/MG',
  '99890',
  NULL,
  '2026-09-25T16:30:39.951449+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '5',
  'sb_sha256:eb1fc30631b97b8e375b60fa93b6f82c8c4404336522ba27dd00f476025e2f01',
  'Mariana Albuquerque',
  'op01',
  'OPERATOR',
  NULL,
  '99889',
  NULL,
  '2026-09-25T16:30:39.951449+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  '68b572dd-bc3f-48e9-a74d-44b6e36b1e8d',
  'sb_sha256:21f692e94a747e39d57ddf5d995c56fa9c67755e2baa2969dfdad6870e2a8b7d',
  'Luiz Fenando da Silva',
  'fernandosilva',
  'VETERINARIO',
  '32377',
  '23780-2',
  'luizfernandosilva.medvet@gmail.com',
  '2026-09-25T16:01:03.573042+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  'c5de63b2-5bca-4566-be73-33c92265eff2',
  'sb_sha256:0fa217292b6785da0dd140b3dd67a14f2a1f4b06aa315c80f5099e0b587f0750',
  'Lucas de Paula Gonçalves ',
  'lucas',
  'VETERINARIO',
  '34381/MG',
  '23782-1',
  NULL,
  '2026-09-21T13:14:32.012355+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  'ef7d9362-d4ae-4426-8617-6c9ccb3174a0',
  'sb_sha256:0f2b7c91b130bbd29758690fe91eec3eccab2bf0b0a0e029d208a2498f418dc2',
  'Isabella Silva',
  'isabella',
  'VETERINARIO',
  '36307',
  '249071',
  NULL,
  '2026-09-21T16:43:21.402446+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

INSERT INTO public.users (id, uid, name, username, role, crmv, matricula, email, created_at)
VALUES (
  'ff3e3bc6-478b-49a9-acff-1afe5c6a75dd',
  'sb_sha256:7c9d19fe72347b9489152f9c51545a559c212969cadf29be7b445c659afeb587',
  'Rayssa C. Lopes Alvarenga ',
  'rayssalopes',
  'VETERINARIO',
  '33347',
  '23700',
  'rayscris@hotmail.com',
  '2026-09-24T11:43:40.61752+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  uid = COALESCE(EXCLUDED.uid, public.users.uid),
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  crmv = COALESCE(EXCLUDED.crmv, public.users.crmv),
  matricula = COALESCE(EXCLUDED.matricula, public.users.matricula),
  email = COALESCE(EXCLUDED.email, public.users.email);

-- 2. Sincronização de Solicitantes
INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  '34b99cf8-faad-403d-9644-b33a3294fecc',
  'Solicitante Desconhecido',
  '000.000.000-00',
  'Não informado',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  '3c786334-5445-4c05-bb09-6365b34689f8',
  'ADOTE UM VIRALATA ',
  'ONG-bc4897e3',
  '(35) 93416-5465',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  '8b4744c0-a445-4b9f-80e6-824ab3a17d2a',
  'adote um viralata ',
  'ONG-92b7b1cc',
  '(35) 90231-6541',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'b0c75260-1e7d-4e9d-8cae-07c5f272ae94',
  'luiz fernando ',
  '105.887.346-67',
  '(35) 92201-7266',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'dbd159ce-a3dc-4244-b20f-9f3e838e0d53',
  'adote um viralata ',
  'ONG-f5d921e2',
  '(95) 38800-7306',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'e79e1401-c360-4274-83ad-3875507f7134',
  'Recanto Dos Patudos',
  '537947788000154',
  '(35) 96541-5465',
  'ONG',
  'ONG-04',
  'Monica',
  'canta galo',
  NULL,
  NULL,
  '2026-09-18T17:56:50.78484+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'f940a307-cac1-4b3d-8a8f-678e0a0d7e14',
  'adote um viralata ',
  'ONG-9d078730',
  '(35) 93215-4422',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'inst-bombeiros',
  'Corpo de Bombeiros',
  'INST-BOMBEIROS',
  '193',
  'ORGAO_PUBLICO',
  NULL,
  NULL,
  'Rua Afonso Pena, 400 - Centro, Pouso Alegre',
  NULL,
  NULL,
  '2026-09-18T17:56:50.78484+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'inst-desconhecido',
  'Solicitante Desconhecido / Anônimo',
  'DESC-ANONIMO',
  'Não informado',
  'DESCONHECIDO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-18T17:56:50.78484+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'inst-pa',
  'Polícia Militar de Meio Ambiente',
  'INST-PA',
  '(35) 3429-1900',
  'ORGAO_PUBLICO',
  NULL,
  NULL,
  'Rodovia Fernão Dias, Km 850',
  NULL,
  NULL,
  '2026-09-18T17:56:50.78484+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'inst-pm',
  'Polícia Militar de Minas Gerais (190)',
  'INST-PM',
  '190',
  'ORGAO_PUBLICO',
  NULL,
  NULL,
  'Av. Vicente Simões, 1100',
  NULL,
  NULL,
  '2026-09-18T17:56:50.78484+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'sol-particular',
  'Maria Silva Oliveira',
  '111.111.111-11',
  '(11) 98888-7777',
  'CIDADAO',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:53:12.433238+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitantes (id, nome_completo, cpf, telefone, tipo, codigo_ong, responsavel, endereco, email, observacoes, created_at)
VALUES (
  'system-configs-v1',
  'Configurações do Sistema (SISBEM)',
  'CONFIG-SYSTEM',
  '0000',
  'ORGAO_PUBLICO',
  NULL,
  NULL,
  NULL,
  NULL,
  '[{"type":"Individual","count":54,"capacity":2},{"type":"Coletiva","count":11,"capacity":5},{"type":"Quarentena","count":9,"capacity":1},{"type":"Gatil","count":43,"capacity":3},{"type":"Pré-operatório","count":3,"capacity":1},{"type":"Pós-operatório","count":6,"capacity":1}]',
  '2026-09-24T16:44:39.133+00:00'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Sincronização de Tutores
INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '175d3c06-3aaa-4418-b2e0-4316e7056faa',
  'Adriele Caroline Teixeira',
  '090.797.496-13',
  '(35) 99944-9309',
  'Rua B, 15, Solar dos Quita',
  true,
  NULL,
  '2026-09-24T16:11:44.061Z',
  '2026-09-24T16:11:44.813383+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '2257f6f8-f0ca-481f-ab10-6235d37db947',
  'Igor Lucas Gomes',
  '110.193.806-40',
  '(35) 99193-4376',
  'Rua Graciema de Paula Rios, 231, São Geraldo',
  true,
  NULL,
  '2026-09-24T17:46:52.346Z',
  '2026-09-24T17:46:53.643404+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '26669d45-f9cd-4171-b95f-1d7806d3d0a6',
  'Lilian Gomes Damas',
  '059.360.846-12',
  '(11) 91480-2537',
  'Rua Dois, 185, Cidade Jardim',
  false,
  NULL,
  '2026-09-24T16:54:49.841Z',
  '2026-09-24T16:54:50.520853+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '2adadd54-bde2-4ef7-8cec-036d02fb34e1',
  'Rosana Ramos da Silva Souza',
  '040.048.876-07',
  '(35) 99194-0968',
  'Rua Ozorio Malaquias do Prado, 240, São João',
  true,
  NULL,
  '2026-09-24T17:53:51.792Z',
  '2026-09-24T17:53:52.95212+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '41770e08-d59a-456e-8def-85919375cc33',
  'Sueli Rosa de Freitas',
  '586.805.196-34',
  '(35) 99173-9032',
  'Rua Cassimiro Luiz de Abreu, 171, Santo Luzia',
  true,
  NULL,
  '2026-09-24T16:08:14.657Z',
  '2026-09-24T16:08:15.857264+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '465b4711-d30f-4fad-bf9c-0d5be95221ec',
  'Elisandra Aparecida Cavalcante',
  '052.576.646-40',
  '(35) 99812-4489',
  'Rua Antônio Pereira Sobrinho, 595, São Geraldo',
  true,
  NULL,
  '2026-09-24T14:03:52.566Z',
  '2026-09-24T14:03:52.854591+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '594c9393-77e0-4f1f-839a-ea26e3933596',
  'Thamires Vilas Boas',
  '113.420.836-79',
  '(35) 99919-0862',
  'Rua Antônio Augusto Vieira, 110, Morumbi',
  false,
  NULL,
  '2026-09-24T17:06:04.917Z',
  '2026-09-24T17:06:05.594611+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  '9d268e7d-a379-44cd-9bde-cd9d259b4566',
  'luiz fernando',
  '105.887.346-67',
  '(35) 20018-5465',
  'afonsos',
  false,
  NULL,
  '2026-09-21T12:31:15.334Z',
  '2026-09-24T17:21:51.923613+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tutores (id, nome_completo, cpf, telefone, endereco, tem_cad_unico, documento_cad_unico, data_cadastro, created_at)
VALUES (
  'dfe32f36-343b-43fb-9abf-c28acd8f9afd',
  'Maria de Fátima Silva',
  '693.704.606-59',
  '(35) 99731-8369',
  'Rua das Saudades, 134, Jardim Yara',
  true,
  NULL,
  '2026-09-24T15:52:24.459Z',
  '2026-09-24T15:52:25.799211+00:00'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Sincronização de Animais Legados (Incluindo LUKE)
INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '14506a01-4675-42c0-b88d-8868e022b6d5',
  'TIO PATINHAS',
  25,
  '13',
  'PRETO E CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'BR 381',
  '2016-11-01',
  'Não foi informado.',
  '2026-09-22T13:24:59.308Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T13:25:00.898954+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '20117955-0010-426f-ab13-c85ed678ccc0',
  'SEM NOME',
  2.9,
  '2',
  'AMARELO',
  'Gato',
  'SRD',
  'Pequeno',
  'Macho',
  false,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Dificuldade respiratória, não come',
  '2026-09-24T17:53:51.805Z',
  '1',
  NULL,
  '2adadd54-bde2-4ef7-8cec-036d02fb34e1',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T17:53:52.459633+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '372a3f04-ca2a-4504-b8a9-2a117558180c',
  'TINTONES',
  20,
  '12',
  'MARROM',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'São Geraldo',
  '2017-05-01',
  'Animal trazido pelos Bombeiros, pois era agressivo.',
  '2026-09-22T14:53:57.180Z',
  '1',
  'inst-bombeiros',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T14:53:59.258901+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '3bb890ca-1720-4128-a7ff-bfcbc1e7763b',
  'TUNICO',
  3.3,
  '3',
  'Cinza e Preto',
  'Gato',
  'SRD',
  'Pequeno',
  'Macho',
  true,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Diarreia a 3 meses',
  '2026-09-24T14:03:52.567Z',
  '1',
  '34b99cf8-faad-403d-9644-b33a3294fecc',
  '465b4711-d30f-4fad-bf9c-0d5be95221ec',
  'Atendido',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T14:03:52.745264+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '3cd39df8-e7d4-4589-ac7f-bd6e5e06feb1',
  'Lao',
  14.5,
  '+10',
  'caramelo claro',
  'Cão',
  'srd',
  'Médio',
  'Macho',
  false,
  false,
  NULL,
  false,
  'Não informado',
  '2026-09-24',
  'Emagrecimento progressivo',
  '2026-09-24T14:07:54.049Z',
  '061aa334-5762-44b5-b4ba-b680b31d39f5',
  'inst-desconhecido',
  NULL,
  'Em Tratamento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T14:07:54.093189+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '4351be23-0355-4458-9c90-635c33a9c2bb',
  'TRIPEZINHA',
  15,
  '9',
  'MARROM',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'Não foi informado',
  '2017-03-01',
  'Não foi informado.',
  '2026-09-22T14:16:44.356Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T14:16:46.189564+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '46f92cb9-a6f0-465f-8f78-2e2d09f01ffc',
  'LILI',
  15,
  '6',
  'PRETA E BRANCA',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'ALGODÃO',
  '2023-09-12',
  'Atropelamento, MPE amputado.',
  '2026-09-24T12:54:18.029Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T12:54:17.853964+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '4c9a5f50-3049-42d5-ae77-6b5cb531d2f1',
  'EVARISTO',
  15,
  '6',
  'PRETO E AMARELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'CENTRO',
  '2023-07-11',
  'Animal cego.',
  '2026-09-24T12:51:13.945Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T12:51:13.623953+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '5129a769-1675-4948-8149-6317063a8aa4',
  'teste ',
  12,
  '12',
  'preto ',
  'Cão',
  'srd',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-25',
  'morto ',
  '2026-09-25T16:10:46.886Z',
  '1',
  NULL,
  '9d268e7d-a379-44cd-9bde-cd9d259b4566',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-25T16:10:46.965632+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '551ad92c-c6c7-45b4-87c0-f4ef78c5fc6a',
  'Vicente ',
  22,
  '12',
  'bege e preto',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'chaves',
  '2026-09-23',
  'otite crônica ',
  '2026-09-23T16:13:32.068Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-23T16:13:31.928899+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '5b6a8bd5-4bf3-4a74-a8d7-185dab86700c',
  'SCAR',
  30.3,
  '1 ANO, 4 MESES E 10 DIAS',
  'AMARELO',
  'Cão',
  'GOLGEN RETRIEVER',
  'Grande',
  'Macho',
  false,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Vomitando, não come.',
  '2026-09-24T16:11:44.077Z',
  '1',
  NULL,
  '175d3c06-3aaa-4418-b2e0-4316e7056faa',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T16:11:44.627369+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '640089a6-3cf3-48ed-8cb2-47ff1d166d80',
  'APOLLO',
  15.5,
  '2',
  'Cinza',
  'Cão',
  'BULLDOGUE',
  'Pequeno',
  'Macho',
  true,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Animal com dor ao tocar na lombar',
  '2026-09-24T17:46:52.353Z',
  '1',
  NULL,
  '2257f6f8-f0ca-481f-ab10-6235d37db947',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T17:46:53.072302+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '67cadc7d-7b1c-446f-9cd6-e2147795d0df',
  'OLARIA',
  15,
  '10',
  'CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'JARDIM YARA',
  '2018-06-01',
  'Membro dianteiro esquerdo fraturado, teve que amputar.',
  '2026-09-22T15:09:21.884Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T15:09:23.97051+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '6a85bffc-0617-4bd3-b076-26e85248967f',
  'DITO',
  8,
  '6',
  'BEGE CLARO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'CENTRO',
  '2020-06-03',
  'Atropelamento.',
  '2026-09-22T19:06:25.045Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T19:06:26.26176+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '7a06f835-2340-4348-81b5-0d8a65ab7930',
  'DAVID',
  25,
  '5',
  'Preto e Branco',
  'Cão',
  'Pitbull',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'Cristal',
  '2024-02-21',
  'Trazido pelos Bombeiros, estava atacando.',
  '2026-09-24T13:02:44.509Z',
  '1',
  'inst-bombeiros',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T13:02:44.313707+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '808a36d8-33ff-4272-a05f-d306fd0e117a',
  'SONECA',
  10,
  '8',
  'PRETA E BRANCA',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'SÃO GERALDO',
  '2020-03-12',
  'Retirada de acumuladora.',
  '2026-09-22T19:11:23.085Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T19:11:24.372371+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '81510044-0c19-4d98-93e4-f9ae4eda663a',
  'NANDA',
  20,
  '6',
  'PRETA E BRANCA',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'GUADALUPE',
  '2020-07-01',
  'Animal cego e doente.',
  '2026-09-22T18:40:56.182Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T18:40:57.290783+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  '9c8f4d01-9bd2-4ef5-8e71-c8698f1885a8',
  'NEGO',
  25,
  '6',
  'Preto e Branco',
  'Cão',
  'Pitbull',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'Imbuia',
  '2022-05-12',
  'Trazido pelos Bombeiros pois o proprietário morreu e estava sozinho em uma casa.',
  '2026-09-24T12:47:19.212Z',
  '1',
  'inst-bombeiros',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T12:47:18.86795+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'a6cf2971-20ca-4f27-8622-a58856c6decd',
  'pretinha',
  15,
  '15',
  'PRETA',
  'Cão',
  'SRD',
  'Pequeno',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'não informado ',
  '2012-03-22',
  'não há informações ',
  '2026-09-22T11:56:43.628Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T11:56:44.050676+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'ad8aaaea-8464-445f-b0fa-fec9ad3f598a',
  'CHAPISCO',
  2.6,
  '5',
  'Cinza',
  'Gato',
  'SRD',
  'Pequeno',
  'Macho',
  false,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Não come a 1 semana.',
  '2026-09-24T16:08:14.675Z',
  '1',
  '34b99cf8-faad-403d-9644-b33a3294fecc',
  '41770e08-d59a-456e-8def-85919375cc33',
  'Atendido',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T16:08:15.218594+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'b09ba41d-32e2-4693-8a5e-b5c184129b4e',
  'RAFAELA',
  20,
  '15',
  'BRANCA',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'SÃO JOÃO',
  '2013-06-14',
  'Não informado.',
  '2026-09-22T12:50:32.516Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T12:50:34.055838+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'b58b4d9a-2c72-47ee-9c17-5fb4753b62c5',
  'LALA',
  35,
  '10',
  'preta',
  'Cão',
  'pitbull',
  'Médio',
  'Fêmea',
  true,
  true,
  '54164195151',
  false,
  'rua',
  '2026-09-21',
  'animal mora no bem estar a 10 anos ',
  '2026-09-21T20:05:43.619Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-21T20:05:44.253787+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'b94b354c-b737-487b-9d1f-72e2c583da07',
  'GAUCHA',
  35,
  '9',
  'preta e amarela',
  'Cão',
  'Rotwiller',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'Jardim Redentor',
  '2020-11-17',
  'Animal doente.',
  '2026-09-22T18:57:07.309Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T18:57:08.544553+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'c0bcf022-987e-4136-be08-5aa77bbf62a7',
  'BONILA',
  20,
  '7',
  'CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'CAJURU',
  '2020-05-21',
  'Pata quebrada.',
  '2026-09-22T19:17:54.213Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T19:17:55.549037+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'c642e650-a3f9-4c8f-a3d1-aa06bac2980e',
  'FERNANDINHA',
  13.4,
  '2',
  'CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Vomitando sangue, não come.',
  '2026-09-24T16:54:49.855Z',
  '1',
  NULL,
  '26669d45-f9cd-4171-b95f-1d7806d3d0a6',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T16:54:50.330682+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'cd29beb1-a55a-4316-b2eb-59126834077f',
  'GINA',
  12,
  '8',
  'PRETA E CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'SÃO GERALDO',
  '2020-03-10',
  'Animal de tutora acumuladora, idosa e doentes, retirada do local.',
  '2026-09-22T18:48:07.964Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T18:48:09.152261+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'd0d43301-a0a7-46a7-926d-217a3a207f63',
  'LUKE',
  30,
  '15',
  'CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  false,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Orelha machucada.',
  '2026-09-24T15:52:24.471Z',
  '1',
  NULL,
  'dfe32f36-343b-43fb-9abf-c28acd8f9afd',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T15:52:25.144222+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'd44fa650-fb1b-4649-b0a2-ded06c269d17',
  'XANINHA',
  4.4,
  '3',
  'RAJADA',
  'Gato',
  'SRD',
  'Pequeno',
  'Fêmea',
  false,
  false,
  NULL,
  true,
  'Não informado',
  '2026-09-24',
  'Animal comunitário, terceira pálpebra para fora? 
Não sabe se o animal é castrado ou não, o peso é estimado, precisa pesar! ',
  '2026-09-24T17:06:04.932Z',
  '1',
  NULL,
  '594c9393-77e0-4f1f-839a-ea26e3933596',
  'Aguardando Atendimento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-24T17:06:05.508853+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'daf93d68-5afa-4eea-a7b2-dc48c595eeb4',
  'MELO',
  30,
  '12',
  'PRETO E AMARELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'JARDIM AMÉRICA',
  '2022-06-27',
  'ATROPELAMENTO',
  '2026-09-23T17:33:39.074Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-23T17:33:39.613098+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'db0e28e5-5d4b-409b-80be-13bfb9a2180e',
  'LUIS',
  10,
  '4',
  'PRETO E BRANCO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'LIMEIRA',
  '2022-12-12',
  'Atropelado.',
  '2026-09-22T19:34:08.542Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T19:34:10.034803+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'eaaf69c1-d019-447e-85f5-e867e9091537',
  'RÉGIS',
  15,
  '10',
  'CARAMELO',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'SÃO GERALDO',
  '2020-03-10',
  'Retirado de acumuladora.',
  '2026-09-22T19:25:02.206Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T19:25:03.607398+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'f9e7180d-6218-443c-b051-18c6ccf8ed1f',
  'BOMBEIRINHA',
  12,
  '10',
  'RAJADA',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'São Cristóvão',
  '2018-02-06',
  'Atropelamento/Cinomose',
  '2026-09-22T14:59:43.348Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T14:59:45.419778+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'fbc47313-d379-494e-8fc4-f3181d52c32f',
  'Lobinho',
  20,
  '15',
  'preto e marrom',
  'Cão',
  'SRD',
  'Médio',
  'Macho',
  true,
  false,
  NULL,
  false,
  'algoddão ',
  '2012-10-16',
  'abandonado na porta do bem estar ',
  '2026-09-22T12:05:54.735Z',
  '1',
  'inst-desconhecido',
  NULL,
  'Disponível para Adoção',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-22T12:05:54.998493+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.animals (
  id, nome, peso, idade, cor_pelagem, especie, raca, porte, sexo,
  castrado, microchipado, numero_microchip, tem_tutor, local_resgate, data_resgate,
  motivo, data_cadastro, usuario_responsavel_id, solicitante_id, tutor_id,
  condicao, resgate_samuvet, responsavel_samuvet, foto, data_obito, causa_obito,
  data_soltura, local_soltura, data_adocao, adotante_nome, adotante_cpf, adotante_telefone,
  necessita_internacao, tipo_acomodacao_sugerida, justificativa_internacao, data_internacao,
  created_at
) VALUES (
  'fd8a8237-9562-48f3-88d2-d221212cf9b2',
  'firmina',
  24,
  '8',
  'caramelo e preto ',
  'Cão',
  'SRD',
  'Médio',
  'Fêmea',
  true,
  false,
  NULL,
  false,
  'faisqueira ',
  '2025-10-14',
  'não consegue defecar ',
  '2026-09-23T16:55:56.669Z',
  '061aa334-5762-44b5-b4ba-b680b31d39f5',
  'inst-desconhecido',
  NULL,
  'Em Tratamento',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  NULL,
  NULL,
  NULL,
  '2026-09-23T16:55:56.035311+00:00'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Sincronização de Prontuários Clínicos Legados
INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  '003fc773-8837-4a4f-a85c-bcaa1f55e7cc',
  'fd8a8237-9562-48f3-88d2-d221212cf9b2',
  '1',
  '2026-09-24T14:00:29.817Z',
  false,
  NULL,
  NULL,
  '35',
  '24',
  'NORMO',
  'NORMO',
  'NORMO',
  'NORMO',
  'NORMO',
  '120',
  '20',
  'TESTE',
  'NORMO',
  'TESTE',
  'Tumores',
  'Em Tratamento',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  'Individual',
  'TRATAMENTO',
  false,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T14:00:30.265139+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  '7c8cffb5-81ba-4a93-80b2-76bafa4c284f',
  'fd8a8237-9562-48f3-88d2-d221212cf9b2',
  '1',
  '2026-09-24T13:46:10.827Z',
  false,
  NULL,
  NULL,
  '38,5',
  '24',
  'normo',
  'dolorosa',
  'desidratada',
  'normo',
  'normo',
  'normo',
  'leve dispneia',
  NULL,
  'Realizado hemograma e radiografia',
  'Enema 3 dias seguidos, lactulona, buscofin e tramadol. Corrigir alimentação.',
  'Megacolon',
  'Aguardando Atendimento',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  true,
  NULL,
  true,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T13:46:11.309343+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  'a139dc0e-935b-44f7-8a40-1b0eb6a86f44',
  '3cd39df8-e7d4-4589-ac7f-bd6e5e06feb1',
  '1',
  '2026-09-24T14:12:51.081Z',
  false,
  NULL,
  NULL,
  '38,5',
  '14.5',
  'levemente hipocorada e ictérico',
  'Dolorosa',
  'desidratado',
  'edema',
  'esforço',
  'normo',
  'dispneico',
  'Positivo para erlichia em hemograma',
  'Realizado hemograma e Radiografia',
  'Aplicação shotapen, dexametasona, dipirona, dexametasona e tramadol',
  'Suspeita hemoparasitose',
  'Em Tratamento',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  'Individual',
  NULL,
  false,
  true,
  NULL,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T14:12:51.683245+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  'b5b25cd3-b3b7-4694-9fae-aaabea2cc4ba',
  '3bb890ca-1720-4128-a7ff-bfcbc1e7763b',
  'ff3e3bc6-478b-49a9-acff-1afe5c6a75dd',
  '2026-09-24T18:13:24.443Z',
  false,
  NULL,
  NULL,
  NULL,
  '3.3',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'Atendido',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T18:13:25.389503+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  'ca69cdaf-deb6-4826-8f81-6c8a4df2772b',
  '3bb890ca-1720-4128-a7ff-bfcbc1e7763b',
  'ff3e3bc6-478b-49a9-acff-1afe5c6a75dd',
  '2026-09-24T17:14:17.683Z',
  false,
  NULL,
  NULL,
  '38,3',
  '2,7',
  'Anemica',
  'Sem sensibilidade abdominal.',
  'Hipohidratado',
  'NDN',
  'NDN',
  NULL,
  NULL,
  'Responsável relata não ter condições para exames.
Foi administrado duprat gatos, e dado meio comprimido para administrar após 15 dias; probiótico 7 dias e retorno para administrar agemoxi SC.',
  NULL,
  'Agemoxi, soro+bionew,',
  'Animal resgatado há 2 anos e meio, comeu areia de mandioca e logo depois começou a ter diarreia. Come ração, carne. Diarreia liquido todo dia. Apetite normal, urina normal. Animal defecou em consulta, apresenta fezes pastosas amareladas.',
  'Atendido',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T17:14:19.168874+00:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinical_records (
  id, animal_id, veterinario_id, data_atendimento, inativo,
  vacinas, parasitas, temperatura, peso, mucosa, palpacao_abdominal,
  hidratacao, ausculta_cardiaca, ausculta_pulmonar, frequencia_cardiaca,
  frequencia_respiratoria, observacoes_gerais, exames_solicitados,
  tratamento_ambulatorial, diagnostico_clinico, status_resultante,
  data_obito, causa_obito, data_soltura, local_soltura,
  recommended_kennel_type, accommodation_justification, necessita_internacao,
  v10_aplicada, v10_data, antirrabica_aplicada, antirrabica_data,
  vermifugo_aplicado, vermifugo_data, microchip_aplicado, numero_microchip_aplicado,
  created_at
) VALUES (
  'eb0af120-ba3d-44ed-a7d7-723fd173d955',
  'ad8aaaea-8464-445f-b0fa-fec9ad3f598a',
  'ff3e3bc6-478b-49a9-acff-1afe5c6a75dd',
  '2026-09-24T18:23:56.123Z',
  false,
  NULL,
  NULL,
  '38.4',
  '2.6',
  'Hipercorada',
  NULL,
  'desidratado',
  'NDN',
  'Sibilo',
  NULL,
  NULL,
  'Animal esta com os responsáveis há 5 anos e há uma semana apresenta anorexia, secreção ocular, nasal, prostrado, pelagem opaca e embaraçada. Responsáveis retornaram para medicações injetáveis.',
  NULL,
  'Soro 150ml+bionew 2ml+antitóxico 2ml
Shotapen 0,23ml; dexa 0,25ml; Aliv 1ml; dipirona 0,1ml',
  'Felv, FHV-1, Infecção respiratória',
  'Atendido',
  '2026-09-24',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  false,
  NULL,
  '2026-09-24T18:23:57.563034+00:00'
)
ON CONFLICT (id) DO NOTHING;

