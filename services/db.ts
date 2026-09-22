
import { Animal, Solicitante, Tutor, User, AnimalJoined, AnimalCondicao, ClinicalRecord, Prescription, StatusLog, Kennel, KennelType, KennelOccupation, KennelConfig, Adotante, Especie, Porte, Sexo, AgendamentoCirurgia, CirurgiaStatus, CirurgiaPrioridade, CirurgiaJoined } from '../types';
import {
  syncAnimalToSupabase,
  deleteAnimalFromSupabase,
  syncSolicitanteToSupabase,
  deleteSolicitanteFromSupabase,
  syncTutorToSupabase,
  deleteTutorFromSupabase,
  syncSurgeryToSupabase,
  deleteSurgeryFromSupabase,
  syncRecordToSupabase,
  deleteRecordFromSupabase,
  syncKennelToSupabase,
  syncOccupationToSupabase,
  syncKennelConfigsToSupabase,
  syncKennelsFullToSupabase,
  syncUserToSupabase,
  deleteUserFromSupabase,
  syncAllLocalDataToSupabase,
  pullFromSupabaseToLocal
} from '../src/lib/supabaseSync';

const KEYS = {
  USERS: 'sisbem_users',
  ANIMALS: 'sisbem_animals',
  SOLICITANTES: 'sisbem_solicitantes',
  TUTORES: 'sisbem_tutores',
  CURRENT_USER: 'sisbem_current_user',
  RECORDS: 'sisbem_records',
  STATUS_LOGS: 'sisbem_status_logs',
  KENNELS: 'sisbem_kennels',
  OCCUPATIONS: 'sisbem_occupations',
  KENNEL_CONFIGS: 'sisbem_kennel_configs',
  CIRURGIAS: 'sisbem_cirurgias'
};

export const resetAndSeedAllData = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
  const yesterdayStr = yesterday.split('T')[0];
  const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString();
  const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)).toISOString();
  const lastWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)).toISOString();

  const tomorrowStr = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const inTwoDaysStr = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const inThreeDaysStr = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const inFiveDaysStr = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  // 1. Usuários
  const users: User[] = [
    { id: '1', name: 'Administrador SISBEM', username: 'admin', role: 'ADMIN' },
    { id: '2', name: 'Dr. Roberto Santos', username: 'vet01', role: 'VETERINARIO', crmv: '12345/MG', matricula: '99887' },
    { id: '3', name: 'Dra. Camila Rocha', username: 'vet02', role: 'VETERINARIO', crmv: '18492/MG', matricula: '99888' },
    { id: '4', name: 'Dr. Marcos Alvarenga', username: 'vet03', role: 'VETERINARIO', crmv: '22110/MG', matricula: '99890' },
    { id: '5', name: 'Mariana Albuquerque', username: 'op01', role: 'OPERATOR', matricula: '99889' }
  ];
  localStorage.setItem(KEYS.USERS, JSON.stringify([
    { ...users[0], password: 'admin' },
    { ...users[1], password: 'password123' },
    { ...users[2], password: 'password123' },
    { ...users[3], password: 'password123' },
    { ...users[4], password: 'password123' }
  ]));

  // 2. Configurações de Baias e Acomodação
  const initialConfigs: KennelConfig[] = [
    { type: KennelType.INDIVIDUAL, count: 54, capacity: 1 },
    { type: KennelType.COLETIVA, count: 11, capacity: 5 },
    { type: KennelType.QUARENTENA, count: 9, capacity: 1 },
    { type: KennelType.GATIL, count: 43, capacity: 3 },
    { type: KennelType.PRE_OPERATORIO, count: 3, capacity: 1 },
    { type: KennelType.POS_OPERATORIO, count: 6, capacity: 1 }
  ];
  localStorage.setItem(KEYS.KENNEL_CONFIGS, JSON.stringify(initialConfigs));
  db.syncKennelsWithConfigs(initialConfigs);

  // 3. Solicitantes (Órgãos Públicos, ONGs com códigos, Cidadãos, Protetores)
  const solicitantes: Solicitante[] = [
    { id: 'inst-bombeiros', nomeCompleto: 'Corpo de Bombeiros Militar (193)', cpf: 'INST-BOMBEIROS', telefone: '193', tipo: 'ORGAO_PUBLICO', endereco: 'Rua Afonso Pena, 400 - Centro, Pouso Alegre' },
    { id: 'inst-pm', nomeCompleto: 'Polícia Militar de Minas Gerais (190)', cpf: 'INST-PM', telefone: '190', tipo: 'ORGAO_PUBLICO', endereco: 'Av. Vicente Simões, 1100' },
    { id: 'inst-pa', nomeCompleto: 'Polícia Militar de Meio Ambiente', cpf: 'INST-PA', telefone: '(35) 3429-1900', tipo: 'ORGAO_PUBLICO', endereco: 'Rodovia Fernão Dias, Km 850' },
    { id: 'ong-01', nomeCompleto: 'ONG Vira-Lata Vira Amor', cpf: '23.456.789/0001-01', telefone: '(35) 99123-4567', tipo: 'ONG', codigoOng: 'ONG-01', responsavel: 'Fernanda Lima', endereco: 'Rua das Palmeiras, 120 - Centro' },
    { id: 'ong-02', nomeCompleto: 'ONG SOS Bichos Pouso Alegre', cpf: '34.567.890/0001-12', telefone: '(35) 99876-5432', tipo: 'ONG', codigoOng: 'ONG-02', responsavel: 'Carlos Eduardo', endereco: 'Av. Vicente Simões, 850' },
    { id: 'ong-03', nomeCompleto: 'Associação Protetora dos Animais (APA)', cpf: '45.678.901/0001-23', telefone: '(35) 98822-3344', tipo: 'ONG', codigoOng: 'ONG-03', responsavel: 'Dra. Juliana Costa', endereco: 'Rua Silvestre Ferraz, 45' },
    { id: 'sol-particular-1', nomeCompleto: 'Maria Silva Oliveira', cpf: '111.111.111-11', telefone: '(35) 98888-7777', tipo: 'CIDADAO', endereco: 'Rua Cel. Brito Filho, 140 - Bairro São Geraldo' },
    { id: 'sol-particular-2', nomeCompleto: 'João Carlos Mendonça', cpf: '222.222.222-22', telefone: '(35) 99191-2233', tipo: 'CIDADAO', endereco: 'Av. Pinto Cobra, 900 - Jardim Yara' },
    { id: 'sol-protetor-1', nomeCompleto: 'Cláudia Regina (Protetora Independente)', cpf: '333.333.333-33', telefone: '(35) 99777-8899', tipo: 'PROTETOR', endereco: 'Rua Comendador Custódio, 75 - Bairro Fátima' },
    { id: 'inst-desconhecido', nomeCompleto: 'Solicitante Desconhecido / Anônimo', cpf: 'DESC-ANONIMO', telefone: 'Não informado', tipo: 'DESCONHECIDO' }
  ];
  localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(solicitantes));

  // 4. Tutores (com e sem CadÚnico / Bolsa Família)
  const tutores: Tutor[] = [
    { id: 'tutor-1', nomeCompleto: 'Ana Paula Ferreira', cpf: '123.456.789-00', telefone: '(35) 98765-4321', endereco: 'Rua Primavera, 45 - Bairro São João', dataCadastro: twoWeeksAgo, temCadUnico: true },
    { id: 'tutor-2', nomeCompleto: 'José Donizete da Costa', cpf: '234.567.890-11', telefone: '(35) 99122-3344', endereco: 'Av. Prefeito Olavo Gomes, 1200 - Bairro Árvore Grande', dataCadastro: lastWeek, temCadUnico: false },
    { id: 'tutor-3', nomeCompleto: 'Beatriz Mendonça de Souza', cpf: '345.678.901-22', telefone: '(35) 99888-5566', endereco: 'Rua Cel. Alfredo Custódio de Paula, 310 - Medicina', dataCadastro: fiveDaysAgo, temCadUnico: true },
    { id: 'tutor-4', nomeCompleto: 'Marcos Vinícius Ribeiro', cpf: '456.789.012-33', telefone: '(35) 99333-4455', endereco: 'Rua Comendador José Garcia, 780 - Centro', dataCadastro: lastWeek, temCadUnico: false },
    { id: 'tutor-5', nomeCompleto: 'Sandra Helena Guimarães', cpf: '567.890.123-44', telefone: '(35) 98455-6677', endereco: 'Rua Bom Jesus, 215 - Bairro Santo Antônio', dataCadastro: twoDaysAgo, temCadUnico: true },
    { id: 'tutor-6', nomeCompleto: 'Renata Aparecida Dias', cpf: '678.901.234-55', telefone: '(35) 99911-2233', endereco: 'Rua Monsenhor Dutra, 88 - Bairro Costa Rios', dataCadastro: yesterday, temCadUnico: true }
  ];
  localStorage.setItem(KEYS.TUTORES, JSON.stringify(tutores));

  // 5. Animais Diversificados (18 animais cobrindo cães, gatos, castrados, não castrados, com tutor, resgates SAMUVET, todas as condições)
  const animals: Animal[] = [
    {
      id: 'anim-01',
      nome: 'Rex',
      peso: 16.2,
      idade: '3 anos',
      corPelagem: 'Marrom e Preto (Capa Preta)',
      especie: Especie.CAO,
      raca: 'Pastor Alemão Mix',
      porte: Porte.MEDIO,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938471',
      temTutor: false,
      localResgate: 'Rua das Flores, 123 - Bairro Jardim',
      dataResgate: twoWeeksAgo,
      motivo: 'Resgate SAMUVET após atropelamento em via pública. Fratura consolidada e recuperação satisfatória.',
      dataCadastro: twoWeeksAgo,
      usuarioResponsavelId: '1',
      solicitanteId: 'inst-bombeiros',
      condicao: AnimalCondicao.EM_TRATAMENTO,
      resgateSamuvet: true,
      responsavelSamuvet: 'Dr. Anderson Lopes'
    },
    {
      id: 'anim-02',
      nome: 'Luna',
      peso: 3.8,
      idade: '1 ano e 6 meses',
      corPelagem: 'Branco e Creme (Pontos Escuros)',
      especie: Especie.GATO,
      raca: 'Siamês',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938472',
      temTutor: false,
      localResgate: 'Praça Senador José Bento - Coreto Central',
      dataResgate: lastWeek,
      motivo: 'Abandono em caixa de transporte na praça. Animal extremamente dócil, saudável e vermifugado.',
      dataCadastro: lastWeek,
      usuarioResponsavelId: '1',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.DISPONIVEL_ADOCAO,
      resgateSamuvet: false
    },
    {
      id: 'anim-03',
      nome: 'Bidu',
      peso: 7.2,
      idade: '2 anos',
      corPelagem: 'Branco',
      especie: Especie.CAO,
      raca: 'Poodle Toy Mix',
      porte: Porte.PEQUENO,
      sexo: Sexo.MACHO,
      castrado: false,
      microchipado: false,
      temTutor: false,
      localResgate: 'Av. Brasil, 500 - Bairro Primavera',
      dataResgate: yesterday,
      motivo: 'Animal errante recolhido em via pública com coleira mas sem identificação. Aguardando castração.',
      dataCadastro: yesterday,
      usuarioResponsavelId: '1',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.ACOLHIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-04',
      nome: 'Thor',
      peso: 28.5,
      idade: '4 anos',
      corPelagem: 'Cinza Azulado (Blue Nose)',
      especie: Especie.CAO,
      raca: 'Pitbull',
      porte: Porte.GRANDE,
      sexo: Sexo.MACHO,
      castrado: false,
      microchipado: true,
      numeroMicrochip: '981098102938473',
      temTutor: false,
      localResgate: 'Terreno Baldio - Setor Industrial',
      dataResgate: lastWeek,
      motivo: 'Resgate realizado pela Polícia Militar de Meio Ambiente por maus-tratos e sarna severa.',
      dataCadastro: lastWeek,
      usuarioResponsavelId: '2',
      solicitanteId: 'inst-pa',
      condicao: AnimalCondicao.EM_TRATAMENTO,
      resgateSamuvet: false
    },
    {
      id: 'anim-05',
      nome: 'Mel',
      peso: 21.0,
      idade: '5 anos',
      corPelagem: 'Dourada Claro',
      especie: Especie.CAO,
      raca: 'Golden Retriever Mix',
      porte: Porte.MEDIO,
      sexo: Sexo.FEMEA,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938474',
      temTutor: true,
      tutorId: 'tutor-1',
      localResgate: 'Rua Primavera, 45 - Bairro São João (Domiciliado)',
      dataResgate: fiveDaysAgo,
      motivo: 'Paciente domiciliada trazida para triagem e agendamento de mastectomia unilateral por nódulo mamário.',
      dataCadastro: fiveDaysAgo,
      usuarioResponsavelId: '2',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.ATENDIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-06',
      nome: 'Pipoca',
      peso: 4.5,
      idade: '4 meses (Filhote)',
      corPelagem: 'Caramelo com Patas Brancas',
      especie: Especie.CAO,
      raca: 'Vira-Lata SRD',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: false,
      microchipado: false,
      temTutor: false,
      localResgate: 'Terreno atrás do Estádio Manduzão',
      dataResgate: twoWeeksAgo,
      motivo: 'Filhote resgatada por voluntários de ONG. Desparasitada e pronta para adoção responsável.',
      dataCadastro: twoWeeksAgo,
      usuarioResponsavelId: '1',
      solicitanteId: 'ong-01',
      condicao: AnimalCondicao.DISPONIVEL_ADOCAO,
      resgateSamuvet: false
    },
    {
      id: 'anim-07',
      nome: 'Mingau',
      peso: 4.1,
      idade: '8 meses',
      corPelagem: 'Branco Felpudo',
      especie: Especie.GATO,
      raca: 'Persa Mix',
      porte: Porte.PEQUENO,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938476',
      temTutor: true,
      tutorId: 'tutor-2',
      localResgate: 'Av. Prefeito Olavo Gomes, 1200 (Domiciliado)',
      dataResgate: lastWeek,
      motivo: 'Encaminhado pelo tutor para esterilização cirúrgica pelo programa de controle populacional.',
      dataCadastro: lastWeek,
      usuarioResponsavelId: '3',
      solicitanteId: 'sol-particular-2',
      condicao: AnimalCondicao.ATENDIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-08',
      nome: 'Amora',
      peso: 3.2,
      idade: '2 anos e meio',
      corPelagem: 'Tricolor (Preto, Branco e Laranja)',
      especie: Especie.GATO,
      raca: 'SRD Felino',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: false,
      microchipado: false,
      temTutor: false,
      localResgate: 'Rua Comendador Custódio, 75 - Bairro Fátima',
      dataResgate: yesterday,
      motivo: 'Gata comunitária recolhida para castração em regime de prioridade de controle.',
      dataCadastro: yesterday,
      usuarioResponsavelId: '2',
      solicitanteId: 'sol-protetor-1',
      condicao: AnimalCondicao.ACOLHIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-09',
      nome: 'Bob',
      peso: 31.0,
      idade: '6 anos',
      corPelagem: 'Amarelo Dourado',
      especie: Especie.CAO,
      raca: 'Labrador Retriever',
      porte: Porte.GRANDE,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938478',
      temTutor: false,
      localResgate: 'Margem do Rio Sapucaí Mirim',
      dataResgate: twoWeeksAgo,
      motivo: 'Resgate de cão idoso em situação de abandono. Tratado e adotado no evento municipal de adoção.',
      dataCadastro: twoWeeksAgo,
      usuarioResponsavelId: '1',
      solicitanteId: 'ong-02',
      condicao: AnimalCondicao.ADOTADO,
      dataAdocao: yesterday,
      adotante: {
        nome: 'Lucas de Oliveira Campos',
        cpf: '888.777.666-55',
        telefone: '(35) 99222-1100'
      },
      resgateSamuvet: false
    },
    {
      id: 'anim-10',
      nome: 'Belinha',
      peso: 3.1,
      idade: '7 anos (Idosa)',
      corPelagem: 'Preto e Canela',
      especie: Especie.CAO,
      raca: 'Pinscher Miniatura',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938479',
      temTutor: true,
      tutorId: 'tutor-3',
      localResgate: 'Rua Cel. Alfredo Custódio de Paula, 310 (Domiciliado)',
      dataResgate: fiveDaysAgo,
      motivo: 'Doença periodontal severa e tártaro avançado. Avaliada para profilaxia dentária e extrações.',
      dataCadastro: fiveDaysAgo,
      usuarioResponsavelId: '2',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.EM_TRATAMENTO,
      resgateSamuvet: false
    },
    {
      id: 'anim-11',
      nome: 'Simba',
      peso: 4.4,
      idade: '3 anos',
      corPelagem: 'Laranja Rajado (Tabby)',
      especie: Especie.GATO,
      raca: 'SRD Felino',
      porte: Porte.PEQUENO,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938480',
      temTutor: false,
      localResgate: 'Parque Municipal de Pouso Alegre',
      dataResgate: lastWeek,
      motivo: 'Manejo populacional CED (Captura, Esterilização e Devolução) de felino comunitário.',
      dataCadastro: lastWeek,
      usuarioResponsavelId: '3',
      solicitanteId: 'ong-03',
      condicao: AnimalCondicao.SOLTURA,
      dataSoltura: yesterday,
      localSoltura: 'Colônia Comunitária Monitorada do Parque Municipal de Pouso Alegre',
      resgateSamuvet: false
    },
    {
      id: 'anim-12',
      nome: 'Toby',
      peso: 18.0,
      idade: '1 ano',
      corPelagem: 'Tigrado com Peito Branco',
      especie: Especie.CAO,
      raca: 'Boxer Mix',
      porte: Porte.MEDIO,
      sexo: Sexo.MACHO,
      castrado: false,
      microchipado: true,
      numeroMicrochip: '981098102938481',
      temTutor: false,
      localResgate: 'Valeta pluvial - Bairro Jardim América',
      dataResgate: twoDaysAgo,
      motivo: 'Resgate SAMUVET por queda em bueiro profundo com laceração cutânea. Realizada sutura de emergência.',
      dataCadastro: twoDaysAgo,
      usuarioResponsavelId: '2',
      solicitanteId: 'inst-bombeiros',
      condicao: AnimalCondicao.EM_TRATAMENTO,
      resgateSamuvet: true,
      responsavelSamuvet: 'Dr. Roberto Santos'
    },
    {
      id: 'anim-13',
      nome: 'Princesa',
      peso: 3.5,
      idade: '4 anos',
      corPelagem: 'Frajola (Preto e Branco)',
      especie: Especie.GATO,
      raca: 'SRD Felino',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938482',
      temTutor: false,
      localResgate: 'Rua São José, 80 - Centro',
      dataResgate: lastWeek,
      motivo: 'Entregue para adoção após falecimento do antigo tutor. Mansa, castrada e vacinada.',
      dataCadastro: lastWeek,
      usuarioResponsavelId: '1',
      solicitanteId: 'sol-particular-2',
      condicao: AnimalCondicao.DISPONIVEL_ADOCAO,
      resgateSamuvet: false
    },
    {
      id: 'anim-14',
      nome: 'Zeus',
      peso: 38.0,
      idade: '8 anos (Sênior)',
      corPelagem: 'Preto e Fogo',
      especie: Especie.CAO,
      raca: 'Rottweiler',
      porte: Porte.GRANDE,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938483',
      temTutor: true,
      tutorId: 'tutor-4',
      localResgate: 'Rua Comendador José Garcia, 780 (Domiciliado)',
      dataResgate: twoWeeksAgo,
      motivo: 'Paciente canino idoso submetido à cirurgia de amputação de membro pélvico por neoplasia.',
      dataCadastro: twoWeeksAgo,
      usuarioResponsavelId: '2',
      solicitanteId: 'sol-particular-2',
      condicao: AnimalCondicao.ATENDIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-15',
      nome: 'Chico',
      peso: 6.3,
      idade: '5 anos',
      corPelagem: 'Branco e Dourado',
      especie: Especie.CAO,
      raca: 'Shih-tzu',
      porte: Porte.PEQUENO,
      sexo: Sexo.MACHO,
      castrado: false,
      microchipado: false,
      temTutor: true,
      tutorId: 'tutor-5',
      localResgate: 'Rua Bom Jesus, 215 (Domiciliado)',
      dataResgate: twoDaysAgo,
      motivo: 'Hérnia umbilical de moderado volume e indicação de castração eletiva associada.',
      dataCadastro: twoDaysAgo,
      usuarioResponsavelId: '3',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.ATENDIDO,
      resgateSamuvet: false
    },
    {
      id: 'anim-16',
      nome: 'Estrela',
      peso: 2.9,
      idade: '6 meses',
      corPelagem: 'Branco Puro (Olhos Azuis)',
      especie: Especie.GATO,
      raca: 'Angorá Mix',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: false,
      microchipado: false,
      temTutor: false,
      localResgate: 'Praça João Pinheiro',
      dataResgate: todayStr,
      motivo: 'Filhote encontrada desorientada em praça pública. Aguardando triagem clínica e exames.',
      dataCadastro: todayStr,
      usuarioResponsavelId: '1',
      solicitanteId: 'sol-particular-2',
      condicao: AnimalCondicao.AGUARDANDO_ATENDIMENTO,
      resgateSamuvet: false
    },
    {
      id: 'anim-17',
      nome: 'Lorde',
      peso: 42.0,
      idade: '11 anos (Idoso)',
      corPelagem: 'Baio Rajado',
      especie: Especie.CAO,
      raca: 'Fila Brasileiro Mix',
      porte: Porte.GRANDE,
      sexo: Sexo.MACHO,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938485',
      temTutor: false,
      localResgate: 'Estrada Rural do Bairro Pantano',
      dataResgate: fiveDaysAgo,
      motivo: 'Resgate em estado crítico de prostração severa decorrente de nefropatia terminal.',
      dataCadastro: fiveDaysAgo,
      usuarioResponsavelId: '2',
      solicitanteId: 'inst-pa',
      condicao: AnimalCondicao.OBITO,
      dataObito: yesterday,
      causaObito: 'Parada Cardiorrespiratória irreversível decorrente de Insuficiência Renal Crônica Terminal com Uremia',
      resgateSamuvet: true,
      responsavelSamuvet: 'Dr. Roberto Santos'
    },
    {
      id: 'anim-18',
      nome: 'Pandora',
      peso: 3.6,
      idade: '1 ano e 2 meses',
      corPelagem: 'Escaminha (Preto, Laranja e Marrom)',
      especie: Especie.GATO,
      raca: 'SRD Felino',
      porte: Porte.PEQUENO,
      sexo: Sexo.FEMEA,
      castrado: true,
      microchipado: true,
      numeroMicrochip: '981098102938486',
      temTutor: true,
      tutorId: 'tutor-6',
      localResgate: 'Rua Monsenhor Dutra, 88 (Domiciliado)',
      dataResgate: yesterday,
      motivo: 'Paciente felina com úlcera de córnea perfurada. Avaliada para procedimento oftalmológico especializado.',
      dataCadastro: yesterday,
      usuarioResponsavelId: '3',
      solicitanteId: 'sol-particular-1',
      condicao: AnimalCondicao.ATENDIDO,
      resgateSamuvet: false
    }
  ];
  localStorage.setItem(KEYS.ANIMALS, JSON.stringify(animals));

  // 6. Prontuários e Prescrições Clínicas
  const records: ClinicalRecord[] = [
    {
      id: 'rec-01',
      animalId: 'anim-01', // Rex
      veterinarioId: '2',
      dataAtendimento: twoWeeksAgo,
      inativo: false,
      peso: '16.2',
      temperatura: '38.6',
      mucosa: 'Normocorada',
      hidratacao: 'Hidratado',
      auscultaCardiaca: 'Ritmo regular 2T sem sopros',
      auscultaPulmonar: 'Murmúrio vesicular presente bilateralmente',
      frequenciaCardiaca: '105',
      frequenciaRespiratoria: '22',
      palpacaoAbdominal: 'Abdômen flácido e indolor',
      vacinas: 'V10 e Antirrábica aplicadas na admissão',
      parasitas: 'Negativo para ectoparasitas',
      diagnosticoClinico: 'Escoriações cutâneas e nódulo subcutâneo palpável em flanco esquerdo.',
      tratamentoAmbulatorial: 'Curativo diário com clorexidina e pomada cicatrizante. Agendada nodulectomia após estabilização.',
      observacoesGerais: 'Animal com excelente apetite e bom comportamento com a equipe.',
      examesSolicitados: 'Hemograma completo e perfil bioquímico pré-cirúrgico.',
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      recommendedKennelType: KennelType.INDIVIDUAL,
      accommodationJustification: 'Alocação pós-atendimento para curativos e repouso.',
      v10Aplicada: true,
      v10Data: twoWeeksAgo,
      antirrabicaAplicada: true,
      antirrabicaData: twoWeeksAgo,
      vermifugoAplicado: true,
      vermifugoData: twoWeeksAgo,
      receitas: [
        {
          id: 'presc-01',
          medicamento: 'Amoxicilina + Clavulanato de Potássio',
          dosagem: '250mg',
          via: 'Oral',
          frequencia: '12/12h',
          duracao: '10 dias',
          dataEmissao: twoWeeksAgo,
          veterinarioId: '2',
          animalId: 'anim-01',
          prontuarioId: 'rec-01'
        },
        {
          id: 'presc-02',
          medicamento: 'Meloxicam Comprimidos',
          dosagem: '2mg',
          via: 'Oral',
          frequencia: '24/24h',
          duracao: '4 dias',
          dataEmissao: twoWeeksAgo,
          veterinarioId: '2',
          animalId: 'anim-01',
          prontuarioId: 'rec-01',
          observacoes: 'Administrar junto ao alimento.'
        }
      ]
    },
    {
      id: 'rec-04',
      animalId: 'anim-04', // Thor
      veterinarioId: '2',
      dataAtendimento: lastWeek,
      inativo: false,
      peso: '28.5',
      temperatura: '39.1',
      mucosa: 'Levemente pálida',
      hidratacao: 'Leve desidratação (6%)',
      auscultaCardiaca: 'Normal',
      auscultaPulmonar: 'Normal',
      frequenciaCardiaca: '115',
      frequenciaRespiratoria: '26',
      palpacaoAbdominal: 'Sem alterações',
      vacinas: 'Pendente até resolução do quadro dermatológico',
      parasitas: 'Presença de ácaro Sarcoptes scabiei no raspado',
      diagnosticoClinico: 'Sarna Sarcóptica Generalizada com infecção bacteriana secundária (Piodermatite).',
      tratamentoAmbulatorial: 'Banhos terapêuticos semanais com peróxido de benzoíla e medicação acaricida sistêmica.',
      observacoesGerais: 'Necessita isolamento rigoroso na área de quarentena sanitária.',
      examesSolicitados: 'Raspado de pele profundo e hemograma.',
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      recommendedKennelType: KennelType.QUARENTENA,
      accommodationJustification: 'Doença infectocontagiosa transmissível (Sarna Sarcóptica). Isolamento mandatório.',
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: true,
      vermifugoData: lastWeek,
      receitas: [
        {
          id: 'presc-03',
          medicamento: 'Ivermectina / Bravecto 20-40kg',
          dosagem: '1 comprimido',
          via: 'Oral',
          frequencia: 'Dose única',
          duracao: '30 dias',
          dataEmissao: lastWeek,
          veterinarioId: '2',
          animalId: 'anim-04',
          prontuarioId: 'rec-04'
        },
        {
          id: 'presc-04',
          medicamento: 'Cefalexina',
          dosagem: '600mg',
          via: 'Oral',
          frequencia: '12/12h',
          duracao: '21 dias',
          dataEmissao: lastWeek,
          veterinarioId: '2',
          animalId: 'anim-04',
          prontuarioId: 'rec-04'
        }
      ]
    },
    {
      id: 'rec-10',
      animalId: 'anim-10', // Belinha
      veterinarioId: '3',
      dataAtendimento: fiveDaysAgo,
      inativo: false,
      peso: '3.1',
      temperatura: '38.4',
      mucosa: 'Normocorada',
      hidratacao: 'Normal',
      auscultaCardiaca: 'Sopro sistólico grau II/VI em foco mitral',
      auscultaPulmonar: 'Límpida',
      frequenciaCardiaca: '130',
      frequenciaRespiratoria: '28',
      palpacaoAbdominal: 'Flácido',
      vacinas: 'Em dia pelo tutor',
      parasitas: 'Ausentes',
      diagnosticoClinico: 'Doença Periodontal Grau IV com mobilidade em incisivos e pré-molares.',
      tratamentoAmbulatorial: 'Terapia antibiótica prévia e agendamento de profilaxia ultrassônica com extração cirúrgica.',
      observacoesGerais: 'Animal cardiopata compensado. Avaliação cardiológica autorizou anestesia inalatória.',
      examesSolicitados: 'Eletrocardiograma e ecocardiograma com Doppler.',
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      v10Aplicada: true,
      antirrabicaAplicada: true,
      vermifugoAplicado: true,
      receitas: [
        {
          id: 'presc-05',
          medicamento: 'Espiramicina + Metronidazol (Stomorgyl 2)',
          dosagem: '1 comprimido',
          via: 'Oral',
          frequencia: '24/24h',
          duracao: '7 dias',
          dataEmissao: fiveDaysAgo,
          veterinarioId: '3',
          animalId: 'anim-10',
          prontuarioId: 'rec-10'
        }
      ]
    },
    {
      id: 'rec-12',
      animalId: 'anim-12', // Toby
      veterinarioId: '2',
      dataAtendimento: twoDaysAgo,
      inativo: false,
      peso: '18.0',
      temperatura: '38.8',
      mucosa: 'Normocorada',
      hidratacao: 'Hidratado',
      auscultaCardiaca: 'Normal',
      auscultaPulmonar: 'Normal',
      frequenciaCardiaca: '110',
      frequenciaRespiratoria: '20',
      palpacaoAbdominal: 'Indolor',
      vacinas: 'Pendente',
      parasitas: 'Ausentes',
      diagnosticoClinico: 'Ferida lacerada em região cervical e torácica lateral pós-queda.',
      tratamentoAmbulatorial: 'Debridamento cirúrgico de emergência, colocação de dreno Penrose e sutura por planos.',
      observacoesGerais: 'Dreno retirado em 48h. Ferida limpa e sem secreções purulentas.',
      examesSolicitados: 'Raio-X de tórax (sem pneumotórax ou fraturas costais).',
      statusResultante: AnimalCondicao.EM_TRATAMENTO,
      recommendedKennelType: KennelType.INDIVIDUAL,
      accommodationJustification: 'Alocação pós-cirúrgica de sutura para controle de curativos.',
      v10Aplicada: false,
      antirrabicaAplicada: false,
      vermifugoAplicado: true,
      receitas: [
        {
          id: 'presc-06',
          medicamento: 'Enrofloxacino',
          dosagem: '100mg',
          via: 'Oral',
          frequencia: '24/24h',
          duracao: '8 dias',
          dataEmissao: twoDaysAgo,
          veterinarioId: '2',
          animalId: 'anim-12',
          prontuarioId: 'rec-12'
        },
        {
          id: 'presc-07',
          medicamento: 'Dipirona Gotas 500mg/ml',
          dosagem: '18 gotas',
          via: 'Oral',
          frequencia: '8/8h',
          duracao: '3 dias',
          dataEmissao: twoDaysAgo,
          veterinarioId: '2',
          animalId: 'anim-12',
          prontuarioId: 'rec-12'
        }
      ]
    }
  ];
  localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));

  // 7. Agendamentos Cirúrgicos Diversos (Castrações + Cirurgias Gerais para Castrados e Não Castrados + Realizadas + Urgentes)
  const cirurgias: AgendamentoCirurgia[] = [
    {
      id: 'cir-01',
      animalId: 'anim-08', // Amora (Gata não castrada)
      dataAgendada: todayStr,
      horario: '08:30',
      turno: 'MANHA',
      tipoCirurgia: 'Castração Felina (OSH)',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.URGENTE,
      veterinarioResponsavelId: '2',
      veterinarioResponsavelNome: 'Dr. Roberto Santos',
      observacoesPreOperatorias: 'Jejum alimentar de 8h e hídrico de 2h. Paciente fêmea comunitária.',
      dataCadastro: yesterday,
      usuarioCriadorId: '1'
    },
    {
      id: 'cir-02',
      animalId: 'anim-03', // Bidu (Cão não castrado)
      dataAgendada: tomorrowStr,
      horario: '09:00',
      turno: 'MANHA',
      tipoCirurgia: 'Castração Canina (Orquiectomia)',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '2',
      veterinarioResponsavelNome: 'Dr. Roberto Santos',
      observacoesPreOperatorias: 'Jejum prévio padrão de 8 horas. Paciente de pequeno porte.',
      dataCadastro: yesterday,
      usuarioCriadorId: '1'
    },
    {
      id: 'cir-03',
      animalId: 'anim-04', // Thor (Cão não castrado)
      dataAgendada: inThreeDaysStr,
      horario: '10:00',
      turno: 'MANHA',
      tipoCirurgia: 'Castração Canina (Orquiectomia)',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '3',
      veterinarioResponsavelNome: 'Dra. Camila Rocha',
      observacoesPreOperatorias: 'Reavaliar dermatite antes da indução anestésica. Jejum alimentar rigoroso de 8h.',
      dataCadastro: lastWeek,
      usuarioCriadorId: '2'
    },
    {
      id: 'cir-04',
      animalId: 'anim-01', // Rex (Cão CASTRADO - agendamento de outra cirurgia)
      dataAgendada: inTwoDaysStr,
      horario: '14:00',
      turno: 'TARDE',
      tipoCirurgia: 'Nodulectomia / Exérese de Tumor',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '2',
      veterinarioResponsavelNome: 'Dr. Roberto Santos',
      observacoesPreOperatorias: 'Jejum alimentar de 8h. Enviar peça cirúrgica para análise histopatológica.',
      dataCadastro: fiveDaysAgo,
      usuarioCriadorId: '2'
    },
    {
      id: 'cir-05',
      animalId: 'anim-05', // Mel (Cão CASTRADA - agendamento de Mastectomia)
      dataAgendada: inFiveDaysStr,
      horario: '08:30',
      turno: 'MANHA',
      tipoCirurgia: 'Mastectomia Unilateral',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.URGENTE,
      veterinarioResponsavelId: '3',
      veterinarioResponsavelNome: 'Dra. Camila Rocha',
      observacoesPreOperatorias: 'Jejum alimentar 8h. Trazer roupa cirúrgica pós-operatória.',
      dataCadastro: fiveDaysAgo,
      usuarioCriadorId: '2'
    },
    {
      id: 'cir-06',
      animalId: 'anim-10', // Belinha (Cão CASTRADA - agendamento de Profilaxia Dentária)
      dataAgendada: inThreeDaysStr,
      horario: '13:30',
      turno: 'TARDE',
      tipoCirurgia: 'Profilaxia Dentária / Extração',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '3',
      veterinarioResponsavelNome: 'Dra. Camila Rocha',
      observacoesPreOperatorias: 'Anestesia inalatória com monitoramento cardíaco contínuo.',
      dataCadastro: fiveDaysAgo,
      usuarioCriadorId: '3'
    },
    {
      id: 'cir-07',
      animalId: 'anim-15', // Chico (Cão não castrado - Herniorrafia + Castração)
      dataAgendada: inFiveDaysStr,
      horario: '10:30',
      turno: 'MANHA',
      tipoCirurgia: 'Herniorrafia (Umbilical/Inguinal)',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '4',
      veterinarioResponsavelNome: 'Dr. Marcos Alvarenga',
      observacoesPreOperatorias: 'Jejum alimentar de 8h e hídrico de 2h.',
      dataCadastro: twoDaysAgo,
      usuarioCriadorId: '3'
    },
    {
      id: 'cir-08',
      animalId: 'anim-06', // Pipoca (Fila de espera de castração)
      dataAgendada: inFiveDaysStr,
      horario: '11:00',
      turno: 'MANHA',
      tipoCirurgia: 'Castração Canina (OSH)',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.FILA_ESPERA,
      veterinarioResponsavelId: '4',
      veterinarioResponsavelNome: 'Dr. Marcos Alvarenga',
      observacoesPreOperatorias: 'Filhote em fase final de vacinação.',
      dataCadastro: twoWeeksAgo,
      usuarioCriadorId: '1'
    },
    {
      id: 'cir-09',
      animalId: 'anim-07', // Mingau (Cirurgia Concluída / Realizada)
      dataAgendada: fiveDaysAgo.split('T')[0],
      horario: '09:00',
      turno: 'MANHA',
      tipoCirurgia: 'Castração Felina (Orquiectomia)',
      status: CirurgiaStatus.REALIZADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '3',
      veterinarioResponsavelNome: 'Dra. Camila Rocha',
      realizadaPorId: '3',
      realizadaPorNome: 'Dra. Camila Rocha',
      dataRealizacao: fiveDaysAgo,
      observacoesPreOperatorias: 'Jejum alimentar de 8h.',
      observacoesPosOperatorias: 'Cirurgia realizada sem intercorrências anestésicas ou hemorrágicas. Recuperação imediata.',
      dataCadastro: lastWeek,
      usuarioCriadorId: '3'
    },
    {
      id: 'cir-10',
      animalId: 'anim-12', // Toby (Sutura Cirúrgica Realizada)
      dataAgendada: twoDaysAgo.split('T')[0],
      horario: '16:00',
      turno: 'TARDE',
      tipoCirurgia: 'Sutura / Debridamento de Ferida',
      status: CirurgiaStatus.REALIZADA,
      prioridade: CirurgiaPrioridade.URGENTE,
      veterinarioResponsavelId: '2',
      veterinarioResponsavelNome: 'Dr. Roberto Santos',
      realizadaPorId: '2',
      realizadaPorNome: 'Dr. Roberto Santos',
      dataRealizacao: twoDaysAgo,
      observacoesPreOperatorias: 'Emergência pós-resgate SAMUVET.',
      observacoesPosOperatorias: 'Aproximação de bordas cutâneas concluída com fio nylon 3-0. Dreno posicionado.',
      dataCadastro: twoDaysAgo,
      usuarioCriadorId: '2'
    },
    {
      id: 'cir-11',
      animalId: 'anim-14', // Zeus (Amputação Realizada)
      dataAgendada: lastWeek.split('T')[0],
      horario: '08:30',
      turno: 'MANHA',
      tipoCirurgia: 'Amputação de Membro / Caudectomia',
      status: CirurgiaStatus.REALIZADA,
      prioridade: CirurgiaPrioridade.URGENTE,
      veterinarioResponsavelId: '2',
      veterinarioResponsavelNome: 'Dr. Roberto Santos',
      realizadaPorId: '2',
      realizadaPorNome: 'Dr. Roberto Santos',
      dataRealizacao: lastWeek,
      observacoesPreOperatorias: 'Exames pré-operatórios de imagem e sangue anexados.',
      observacoesPosOperatorias: 'Amputação alta de membro pélvico esquerdo bem-sucedida. Paciente em adaptação motora.',
      dataCadastro: twoWeeksAgo,
      usuarioCriadorId: '2'
    },
    {
      id: 'cir-12',
      animalId: 'anim-18', // Pandora (Enucleação agendada)
      dataAgendada: tomorrowStr,
      horario: '14:30',
      turno: 'TARDE',
      tipoCirurgia: 'Enucleação Oftálmica',
      status: CirurgiaStatus.AGENDADA,
      prioridade: CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: '3',
      veterinarioResponsavelNome: 'Dra. Camila Rocha',
      observacoesPreOperatorias: 'Jejum alimentar de 8h e hídrico de 2h.',
      dataCadastro: yesterday,
      usuarioCriadorId: '3'
    }
  ];
  localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));

  // 8. Acomodações e Ocupações Ativas
  const allKennels: Kennel[] = JSON.parse(localStorage.getItem(KEYS.KENNELS) || '[]');
  const occupations: KennelOccupation[] = [];

  const individualKennels = allKennels.filter(k => k.type === KennelType.INDIVIDUAL);
  const collectiveKennels = allKennels.filter(k => k.type === KennelType.COLETIVA);
  const gatilKennels = allKennels.filter(k => k.type === KennelType.GATIL);
  const quarantineKennels = allKennels.filter(k => k.type === KennelType.QUARENTENA);

  if (individualKennels[0]) {
    occupations.push({
      id: 'occ-01',
      animalId: 'anim-01', // Rex
      kennelId: individualKennels[0].id,
      entryDate: twoWeeksAgo,
      vetId: '2',
      clinicalRecordId: 'rec-01',
      justification: 'Alocação pós-atendimento para tratamento de feridas e observação clínica.'
    });
  }

  if (individualKennels[1]) {
    occupations.push({
      id: 'occ-02',
      animalId: 'anim-03', // Bidu
      kennelId: individualKennels[1].id,
      entryDate: yesterday,
      vetId: '1',
      justification: 'Acolhimento temporário aguardando procedimento cirúrgico de castração.'
    });
  }

  if (individualKennels[2]) {
    occupations.push({
      id: 'occ-03',
      animalId: 'anim-12', // Toby
      kennelId: individualKennels[2].id,
      entryDate: twoDaysAgo,
      vetId: '2',
      clinicalRecordId: 'rec-12',
      justification: 'Pós-operatório de sutura e repouso de ferimento cutâneo.'
    });
  }

  if (gatilKennels[0]) {
    occupations.push({
      id: 'occ-04',
      animalId: 'anim-02', // Luna
      kennelId: gatilKennels[0].id,
      entryDate: lastWeek,
      vetId: '1',
      justification: 'Aguardando interessados no programa de adoção responsável.'
    });
  }

  if (gatilKennels[1]) {
    occupations.push({
      id: 'occ-05',
      animalId: 'anim-08', // Amora
      kennelId: gatilKennels[1].id,
      entryDate: yesterday,
      vetId: '2',
      justification: 'Pré-operatório de castração felina.'
    });
  }

  if (gatilKennels[2]) {
    occupations.push({
      id: 'occ-06',
      animalId: 'anim-13', // Princesa
      kennelId: gatilKennels[2].id,
      entryDate: lastWeek,
      vetId: '1',
      justification: 'Alojada para adoção responsável.'
    });
  }

  if (gatilKennels[3]) {
    occupations.push({
      id: 'occ-07',
      animalId: 'anim-16', // Estrela
      kennelId: gatilKennels[3].id,
      entryDate: todayStr,
      vetId: '1',
      justification: 'Acolhimento de filhote para triagem inicial.'
    });
  }

  if (collectiveKennels[0]) {
    occupations.push({
      id: 'occ-08',
      animalId: 'anim-06', // Pipoca
      kennelId: collectiveKennels[0].id,
      entryDate: twoWeeksAgo,
      vetId: '1',
      justification: 'Socialização de filhotes saudáveis aptos para adoção.'
    });
  }

  if (quarantineKennels[0]) {
    occupations.push({
      id: 'occ-09',
      animalId: 'anim-04', // Thor
      kennelId: quarantineKennels[0].id,
      entryDate: lastWeek,
      vetId: '2',
      clinicalRecordId: 'rec-04',
      justification: 'Isolamento sanitário obrigatório por Sarna Sarcóptica.'
    });
  }

  localStorage.setItem(KEYS.OCCUPATIONS, JSON.stringify(occupations));

  // 9. Histórico de Mudança de Status
  const statusLogs: StatusLog[] = [
    { id: 'log-01', animalId: 'anim-01', statusAnterior: null, statusNovo: AnimalCondicao.ACOLHIDO, dataAlteracao: twoWeeksAgo, usuarioId: '1' },
    { id: 'log-02', animalId: 'anim-01', statusAnterior: AnimalCondicao.ACOLHIDO, statusNovo: AnimalCondicao.EM_TRATAMENTO, dataAlteracao: twoWeeksAgo, usuarioId: '2', prontuarioId: 'rec-01' },
    { id: 'log-03', animalId: 'anim-02', statusAnterior: null, statusNovo: AnimalCondicao.DISPONIVEL_ADOCAO, dataAlteracao: lastWeek, usuarioId: '1' },
    { id: 'log-04', animalId: 'anim-04', statusAnterior: null, statusNovo: AnimalCondicao.EM_TRATAMENTO, dataAlteracao: lastWeek, usuarioId: '2', prontuarioId: 'rec-04' },
    { id: 'log-05', animalId: 'anim-09', statusAnterior: AnimalCondicao.DISPONIVEL_ADOCAO, statusNovo: AnimalCondicao.ADOTADO, dataAlteracao: yesterday, usuarioId: '1' },
    { id: 'log-06', animalId: 'anim-11', statusAnterior: AnimalCondicao.ACOLHIDO, statusNovo: AnimalCondicao.SOLTURA, dataAlteracao: yesterday, usuarioId: '3' },
    { id: 'log-07', animalId: 'anim-17', statusAnterior: AnimalCondicao.EM_TRATAMENTO, statusNovo: AnimalCondicao.OBITO, dataAlteracao: yesterday, usuarioId: '2' }
  ];
  localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(statusLogs));

  return true;
};

export const clearAllFictitiousData = () => {
  // 1. Apaga todos os animais fictícios
  localStorage.setItem(KEYS.ANIMALS, JSON.stringify([]));

  // 2. Apaga todos os tutores fictícios de teste
  localStorage.setItem(KEYS.TUTORES, JSON.stringify([]));

  // 3. Apaga prontuários e prescrições de teste
  localStorage.setItem(KEYS.RECORDS, JSON.stringify([]));

  // 4. Apaga agendamentos e cirurgias de teste
  localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify([]));

  // 5. Apaga ocupações de baias e gatis (todas as baias ficam 100% livres)
  localStorage.setItem(KEYS.OCCUPATIONS, JSON.stringify([]));

  // 6. Apaga histórico de mudanças de status
  localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify([]));

  // 7. Filtra e mantém apenas órgãos públicos oficiais e remove os solicitantes fictícios
  const existingSolicitantes: Solicitante[] = JSON.parse(localStorage.getItem(KEYS.SOLICITANTES) || '[]');
  const officialSolicitantes: Solicitante[] = [
    { id: 'inst-bombeiros', nomeCompleto: 'Corpo de Bombeiros Militar (193)', cpf: 'INST-BOMBEIROS', telefone: '193', tipo: 'ORGAO_PUBLICO', endereco: 'Rua Afonso Pena, 400 - Centro, Pouso Alegre' },
    { id: 'inst-pm', nomeCompleto: 'Polícia Militar de Minas Gerais (190)', cpf: 'INST-PM', telefone: '190', tipo: 'ORGAO_PUBLICO', endereco: 'Av. Vicente Simões, 1100' },
    { id: 'inst-pa', nomeCompleto: 'Polícia Militar de Meio Ambiente', cpf: 'INST-PA', telefone: '(35) 3429-1900', tipo: 'ORGAO_PUBLICO', endereco: 'Rodovia Fernão Dias, Km 850' },
    { id: 'inst-desconhecido', nomeCompleto: 'Solicitante Desconhecido / Anônimo', cpf: 'DESC-ANONIMO', telefone: 'Não informado', tipo: 'DESCONHECIDO' }
  ];
  
  const mockSolicitanteIds = new Set(['ong-01', 'ong-02', 'ong-03', 'sol-particular-1', 'sol-particular-2', 'sol-protetor-1']);
  const customSolicitantes = existingSolicitantes.filter(s => !mockSolicitanteIds.has(s.id) && !s.id.startsWith('inst-'));
  localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify([...officialSolicitantes, ...customSolicitantes]));

  // 8. Zera a ocupação atual de todas as baias no inventário
  const kennels: Kennel[] = JSON.parse(localStorage.getItem(KEYS.KENNELS) || '[]');
  const emptyKennels = kennels.map(k => ({ ...k, currentOccupancy: 0 }));
  localStorage.setItem(KEYS.KENNELS, JSON.stringify(emptyKennels));

  // Marca que os dados fictícios foram excluídos definitivamente
  localStorage.setItem('sisbem_cleaned_mock_data_v3', 'true');
  return true;
};

const initSystem = () => {
  // 1. Inicializa usuários básicos de acesso se não existirem
  const existingUsers = localStorage.getItem(KEYS.USERS);
  if (!existingUsers || JSON.parse(existingUsers || '[]').length === 0) {
    const users: User[] = [
      { id: '1', name: 'Administrador SISBEM', username: 'admin', role: 'ADMIN' },
      { id: '2', name: 'Dr. Roberto Santos', username: 'vet01', role: 'VETERINARIO', crmv: '12345/MG', matricula: '99887' },
      { id: '3', name: 'Dra. Camila Rocha', username: 'vet02', role: 'VETERINARIO', crmv: '18492/MG', matricula: '99888' },
      { id: '4', name: 'Dr. Marcos Alvarenga', username: 'vet03', role: 'VETERINARIO', crmv: '22110/MG', matricula: '99890' },
      { id: '5', name: 'Mariana Albuquerque', username: 'op01', role: 'OPERATOR', matricula: '99889' }
    ];
    localStorage.setItem(KEYS.USERS, JSON.stringify([
      { ...users[0], password: 'admin' },
      { ...users[1], password: 'password123' },
      { ...users[2], password: 'password123' },
      { ...users[3], password: 'password123' },
      { ...users[4], password: 'password123' }
    ]));
  }

  // 2. Inicializa configurações de baias se não existirem
  const existingConfigs = localStorage.getItem(KEYS.KENNEL_CONFIGS);
  if (!existingConfigs) {
    const initialConfigs: KennelConfig[] = [
      { type: KennelType.INDIVIDUAL, count: 54, capacity: 1 },
      { type: KennelType.COLETIVA, count: 11, capacity: 5 },
      { type: KennelType.QUARENTENA, count: 9, capacity: 1 },
      { type: KennelType.GATIL, count: 43, capacity: 3 },
      { type: KennelType.PRE_OPERATORIO, count: 3, capacity: 1 },
      { type: KennelType.POS_OPERATORIO, count: 6, capacity: 1 }
    ];
    localStorage.setItem(KEYS.KENNEL_CONFIGS, JSON.stringify(initialConfigs));
    db.syncKennelsWithConfigs(initialConfigs);
  }

  // 3. Inicializa órgãos públicos oficiais se lista estiver vazia
  const existingSolicitantes = localStorage.getItem(KEYS.SOLICITANTES);
  if (!existingSolicitantes || JSON.parse(existingSolicitantes || '[]').length === 0) {
    const defaultSolicitantes: Solicitante[] = [
      { id: 'inst-bombeiros', nomeCompleto: 'Corpo de Bombeiros Militar (193)', cpf: 'INST-BOMBEIROS', telefone: '193', tipo: 'ORGAO_PUBLICO', endereco: 'Rua Afonso Pena, 400 - Centro, Pouso Alegre' },
      { id: 'inst-pm', nomeCompleto: 'Polícia Militar de Minas Gerais (190)', cpf: 'INST-PM', telefone: '190', tipo: 'ORGAO_PUBLICO', endereco: 'Av. Vicente Simões, 1100' },
      { id: 'inst-pa', nomeCompleto: 'Polícia Militar de Meio Ambiente', cpf: 'INST-PA', telefone: '(35) 3429-1900', tipo: 'ORGAO_PUBLICO', endereco: 'Rodovia Fernão Dias, Km 850' },
      { id: 'inst-desconhecido', nomeCompleto: 'Solicitante Desconhecido / Anônimo', cpf: 'DESC-ANONIMO', telefone: 'Não informado', tipo: 'DESCONHECIDO' }
    ];
    localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(defaultSolicitantes));
  }

  // 4. Executa a limpeza dos cadastros fictícios gerados em testes anteriores
  if (localStorage.getItem('sisbem_cleaned_mock_data_v3') !== 'true') {
    clearAllFictitiousData();
  }
};

export const db = {
  getUsers: (): any[] => JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
  
  saveUser: (userData: any) => {
    const users = db.getUsers();
    if (!userData.id) {
      if (users.find(u => u.username === userData.username)) throw new Error('Nome de usuário já existe.');
      userData.id = crypto.randomUUID();
      users.push(userData);
    } else {
      const idx = users.findIndex(u => u.id === userData.id);
      if (idx > -1) users[idx] = { ...users[idx], ...userData };
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    syncUserToSupabase(userData).catch(err => console.warn('Supabase syncUser:', err));
    return userData;
  },

  deleteUser: (idOrUsername: string) => {
    const users = db.getUsers().filter(u => u.id !== idOrUsername && u.username !== idOrUsername);
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    deleteUserFromSupabase(idOrUsername).catch(err => console.warn('Supabase deleteUser:', err));
  },

  getAnimals: (): Animal[] => JSON.parse(localStorage.getItem(KEYS.ANIMALS) || '[]'),
  getSolicitantes: (): Solicitante[] => {
    const list: Solicitante[] = JSON.parse(localStorage.getItem(KEYS.SOLICITANTES) || '[]');
    return list.filter(s => s.id !== 'system-configs-v1' && !s.id.startsWith('__sys_'));
  },
  getTutores: (): Tutor[] => JSON.parse(localStorage.getItem(KEYS.TUTORES) || '[]'),
  getRecords: (): ClinicalRecord[] => JSON.parse(localStorage.getItem(KEYS.RECORDS) || '[]'),
  getStatusLogs: (): StatusLog[] => JSON.parse(localStorage.getItem(KEYS.STATUS_LOGS) || '[]'),
  getKennels: (): Kennel[] => JSON.parse(localStorage.getItem(KEYS.KENNELS) || '[]'),
  getOccupations: (): KennelOccupation[] => JSON.parse(localStorage.getItem(KEYS.OCCUPATIONS) || '[]'),
  getKennelConfigs: (): KennelConfig[] => {
    const stored = localStorage.getItem(KEYS.KENNEL_CONFIGS);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const kennels = db.getKennels();
    const types = [
      KennelType.INDIVIDUAL,
      KennelType.COLETIVA,
      KennelType.QUARENTENA,
      KennelType.GATIL,
      KennelType.PRE_OPERATORIO,
      KennelType.POS_OPERATORIO
    ];
    return types.map(t => {
      const ofType = kennels.filter(k => k.type === t);
      return {
        type: t,
        count: ofType.length,
        capacity: ofType[0]?.capacity || (t === KennelType.COLETIVA ? 5 : (t === KennelType.GATIL ? 3 : 1))
      };
    });
  },

  getAnimalsBySolicitante: (solicitanteId: string): AnimalJoined[] => {
    const animals = db.getAnimalsJoined();
    return animals.filter(a => a.solicitanteId === solicitanteId);
  },

  getAnimalsByTutor: (tutorId: string): AnimalJoined[] => {
    const animals = db.getAnimalsJoined();
    return animals.filter(a => a.tutorId === tutorId);
  },

  getSolicitanteByCodigoOng: (codigo: string): Solicitante | undefined => {
    if (!codigo || !codigo.trim()) return undefined;
    const clean = codigo.trim().toUpperCase();
    const list = db.getSolicitantes();
    return list.find(s => s.codigoOng && s.codigoOng.trim().toUpperCase() === clean);
  },

  getOngs: (): Solicitante[] => {
    const list = db.getSolicitantes();
    return list.filter(s => s.tipo === 'ONG' || !!s.codigoOng);
  },

  saveSolicitante: (solicitanteData: Partial<Solicitante>): Solicitante => {
    const solicitantes = db.getSolicitantes();
    const isNew = !solicitanteData.id;
    const id = solicitanteData.id || crypto.randomUUID();

    // Se tiver código de ONG informado, garante maiúsculas e sem espaços extras
    const formattedCodigoOng = solicitanteData.codigoOng ? solicitanteData.codigoOng.trim().toUpperCase() : undefined;

    const newSolicitante: Solicitante = {
      id,
      nomeCompleto: solicitanteData.nomeCompleto || 'Solicitante Sem Nome',
      cpf: solicitanteData.cpf || '',
      telefone: solicitanteData.telefone || '',
      tipo: solicitanteData.tipo || (formattedCodigoOng ? 'ONG' : 'CIDADAO'),
      codigoOng: formattedCodigoOng,
      responsavel: solicitanteData.responsavel || '',
      endereco: solicitanteData.endereco || '',
      email: solicitanteData.email || '',
      observacoes: solicitanteData.observacoes || ''
    };

    const existingIndex = solicitantes.findIndex(s => s.id === id);
    if (existingIndex >= 0) {
      solicitantes[existingIndex] = { ...solicitantes[existingIndex], ...newSolicitante };
    } else {
      solicitantes.push(newSolicitante);
    }

    localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(solicitantes));
    syncSolicitanteToSupabase(newSolicitante).catch(err => console.warn('Supabase syncSolicitante:', err));
    return newSolicitante;
  },

  deleteSolicitante: (id: string) => {
    const solicitantes = db.getSolicitantes().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(solicitantes));

    const animals = db.getAnimals();
    const updatedAnimals = animals.map(a => a.solicitanteId === id ? { ...a, solicitanteId: '' } : a);
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(updatedAnimals));
    deleteSolicitanteFromSupabase(id).catch(err => console.warn('Supabase deleteSolicitante:', err));
  },

  saveTutor: (tutorData: Partial<Tutor>): Tutor => {
    const tutores = db.getTutores();
    const id = tutorData.id || crypto.randomUUID();
    const newTutor: Tutor = {
      id,
      nomeCompleto: tutorData.nomeCompleto || 'Tutor Desconhecido',
      cpf: tutorData.cpf || '',
      telefone: tutorData.telefone || '',
      endereco: tutorData.endereco || '',
      temCadUnico: !!tutorData.temCadUnico,
      documentoCadUnico: tutorData.documentoCadUnico || '',
      dataCadastro: tutorData.dataCadastro || new Date().toISOString()
    };

    const existingIndex = tutores.findIndex(t => t.id === id);
    if (existingIndex >= 0) {
      tutores[existingIndex] = { ...tutores[existingIndex], ...newTutor };
    } else {
      tutores.push(newTutor);
    }

    localStorage.setItem(KEYS.TUTORES, JSON.stringify(tutores));
    syncTutorToSupabase(newTutor).catch(err => console.warn('Supabase syncTutor:', err));
    return newTutor;
  },

  syncKennelsWithConfigs: (configs: KennelConfig[]) => {
    const kennels: Kennel[] = JSON.parse(localStorage.getItem(KEYS.KENNELS) || '[]');
    const newKennels: Kennel[] = [];

    configs.forEach(cfg => {
      const currentByType = kennels.filter(k => k.type === cfg.type);
      const updatedExisting = currentByType.map(k => ({
        ...k,
        capacity: cfg.capacity
      }));

      if (updatedExisting.length < cfg.count) {
        newKennels.push(...updatedExisting);
        for (let i = updatedExisting.length + 1; i <= cfg.count; i++) {
          newKennels.push({
            id: crypto.randomUUID(),
            name: `${cfg.type} ${i.toString().padStart(2, '0')}`,
            type: cfg.type,
            capacity: cfg.capacity
          });
        }
      } else {
        newKennels.push(...updatedExisting.slice(0, cfg.count));
      }
    });

    localStorage.setItem(KEYS.KENNELS, JSON.stringify(newKennels));
  },

  saveKennelConfigs: (configs: KennelConfig[]) => {
    localStorage.setItem(KEYS.KENNEL_CONFIGS, JSON.stringify(configs));
    db.syncKennelsWithConfigs(configs);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-settings-changed', { detail: { configs } }));
      window.dispatchEvent(new CustomEvent('sisbem-kennels-changed'));
      window.dispatchEvent(new CustomEvent('sisbem-occupations-changed'));
    }

    syncKennelConfigsToSupabase(configs).catch(err => console.warn('Supabase syncConfigs:', err));
    const currentKennels = db.getKennels();
    syncKennelsFullToSupabase(currentKennels).catch(err => console.warn('Supabase syncKennelsFull:', err));
  },

  saveKennelConfigsAsync: async (configs: KennelConfig[]) => {
    localStorage.setItem(KEYS.KENNEL_CONFIGS, JSON.stringify(configs));
    db.syncKennelsWithConfigs(configs);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-settings-changed', { detail: { configs } }));
      window.dispatchEvent(new CustomEvent('sisbem-kennels-changed'));
      window.dispatchEvent(new CustomEvent('sisbem-occupations-changed'));
    }

    await syncKennelConfigsToSupabase(configs);
    const currentKennels = db.getKennels();
    await syncKennelsFullToSupabase(currentKennels);
  },

  getAnimalsJoined: (): AnimalJoined[] => {
    const animals = db.getAnimals();
    const solicitantes = db.getSolicitantes();
    const tutores = db.getTutores();
    const users = db.getUsers();
    const records = db.getRecords();
    const logs = db.getStatusLogs();
    const occupations = db.getOccupations();
    const kennels = db.getKennels();
    const cirurgias = db.getCirurgias();

    return animals.map(animal => {
      const currentOcc = occupations.find(o => o.animalId === animal.id && !o.exitDate);
      const animalCirurgias = cirurgias.filter(c => c.animalId === animal.id).sort((a, b) => new Date(b.dataAgendada).getTime() - new Date(a.dataAgendada).getTime());
      const activeCirurgia = animalCirurgias.find(c => c.status === CirurgiaStatus.AGENDADA || c.status === CirurgiaStatus.EM_PREPARO);

      return {
        ...animal,
        solicitante: solicitantes.find(s => s.id === animal.solicitanteId),
        tutor: animal.tutorId ? tutores.find(t => t.id === animal.tutorId) : undefined,
        usuarioResponsavel: users.find(u => u.id === animal.usuarioResponsavelId),
        historico: records.filter(r => r.animalId === animal.id && !r.inativo),
        statusLogs: logs.filter(l => l.animalId === animal.id).sort((a,b) => new Date(b.dataAlteracao).getTime() - new Date(a.dataAlteracao).getTime()),
        currentOccupation: currentOcc ? { ...currentOcc, kennel: kennels.find(k => k.id === currentOcc.kennelId) } : undefined,
        cirurgias: animalCirurgias,
        agendamentoCastracaoAtivo: activeCirurgia
      };
    }).sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime());
  },

  allocateAnimal: (allocation: Omit<KennelOccupation, 'id' | 'entryDate'>) => {
    const occupations = db.getOccupations();
    const kennels = db.getKennels();
    const active = occupations.filter(o => o.kennelId === allocation.kennelId && !o.exitDate);
    const kennel = kennels.find(k => k.id === allocation.kennelId);

    if (!kennel) throw new Error("Baia não encontrada.");
    if (active.length >= kennel.capacity) throw new Error("Capacidade máxima da baia atingida.");

    const prevIdx = occupations.findIndex(o => o.animalId === allocation.animalId && !o.exitDate);
    let prevOcc: KennelOccupation | null = null;
    if (prevIdx > -1) {
      occupations[prevIdx].exitDate = new Date().toISOString();
      prevOcc = occupations[prevIdx];
    }

    const newOcc: KennelOccupation = {
      ...allocation,
      id: crypto.randomUUID(),
      entryDate: new Date().toISOString()
    };

    occupations.push(newOcc);
    localStorage.setItem(KEYS.OCCUPATIONS, JSON.stringify(occupations));

    if (prevOcc) {
      syncOccupationToSupabase(prevOcc).catch(err => console.warn('Supabase syncOccupation (prev):', err));
    }
    syncOccupationToSupabase(newOcc).catch(err => console.warn('Supabase syncOccupation:', err));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
        detail: { action: 'allocated', occupation: newOcc }
      }));
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
    }

    return newOcc;
  },

  allocateAnimalAsync: async (allocation: Omit<KennelOccupation, 'id' | 'entryDate'>) => {
    const newOcc = db.allocateAnimal(allocation);
    try {
      await syncOccupationToSupabase(newOcc);
    } catch (e) {
      console.warn('Erro ao sincronizar alocação de baia:', e);
    }
    return newOcc;
  },

  releaseAnimalFromKennel: (animalId: string, releaseJustification?: string) => {
    const occupations = db.getOccupations();
    const idx = occupations.findIndex(o => o.animalId === animalId && !o.exitDate);
    if (idx > -1) {
      occupations[idx].exitDate = new Date().toISOString();
      if (releaseJustification) {
        occupations[idx].justification = occupations[idx].justification 
          ? `${occupations[idx].justification} (Desalocado: ${releaseJustification})`
          : `Desalocado: ${releaseJustification}`;
      }
      localStorage.setItem(KEYS.OCCUPATIONS, JSON.stringify(occupations));
      syncOccupationToSupabase(occupations[idx]).catch(err => console.warn('Supabase syncOccupation:', err));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sisbem-occupations-changed', {
          detail: { action: 'released', occupation: occupations[idx] }
        }));
        window.dispatchEvent(new CustomEvent('sisbem-animals-changed'));
      }
    }
  },

  releaseAnimalFromKennelAsync: async (animalId: string, releaseJustification?: string) => {
    db.releaseAnimalFromKennel(animalId, releaseJustification);
    const occupations = db.getOccupations();
    const updated = occupations.find(o => o.animalId === animalId && !!o.exitDate);
    if (updated) {
      try {
        await syncOccupationToSupabase(updated);
      } catch (e) {
        console.warn('Erro ao sincronizar desocupação:', e);
      }
    }
  },

  saveAnimal: (animalData: Partial<Animal>, personaData: Partial<Solicitante | Tutor> | null, userId: string) => {
    const animals = db.getAnimals();
    const solicitantes = db.getSolicitantes();
    const tutores = db.getTutores();
    const logs = db.getStatusLogs();
    
    const existingIndex = animals.findIndex(a => a.id === animalData.id);
    const existing = existingIndex > -1 ? animals[existingIndex] : null;

    let solicitanteId = animalData.solicitanteId || (existing ? existing.solicitanteId : '');
    let tutorId = animalData.tutorId || (existing ? existing.tutorId : undefined);

    const isExterno = !!animalData.temTutor;
    
    if (personaData && personaData.cpf) {
      if (isExterno) {
        // Lógica para Tutor
        let tutorIdx = tutores.findIndex(t => t.cpf === personaData.cpf);
        const tutorPersona = personaData as any;
        if (tutorIdx === -1) {
          const newTutor: Tutor = { 
            id: crypto.randomUUID(), 
            nomeCompleto: personaData.nomeCompleto || 'Tutor Desconhecido', 
            cpf: personaData.cpf, 
            telefone: personaData.telefone || '', 
            endereco: tutorPersona.endereco || '',
            temCadUnico: !!tutorPersona.temCadUnico,
            documentoCadUnico: tutorPersona.documentoCadUnico || '',
            dataCadastro: new Date().toISOString()
          };
          tutores.push(newTutor);
          tutorId = newTutor.id;
          syncTutorToSupabase(newTutor).catch(err => console.warn('Supabase syncTutor:', err));
        } else {
          tutores[tutorIdx] = { 
            ...tutores[tutorIdx], 
            nomeCompleto: personaData.nomeCompleto || tutores[tutorIdx].nomeCompleto, 
            telefone: personaData.telefone || tutores[tutorIdx].telefone,
            endereco: tutorPersona.endereco || tutores[tutorIdx].endereco,
            temCadUnico: tutorPersona.temCadUnico !== undefined ? !!tutorPersona.temCadUnico : tutores[tutorIdx].temCadUnico,
            documentoCadUnico: tutorPersona.documentoCadUnico || tutores[tutorIdx].documentoCadUnico
          };
          tutorId = tutores[tutorIdx].id;
          syncTutorToSupabase(tutores[tutorIdx]).catch(err => console.warn('Supabase syncTutor:', err));
        }
        localStorage.setItem(KEYS.TUTORES, JSON.stringify(tutores));
      } else {
        // Lógica para Solicitante / ONG
        const solPersona = personaData as Partial<Solicitante>;
        let solicitanteIdx = -1;
        
        if (solPersona.id) {
          solicitanteIdx = solicitantes.findIndex(s => s.id === solPersona.id);
        } else if (solPersona.codigoOng) {
          solicitanteIdx = solicitantes.findIndex(s => s.codigoOng && s.codigoOng.toUpperCase() === solPersona.codigoOng!.trim().toUpperCase());
        } else if (solPersona.cpf) {
          solicitanteIdx = solicitantes.findIndex(s => s.cpf === solPersona.cpf);
        }

        if (solicitanteIdx === -1) {
          const newSol: Solicitante = {
            id: solPersona.id || crypto.randomUUID(),
            nomeCompleto: solPersona.nomeCompleto || 'Desconhecido',
            cpf: solPersona.cpf || '',
            telefone: solPersona.telefone || '',
            tipo: solPersona.tipo || (solPersona.codigoOng ? 'ONG' : 'CIDADAO'),
            codigoOng: solPersona.codigoOng ? solPersona.codigoOng.trim().toUpperCase() : undefined,
            responsavel: solPersona.responsavel || '',
            endereco: solPersona.endereco || '',
            email: solPersona.email || ''
          };
          solicitantes.push(newSol);
          solicitanteId = newSol.id;
          syncSolicitanteToSupabase(newSol).catch(err => console.warn('Supabase syncSol:', err));
        } else {
          solicitantes[solicitanteIdx] = {
            ...solicitantes[solicitanteIdx],
            nomeCompleto: solPersona.nomeCompleto || solicitantes[solicitanteIdx].nomeCompleto,
            telefone: solPersona.telefone || solicitantes[solicitanteIdx].telefone,
            tipo: solPersona.tipo || solicitantes[solicitanteIdx].tipo,
            codigoOng: solPersona.codigoOng ? solPersona.codigoOng.trim().toUpperCase() : solicitantes[solicitanteIdx].codigoOng,
            responsavel: solPersona.responsavel || solicitantes[solicitanteIdx].responsavel,
            endereco: solPersona.endereco || solicitantes[solicitanteIdx].endereco,
            email: solPersona.email || solicitantes[solicitanteIdx].email
          };
          solicitanteId = solicitantes[solicitanteIdx].id;
          syncSolicitanteToSupabase(solicitantes[solicitanteIdx]).catch(err => console.warn('Supabase syncSol:', err));
        }
        localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(solicitantes));
      }
    } else if (!solicitanteId && !isExterno) {
      let unknownIdx = solicitantes.findIndex(s => s.nomeCompleto === 'Solicitante Desconhecido');
      if (unknownIdx === -1) {
        const solicitante = { id: crypto.randomUUID(), nomeCompleto: 'Solicitante Desconhecido', cpf: '000.000.000-00', telefone: '' };
        solicitantes.push(solicitante);
        solicitanteId = solicitante.id;
        syncSolicitanteToSupabase(solicitante).catch(err => console.warn('Supabase syncSol:', err));
      } else solicitanteId = solicitantes[unknownIdx].id;
      localStorage.setItem(KEYS.SOLICITANTES, JSON.stringify(solicitantes));
    }

    const isNew = !existing;
    
    const cleanData = { ...animalData };
    delete (cleanData as any).solicitante;
    delete (cleanData as any).tutor;
    delete (cleanData as any).usuarioResponsavel;
    delete (cleanData as any).historico;
    delete (cleanData as any).statusLogs;
    delete (cleanData as any).currentOccupation;

    const newAnimal: Animal = {
      ...(existing || {}),
      ...cleanData,
      id: cleanData.id || (existing ? existing.id : crypto.randomUUID()),
      peso: cleanData.peso !== undefined ? Number(cleanData.peso) : (existing ? existing.peso : 0),
      resgateSamuvet: cleanData.resgateSamuvet !== undefined ? !!cleanData.resgateSamuvet : (existing ? existing.resgateSamuvet : false),
      responsavelSamuvet: cleanData.responsavelSamuvet !== undefined ? cleanData.responsavelSamuvet : (existing ? existing.responsavelSamuvet : ''),
      dataCadastro: existing ? existing.dataCadastro : new Date().toISOString(),
      usuarioResponsavelId: existing ? existing.usuarioResponsavelId : userId,
      solicitanteId: solicitanteId,
      tutorId: tutorId
    } as Animal;

    if (!isNew && existing) {
      if (existing.condicao !== newAnimal.condicao) {
        logs.push({
          id: crypto.randomUUID(),
          animalId: newAnimal.id,
          statusAnterior: existing.condicao,
          statusNovo: newAnimal.condicao,
          dataAlteracao: new Date().toISOString(),
          usuarioId: userId
        });
        localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(logs));

        if ([AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO].includes(newAnimal.condicao)) {
          db.releaseAnimalFromKennel(newAnimal.id);
        }
      }
    } else if (isNew) {
       logs.push({
        id: crypto.randomUUID(),
        animalId: newAnimal.id,
        statusAnterior: null,
        statusNovo: newAnimal.condicao || AnimalCondicao.ACOLHIDO,
        dataAlteracao: new Date().toISOString(),
        usuarioId: userId
      });
      localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(logs));
    }

    if (existingIndex >= 0) {
      animals[existingIndex] = newAnimal;
    } else {
      animals.push(newAnimal);
    }
    
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(animals));
    syncAnimalToSupabase(newAnimal).catch(err => console.warn('Supabase syncAnimal:', err));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed', { detail: { animal: newAnimal } }));
    }
    return newAnimal;
  },

  saveAnimalAsync: async (data: Partial<Animal>, personaData: any, userId: string) => {
    const newAnimal = db.saveAnimal(data, personaData, userId);
    try {
      await syncAnimalToSupabase(newAnimal);
    } catch (err) {
      console.warn('Supabase syncAnimal error:', err);
    }
    return newAnimal;
  },

  deleteAnimal: (id: string) => {
    const animals = db.getAnimals().filter(a => a.id !== id);
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(animals));
    
    const records = db.getRecords().filter(r => r.animalId !== id);
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
    
    const logs = db.getStatusLogs().filter(l => l.animalId !== id);
    localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(logs));
    
    const occupations = db.getOccupations().filter(o => o.animalId !== id);
    localStorage.setItem(KEYS.OCCUPATIONS, JSON.stringify(occupations));

    const cirurgias = db.getCirurgias().filter(c => c.animalId !== id);
    localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));
    deleteAnimalFromSupabase(id).catch(err => console.warn('Supabase deleteAnimal:', err));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sisbem-animals-changed', { detail: { deletedId: id } }));
    }
  },

  getCirurgias: (): AgendamentoCirurgia[] => {
    const list: AgendamentoCirurgia[] = JSON.parse(localStorage.getItem(KEYS.CIRURGIAS) || '[]');
    return list.sort((a, b) => {
      const dateDiff = new Date(a.dataAgendada).getTime() - new Date(b.dataAgendada).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (a.horario || '').localeCompare(b.horario || '');
    });
  },

  getCirurgiasJoined: (): CirurgiaJoined[] => {
    const cirurgias = db.getCirurgias();
    const animals = db.getAnimalsJoined();
    const users = db.getUsers();

    return cirurgias.map(c => {
      const animal = animals.find(a => a.id === c.animalId);
      const vet = c.veterinarioResponsavelId ? users.find(u => u.id === c.veterinarioResponsavelId) : undefined;
      const criador = users.find(u => u.id === c.usuarioCriadorId);
      return {
        ...c,
        animal,
        veterinarioResponsavel: vet,
        usuarioCriador: criador
      };
    });
  },

  getCirurgiaById: (id: string): AgendamentoCirurgia | undefined => {
    const cirurgias = db.getCirurgias();
    return cirurgias.find(c => c.id === id);
  },

  saveCirurgia: (cirurgiaData: Partial<AgendamentoCirurgia>, userId: string): AgendamentoCirurgia => {
    const cirurgias = db.getCirurgias();
    const id = cirurgiaData.id || crypto.randomUUID();
    const isNew = !cirurgiaData.id;

    if (!cirurgiaData.animalId) {
      throw new Error("Animal é obrigatório para o agendamento cirúrgico.");
    }
    if (!cirurgiaData.dataAgendada) {
      throw new Error("Data de agendamento é obrigatória.");
    }

    const animal = db.getAnimals().find(a => a.id === cirurgiaData.animalId);
    let defaultTipo = 'Castração';
    if (animal) {
      if (animal.sexo === Sexo.MACHO) {
        defaultTipo = animal.especie === Especie.GATO ? 'Castração Felina (Orquiectomia)' : 'Castração Canina (Orquiectomia)';
      } else {
        defaultTipo = animal.especie === Especie.GATO ? 'Castração Felina (OSH)' : 'Castração Canina (OSH)';
      }
    }

    const newCirurgia: AgendamentoCirurgia = {
      id,
      animalId: cirurgiaData.animalId,
      dataAgendada: cirurgiaData.dataAgendada,
      horario: cirurgiaData.horario || '08:00',
      turno: cirurgiaData.turno || 'MANHA',
      tipoCirurgia: cirurgiaData.tipoCirurgia || defaultTipo,
      status: cirurgiaData.status || CirurgiaStatus.AGENDADA,
      prioridade: cirurgiaData.prioridade || CirurgiaPrioridade.NORMAL,
      veterinarioResponsavelId: cirurgiaData.veterinarioResponsavelId,
      veterinarioResponsavelNome: cirurgiaData.veterinarioResponsavelNome,
      observacoesPreOperatorias: cirurgiaData.observacoesPreOperatorias || 'Jejum alimentar de 8h e hídrico de 2h.',
      observacoesPosOperatorias: cirurgiaData.observacoesPosOperatorias,
      dataRealizacao: cirurgiaData.dataRealizacao,
      realizadaPorId: cirurgiaData.realizadaPorId,
      realizadaPorNome: cirurgiaData.realizadaPorNome,
      motivoCancelamento: cirurgiaData.motivoCancelamento,
      dataCadastro: cirurgiaData.dataCadastro || new Date().toISOString(),
      usuarioCriadorId: cirurgiaData.usuarioCriadorId || userId
    };

    const idx = cirurgias.findIndex(c => c.id === id);
    if (idx >= 0) {
      cirurgias[idx] = newCirurgia;
    } else {
      cirurgias.push(newCirurgia);
    }

    localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));
    syncSurgeryToSupabase(newCirurgia).catch(err => console.warn('Supabase syncSurgery:', err));

    // Se foi marcada como REALIZADA diretamente, atualiza o animal para castrado = true
    if (newCirurgia.status === CirurgiaStatus.REALIZADA) {
      db.saveAnimal({
        id: newCirurgia.animalId,
        castrado: true
      }, null, userId);
    }

    return newCirurgia;
  },

  concluirCirurgia: (id: string, dados: { 
    realizadaPorId: string, 
    realizadaPorNome?: string, 
    observacoesPosOperatorias?: string, 
    dataRealizacao?: string,
    receitas?: Array<Partial<Prescription>> 
  }): AgendamentoCirurgia => {
    const cirurgias = db.getCirurgias();
    const idx = cirurgias.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Agendamento cirúrgico não encontrado.");

    const cirurgia = cirurgias[idx];
    const dataRealizacao = dados.dataRealizacao || new Date().toISOString();

    const finalReceitas: Prescription[] = (dados.receitas || [])
      .filter(r => r.medicamento && r.medicamento.trim() !== '')
      .map(r => ({
        id: r.id || crypto.randomUUID(),
        medicamento: r.medicamento!.trim(),
        dosagem: r.dosagem?.trim() || 'Conforme prescrição',
        via: r.via?.trim() || 'Oral',
        frequencia: r.frequencia?.trim() || '12/12h',
        duracao: r.duracao?.trim() || '7 dias',
        observacoes: r.observacoes?.trim() || '',
        dataEmissao: dataRealizacao,
        veterinarioId: dados.realizadaPorId,
        animalId: cirurgia.animalId,
        prontuarioId: ''
      }));

    const updatedCirurgia: AgendamentoCirurgia = {
      ...cirurgia,
      status: CirurgiaStatus.REALIZADA,
      dataRealizacao,
      realizadaPorId: dados.realizadaPorId,
      realizadaPorNome: dados.realizadaPorNome,
      observacoesPosOperatorias: dados.observacoesPosOperatorias || cirurgia.observacoesPosOperatorias,
      receitasPosOperatorias: finalReceitas
    };

    cirurgias[idx] = updatedCirurgia;
    localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));
    syncSurgeryToSupabase(updatedCirurgia).catch(err => console.warn('Supabase syncSurgery:', err));

    // Atualiza status do animal para castrado: true se a cirurgia for castração
    const isCastracao = (cirurgia.tipoCirurgia || '').toLowerCase().includes('castra');
    if (isCastracao) {
      db.saveAnimal({
        id: cirurgia.animalId,
        castrado: true
      }, null, dados.realizadaPorId);
    }

    // Registra no histórico clínico que a cirurgia foi executada e inclui as receitas pós-operatórias
    try {
      db.saveRecord({
        animalId: cirurgia.animalId,
        veterinarioId: dados.realizadaPorId,
        dataAtendimento: dataRealizacao,
        diagnosticoClinico: `Procedimento Cirúrgico Realizado: ${cirurgia.tipoCirurgia}`,
        tratamentoAmbulatorial: `Cirurgia concluída com sucesso. ${dados.observacoesPosOperatorias || ''}${finalReceitas.length > 0 ? ` (${finalReceitas.length} medicamento(s) prescrito(s) no pós-cirúrgico)` : ''}`,
        statusResultante: AnimalCondicao.EM_TRATAMENTO,
        peso: '',
        temperatura: '',
        mucosa: 'Normocorada',
        hidratacao: 'Adequada',
        auscultaCardiaca: 'Normal',
        auscultaPulmonar: 'Normal',
        frequenciaCardiaca: '',
        frequenciaRespiratoria: '',
        palpacaoAbdominal: 'Ferida cirúrgica suturada',
        observacoesGerais: `Cirurgia realizada por: ${dados.realizadaPorNome || 'Corpo Clínico'}. Pós-operatório iniciado.`,
        receitas: finalReceitas
      }, dados.realizadaPorId);
    } catch (err) {
      console.warn("Aviso ao registrar prontuário da cirurgia:", err);
    }

    return updatedCirurgia;
  },

  cancelarCirurgia: (id: string, motivo: string): AgendamentoCirurgia => {
    const cirurgias = db.getCirurgias();
    const idx = cirurgias.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Agendamento cirúrgico não encontrado.");

    cirurgias[idx] = {
      ...cirurgias[idx],
      status: CirurgiaStatus.CANCELADA,
      motivoCancelamento: motivo
    };

    localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));
    syncSurgeryToSupabase(cirurgias[idx]).catch(err => console.warn('Supabase syncSurgery:', err));
    return cirurgias[idx];
  },

  deleteCirurgia: (id: string) => {
    const cirurgias = db.getCirurgias().filter(c => c.id !== id);
    localStorage.setItem(KEYS.CIRURGIAS, JSON.stringify(cirurgias));
    deleteSurgeryFromSupabase(id).catch(err => console.warn('Supabase deleteSurgery:', err));
  },

  deleteTutor: (id: string) => {
    const tutores = db.getTutores().filter(t => t.id !== id);
    localStorage.setItem(KEYS.TUTORES, JSON.stringify(tutores));
    
    const animals = db.getAnimals();
    const updatedAnimals = animals.map(a => a.tutorId === id ? { ...a, tutorId: undefined, temTutor: false } : a);
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(updatedAnimals));
    deleteTutorFromSupabase(id).catch(err => console.warn('Supabase deleteTutor:', err));
  },

  saveRecord: (record: Partial<ClinicalRecord>, vetId: string) => {
    const records = db.getRecords();
    const animals = db.getAnimals();
    const logs = db.getStatusLogs();
    const recordId = record.id || crypto.randomUUID();
    const animalId = record.animalId;

    if (!animalId) throw new Error("ID do animal é obrigatório.");

    const animalIdx = animals.findIndex(a => a.id === animalId);
    if (animalIdx === -1) throw new Error("Animal não encontrado.");

    const newRecord: ClinicalRecord = {
      ...record as ClinicalRecord,
      id: recordId,
      veterinarioId: vetId,
      dataAtendimento: record.dataAtendimento || new Date().toISOString(),
      inativo: false
    };

    if (record.statusResultante && record.statusResultante !== animals[animalIdx].condicao) {
      logs.push({
        id: crypto.randomUUID(),
        animalId: animalId,
        statusAnterior: animals[animalIdx].condicao,
        statusNovo: record.statusResultante,
        dataAlteracao: new Date().toISOString(),
        usuarioId: vetId,
        prontuarioId: recordId
      });
      
      const updateData: Partial<Animal> = {
        id: animalId,
        condicao: record.statusResultante
      };
      
      if (record.statusResultante === AnimalCondicao.OBITO) {
        updateData.dataObito = record.dataObito;
        updateData.causaObito = record.causaObito;
      } else if (record.statusResultante === AnimalCondicao.SOLTURA) {
        updateData.dataSoltura = record.dataSoltura;
        updateData.localSoltura = record.localSoltura;
      }

      db.saveAnimal(updateData, null, vetId);
    }

    if (record.necessitaInternacao !== undefined) {
      db.saveAnimal({
        id: animalId,
        necessitaInternacao: record.necessitaInternacao,
        tipoAcomodacaoSugerida: record.recommendedKennelType,
        justificativaInternacao: record.accommodationJustification,
        dataInternacao: record.necessitaInternacao ? (new Date().toISOString()) : undefined
      }, null, vetId);
    }

    if (record.microchipAplicado && record.numeroMicrochipAplicado) {
      db.saveAnimal({
        id: animalId,
        microchipado: true,
        numeroMicrochip: record.numeroMicrochipAplicado
      }, null, vetId);
    }

    if (newRecord.receitas && newRecord.receitas.length > 0) {
      newRecord.receitas = newRecord.receitas.map(r => ({
        ...r,
        prontuarioId: r.prontuarioId || recordId,
        animalId: r.animalId || animalId,
        veterinarioId: r.veterinarioId || vetId
      }));
    }

    const idx = records.findIndex(r => r.id === newRecord.id);
    if (idx >= 0) records[idx] = newRecord; else records.push(newRecord);
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
    syncRecordToSupabase(newRecord).catch(err => console.warn('Supabase syncRecord:', err));
    return newRecord;
  },

  internarAnimalExterno: (animalId: string, tipoAcomodacao: KennelType, justificativa: string, vetId: string) => {
    const animals = db.getAnimals();
    const animal = animals.find(a => a.id === animalId);
    if (!animal) throw new Error("Animal não encontrado.");

    const logs = db.getStatusLogs();
    logs.push({
      id: crypto.randomUUID(),
      animalId,
      statusAnterior: animal.condicao,
      statusNovo: AnimalCondicao.EM_TRATAMENTO,
      dataAlteracao: new Date().toISOString(),
      usuarioId: vetId
    });
    localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(logs));

    db.saveAnimal({
      id: animalId,
      condicao: AnimalCondicao.EM_TRATAMENTO,
      necessitaInternacao: true,
      tipoAcomodacaoSugerida: tipoAcomodacao,
      justificativaInternacao: justificativa,
      dataInternacao: new Date().toISOString()
    }, null, vetId);
  },

  darAltaAnimalExterno: (animalId: string, vetId: string, observacoes?: string) => {
    const animals = db.getAnimals();
    const animal = animals.find(a => a.id === animalId);
    if (!animal) throw new Error("Animal não encontrado.");

    // Se estiver ocupando baia, desaloca
    const occupations = db.getOccupations();
    const activeOcc = occupations.find(o => o.animalId === animalId && !o.exitDate);
    if (activeOcc) {
      db.releaseAnimalFromKennel(animalId, observacoes || 'Alta hospitalar pós-internação concedida pelo médico veterinário');
    }

    const logs = db.getStatusLogs();
    logs.push({
      id: crypto.randomUUID(),
      animalId,
      statusAnterior: animal.condicao,
      statusNovo: AnimalCondicao.ATENDIDO,
      dataAlteracao: new Date().toISOString(),
      usuarioId: vetId
    });
    localStorage.setItem(KEYS.STATUS_LOGS, JSON.stringify(logs));

    db.saveAnimal({
      id: animalId,
      condicao: AnimalCondicao.ATENDIDO,
      necessitaInternacao: false
    }, null, vetId);
  },

  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  getCurrentUser: (): User | null => {
    const user = localStorage.getItem(KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
  },

  login: (username: string, password: string): User | null => {
    const cleanU = username.trim().toLowerCase();
    const users = db.getUsers();
    const user = users.find(u => 
      (u.username?.toLowerCase() === cleanU || (u.email && u.email.toLowerCase() === cleanU)) && 
      u.password === password
    );
    if (user) {
      const { password: _, ...safeUser } = user;
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(safeUser));
      return safeUser as User;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  clearAllFictitiousData: () => clearAllFictitiousData(),
  resetAndSeedAllData: () => resetAndSeedAllData(),

  // Sincronização direta com Supabase
  syncAllToSupabase: () => syncAllLocalDataToSupabase(db),
  pullFromSupabase: () => pullFromSupabaseToLocal(db),
};

initSystem();

// Dispara sincronização inicial em segundo plano após carregamento
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncAllLocalDataToSupabase(db).catch(err => {
      console.warn('Sincronização em segundo plano Supabase:', err);
    });
  }, 2000);
}

