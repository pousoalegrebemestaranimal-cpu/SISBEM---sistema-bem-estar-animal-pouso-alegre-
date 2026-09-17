import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { AnimalJoined, AgendamentoCirurgia, CirurgiaStatus, CirurgiaPrioridade, CirurgiaJoined, Especie, Sexo, Porte, AnimalCondicao, User, Prescription } from '../types';
import { 
  Scissors, Calendar, Clock, AlertCircle, CheckCircle2, XCircle, 
  Search, Filter, Plus, User as UserIcon, Dog, Cat, ArrowRight,
  FileText, Printer, Stethoscope, AlertTriangle, ChevronRight, Check,
  Sparkles, ShieldCheck, Heart, UserCircle, MapPin, Eye, Edit3, Trash2, Pill
} from 'lucide-react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useSearchParams } = ReactRouterDOM as any;
import { format, isToday, isTomorrow, isPast, parseISO, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SurgicalWaitlist: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'fila';
  const preSelectedAnimalId = searchParams.get('animalId');

  const user = db.getCurrentUser();
  const isVetOrAdmin = user?.role === 'VETERINARIO' || user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'fila' | 'calendario' | 'pendentes'>(
    initialTab === 'pendentes' ? 'pendentes' : initialTab === 'calendario' ? 'calendario' : 'fila'
  );

  const [cirurgias, setCirurgias] = useState<CirurgiaJoined[]>([]);
  const [animals, setAnimals] = useState<AnimalJoined[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [dataFilter, setDataFilter] = useState<'TODOS' | 'HOJE' | 'SEMANA' | 'MES' | 'ATRASADAS'>('TODOS');
  const [especieFilter, setEspecieFilter] = useState<string>('TODAS');
  const [origemFilter, setOrigemFilter] = useState<string>('TODAS');

  // Modais
  const [isAgendamentoModalOpen, setIsAgendamentoModalOpen] = useState(false);
  const [isConcluirModalOpen, setIsConcluirModalOpen] = useState(false);
  const [isCancelarModalOpen, setIsCancelarModalOpen] = useState(false);
  
  const [editingCirurgia, setEditingCirurgia] = useState<CirurgiaJoined | null>(null);
  const [selectedCirurgiaToConcluir, setSelectedCirurgiaToConcluir] = useState<CirurgiaJoined | null>(null);
  const [selectedCirurgiaToCancelar, setSelectedCirurgiaToCancelar] = useState<CirurgiaJoined | null>(null);

  // Form de Agendamento
  const [formAnimalId, setFormAnimalId] = useState('');
  const [formDataAgendada, setFormDataAgendada] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formHorario, setFormHorario] = useState('08:30');
  const [formTurno, setFormTurno] = useState<'MANHA' | 'TARDE' | 'INTEGRAL'>('MANHA');
  const [formTipoCirurgia, setFormTipoCirurgia] = useState('');
  const [formPrioridade, setFormPrioridade] = useState<CirurgiaPrioridade>(CirurgiaPrioridade.NORMAL);
  const [formVetId, setFormVetId] = useState(user?.role === 'VETERINARIO' ? user.id : '');
  const [formObsPre, setFormObsPre] = useState('Jejum alimentar rigoroso de 8 horas e hídrico de 2 horas.');

  // Form de Conclusão
  const [conclusaoVetId, setConclusaoVetId] = useState(user?.id || '');
  const [conclusaoObs, setConclusaoObs] = useState('Procedimento cirúrgico realizado sem intercorrências anestésicas ou cirúrgicas. Paciente estável e encaminhado para recuperação pós-operatória.');
  const [incluirPrescricao, setIncluirPrescricao] = useState(false);
  const [prescricoesPosOp, setPrescricoesPosOp] = useState<Array<{
    id: string;
    medicamento: string;
    dosagem: string;
    via: string;
    frequencia: string;
    duracao: string;
    observacoes: string;
  }>>([]);
  const [imprimirPrescricaoAoConcluir, setImprimirPrescricaoAoConcluir] = useState(false);

  // Form de Cancelamento
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const loadData = () => {
    setCirurgias(db.getCirurgiasJoined());
    setAnimals(db.getAnimalsJoined());
    setUsers(db.getUsers());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Se veio parâmetro animalId na URL, abre o modal de agendamento pré-selecionado
  useEffect(() => {
    if (preSelectedAnimalId && animals.length > 0) {
      const found = animals.find(a => a.id === preSelectedAnimalId);
      if (found) {
        openNewAgendamentoModal(found);
      }
    }
  }, [preSelectedAnimalId, animals]);

  const vets = useMemo(() => {
    return users.filter(u => u.role === 'VETERINARIO' || u.role === 'ADMIN');
  }, [users]);

  // Estatísticas do Topo
  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const agendadasHoje = cirurgias.filter(c => 
      c.dataAgendada === todayStr && c.status !== CirurgiaStatus.CANCELADA
    ).length;

    const filaAtiva = cirurgias.filter(c => 
      c.status === CirurgiaStatus.AGENDADA || c.status === CirurgiaStatus.EM_PREPARO
    ).length;

    const realizadasMes = cirurgias.filter(c => {
      if (c.status !== CirurgiaStatus.REALIZADA || !c.dataRealizacao) return false;
      const d = parseISO(c.dataRealizacao);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const naoCastrados = animals.filter(a => 
      !a.temTutor && !a.castrado && ![AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO].includes(a.condicao)
    ).length;

    return { agendadasHoje, filaAtiva, realizadasMes, naoCastrados };
  }, [cirurgias, animals]);

  // Lista filtrada de cirurgias
  const filteredCirurgias = useMemo(() => {
    const today = startOfDay(new Date());

    return cirurgias.filter(c => {
      // Status
      if (statusFilter !== 'TODOS' && c.status !== statusFilter) return false;

      // Espécie
      if (especieFilter !== 'TODAS' && c.animal?.especie !== especieFilter) return false;

      // Origem
      if (origemFilter === 'TUTOR' && !c.animal?.temTutor) return false;
      if (origemFilter === 'RESGATE' && c.animal?.temTutor) return false;

      // Data
      if (dataFilter !== 'TODOS') {
        const cDate = parseISO(c.dataAgendada);
        if (dataFilter === 'HOJE') {
          if (!isToday(cDate)) return false;
        } else if (dataFilter === 'SEMANA') {
          const diffDays = (cDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
          if (diffDays < 0 || diffDays > 7) return false;
        } else if (dataFilter === 'MES') {
          if (cDate.getMonth() !== today.getMonth() || cDate.getFullYear() !== today.getFullYear()) return false;
        } else if (dataFilter === 'ATRASADAS') {
          if (!isPast(cDate) || isToday(cDate) || c.status === CirurgiaStatus.REALIZADA || c.status === CirurgiaStatus.CANCELADA) {
            return false;
          }
        }
      }

      // Busca
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;

      const nome = c.animal?.nome?.toLowerCase() || '';
      const raca = c.animal?.raca?.toLowerCase() || '';
      const tipo = c.tipoCirurgia?.toLowerCase() || '';
      const tutor = c.animal?.tutor?.nomeCompleto?.toLowerCase() || '';
      const solicitante = c.animal?.solicitante?.nomeCompleto?.toLowerCase() || '';
      const microchip = c.animal?.numeroMicrochip?.toLowerCase() || '';
      const vet = c.veterinarioResponsavelNome?.toLowerCase() || '';

      return nome.includes(search) || raca.includes(search) || tipo.includes(search) || 
             tutor.includes(search) || solicitante.includes(search) || microchip.includes(search) || vet.includes(search);
    });
  }, [cirurgias, statusFilter, dataFilter, especieFilter, origemFilter, searchTerm]);

  // Animais não castrados que estão sem agendamento futuro ativo (apenas animais internos do Centro)
  const animaisPendentesSemAgendamento = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return animals.filter(a => {
      // Restringe exclusivamente a animais internos (sem tutor) sob responsabilidade do Centro
      if (a.temTutor) return false;
      if (a.castrado) return false;
      if ([AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO].includes(a.condicao)) return false;
      if (a.agendamentoCastracaoAtivo) return false; // Já tem agendamento ativo

      if (especieFilter !== 'TODAS' && a.especie !== especieFilter) return false;
      if (origemFilter === 'TUTOR') return false; // Animais particulares com tutor não pertencem à lista interna
      if (origemFilter === 'RESGATE' && a.temTutor) return false;

      if (!search) return true;
      const nome = a.nome?.toLowerCase() || '';
      const raca = a.raca?.toLowerCase() || '';
      const sol = a.solicitante?.nomeCompleto?.toLowerCase() || '';
      return nome.includes(search) || raca.includes(search) || sol.includes(search);
    });
  }, [animals, searchTerm, especieFilter, origemFilter]);

  // Agrupamento por dia para visão de Calendário
  const cirurgiasPorData = useMemo(() => {
    const map: { [key: string]: CirurgiaJoined[] } = {};
    cirurgias.forEach(c => {
      if (!map[c.dataAgendada]) {
        map[c.dataAgendada] = [];
      }
      map[c.dataAgendada].push(c);
    });
    return Object.keys(map).sort().map(data => ({
      data,
      items: map[data]
    }));
  }, [cirurgias]);

  const openNewAgendamentoModal = (targetAnimal?: AnimalJoined) => {
    const selectedAnim = targetAnimal || animals.find(a => !a.castrado) || animals[0];
    setEditingCirurgia(null);
    setFormAnimalId(selectedAnim?.id || '');
    setFormDataAgendada(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    setFormHorario('08:30');
    setFormTurno('MANHA');
    setFormPrioridade(CirurgiaPrioridade.NORMAL);
    setFormVetId(vets[0]?.id || '');
    setFormObsPre('Jejum alimentar rigoroso de 8 horas e hídrico de 2 horas. Manter em repouso.');

    if (selectedAnim) {
      if (!selectedAnim.castrado) {
        if (selectedAnim.sexo === Sexo.MACHO) {
          setFormTipoCirurgia(selectedAnim.especie === Especie.GATO ? 'Castração Felina (Orquiectomia)' : 'Castração Canina (Orquiectomia)');
        } else {
          setFormTipoCirurgia(selectedAnim.especie === Especie.GATO ? 'Castração Felina (OSH)' : 'Castração Canina (OSH)');
        }
      } else {
        setFormTipoCirurgia('Outra Cirurgia / Procedimento');
      }
    } else {
      setFormTipoCirurgia('Castração (Orquiectomia/OSH)');
    }

    setIsAgendamentoModalOpen(true);
  };

  const openEditModal = (c: CirurgiaJoined) => {
    setEditingCirurgia(c);
    setFormAnimalId(c.animalId);
    setFormDataAgendada(c.dataAgendada);
    setFormHorario(c.horario || '08:30');
    setFormTurno(c.turno || 'MANHA');
    setFormTipoCirurgia(c.tipoCirurgia);
    setFormPrioridade(c.prioridade);
    setFormVetId(c.veterinarioResponsavelId || '');
    setFormObsPre(c.observacoesPreOperatorias || '');
    setIsAgendamentoModalOpen(true);
  };

  const handleAnimalSelectInModal = (animalId: string) => {
    setFormAnimalId(animalId);
    const sel = animals.find(a => a.id === animalId);
    if (sel) {
      if (!sel.castrado) {
        if (sel.sexo === Sexo.MACHO) {
          setFormTipoCirurgia(sel.especie === Especie.GATO ? 'Castração Felina (Orquiectomia)' : 'Castração Canina (Orquiectomia)');
        } else {
          setFormTipoCirurgia(sel.especie === Especie.GATO ? 'Castração Felina (OSH)' : 'Castração Canina (OSH)');
        }
      } else {
        setFormTipoCirurgia('Outra Cirurgia / Procedimento');
      }
    }
  };

  const handleSaveAgendamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAnimalId) {
      alert('Selecione um animal para o agendamento.');
      return;
    }
    if (!formDataAgendada) {
      alert('Selecione a data da cirurgia.');
      return;
    }

    const vetObj = users.find(u => u.id === formVetId);

    const payload: Partial<AgendamentoCirurgia> = {
      id: editingCirurgia?.id,
      animalId: formAnimalId,
      dataAgendada: formDataAgendada,
      horario: formHorario,
      turno: formTurno,
      tipoCirurgia: formTipoCirurgia || 'Castração',
      status: editingCirurgia?.status || CirurgiaStatus.AGENDADA,
      prioridade: formPrioridade,
      veterinarioResponsavelId: formVetId || undefined,
      veterinarioResponsavelNome: vetObj ? vetObj.name : (vets[0]?.name || 'Dr. Roberto Santos'),
      observacoesPreOperatorias: formObsPre
    };

    db.saveCirurgia(payload, user?.id || '1');
    setIsAgendamentoModalOpen(false);
    loadData();
  };

  const handleOpenConcluirModal = (c: CirurgiaJoined) => {
    setSelectedCirurgiaToConcluir(c);
    setConclusaoVetId(user?.id || c.veterinarioResponsavelId || vets[0]?.id || '');
    setConclusaoObs(`Cirurgia de ${c.tipoCirurgia} concluída com sucesso. Paciente estável, ferida cirúrgica suturada e sem intercorrências anestésicas.`);
    setIncluirPrescricao(false);
    setPrescricoesPosOp([]);
    setImprimirPrescricaoAoConcluir(false);
    setIsConcluirModalOpen(true);
  };

  const handleAddPrescricaoItem = (preset?: Partial<Prescription>) => {
    setPrescricoesPosOp(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medicamento: preset?.medicamento || '',
        dosagem: preset?.dosagem || '',
        via: preset?.via || 'Oral',
        frequencia: preset?.frequencia || '12/12h',
        duracao: preset?.duracao || '5 a 7 dias',
        observacoes: preset?.observacoes || ''
      }
    ]);
  };

  const handleRemovePrescricaoItem = (pId: string) => {
    setPrescricoesPosOp(prev => prev.filter(p => p.id !== pId));
  };

  const handlePrescricaoChange = (pId: string, field: string, value: string) => {
    setPrescricoesPosOp(prev => prev.map(p => p.id === pId ? { ...p, [field]: value } : p));
  };

  const handleCarregarProtocoloPadrao = () => {
    const animal = selectedCirurgiaToConcluir?.animal;
    const isGato = animal?.especie === Especie.GATO;

    setPrescricoesPosOp([
      {
        id: crypto.randomUUID(),
        medicamento: isGato ? 'Meloxicam 0,5mg (Suspensão ou Comprimidos)' : 'Meloxicam 1mg / 2mg',
        dosagem: isGato ? '0,1 mg/kg' : 'Conforme o peso (0,1 a 0,2 mg/kg)',
        via: 'Oral',
        frequencia: 'A cada 24 horas (1x ao dia)',
        duracao: isGato ? '3 dias' : '4 dias',
        observacoes: 'Administrar logo após a refeição. Não interromper sem orientação.'
      },
      {
        id: crypto.randomUUID(),
        medicamento: 'Dipirona Gotas 500mg/mL',
        dosagem: '1 gota por kg de peso corporal',
        via: 'Oral',
        frequencia: 'A cada 8 ou 12 horas',
        duracao: '3 a 4 dias',
        observacoes: 'Administrar em caso de dor ou desconforto pós-cirúrgico.'
      },
      {
        id: crypto.randomUUID(),
        medicamento: 'Curativo Local com Solução Fisiológica / Clorexidina 0,5%',
        dosagem: 'Higienização suave com gaze estéril',
        via: 'Tópica',
        frequencia: 'A cada 12 horas (2x ao dia)',
        duracao: '10 dias',
        observacoes: 'Manter a ferida cirúrgica limpa e seca. Uso indispensável de colar elizabetano ou roupa cirúrgica por 10 dias. Retorno para retirada de pontos em 10 a 14 dias.'
      }
    ]);
  };

  const handlePrintPrescriptionDirect = (animal: AnimalJoined, vet: any, prescriptions: Array<Partial<Prescription>>) => {
    if (!animal || prescriptions.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SISBEM - Receituário Pós-Cirúrgico</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap');
          body { font-family: 'Montserrat', sans-serif; padding: 40px; color: #000; line-height: 1.45; background: #fff; font-size: 14px; }
          .header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 25px; border-bottom: 3px solid #000; padding-bottom: 15px; }
          .title-container { flex-grow: 1; }
          .pref-de { font-size: 20px; font-weight: 400; letter-spacing: 10px; margin: 0; color: #000; }
          .pref-nome { font-size: 48px; font-weight: 900; margin: -5px 0 0 0; line-height: 1; letter-spacing: -2px; color: #000; }
          .sub-title { font-size: 18px; font-weight: 700; margin: 8px 0 0 0; color: #000; border-top: 2px solid #000; padding-top: 5px; }
          .meta-info { text-align: right; min-width: 140px; }
          .doc-tag { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #444; margin-bottom: 4px; }
          .doc-date { font-size: 18px; font-weight: 700; }
          .section { margin-bottom: 22px; }
          .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; color: #444; letter-spacing: 1px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .box { background: #fcfcfc; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 4px; }
          .label { font-size: 11.5px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
          .val { font-size: 15px; font-weight: 700; color: #000; }
          .item-box { border: 2px solid #000; padding: 18px; border-radius: 8px; margin-top: 14px; page-break-inside: avoid; }
          .item-top { border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .item-name { font-size: 20px; font-weight: 900; text-transform: uppercase; }
          .item-tag { font-size: 12px; font-weight: 900; background: #000; color: #fff; padding: 4px 10px; border-radius: 4px; }
          .item-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .obs-box { margin-top: 12px; padding: 12px; background: #f5f5f5; border-left: 4px solid #000; font-style: italic; font-size: 14px; line-height: 1.45; }
          .footer { margin-top: 70px; text-align: center; }
          .line { width: 280px; border-top: 1px solid #000; margin: 0 auto 8px; }
          .vet { font-size: 16px; font-weight: 900; text-transform: uppercase; }
          .crmv { font-size: 13px; font-weight: 700; color: #444; }
          @media print { body { padding: 0; font-size: 14px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-container">
            <div class="pref-de">PREFEITURA DE</div>
            <div class="pref-nome">POUSO ALEGRE</div>
            <div class="sub-title">Superintendência de Proteção e Cuidado Animal</div>
          </div>
          <div class="meta-info">
            <div class="doc-tag">Receituário Pós-Cirúrgico</div>
            <div class="doc-date">${format(new Date(), 'dd/MM/yyyy')}</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Paciente</div>
          <div class="grid">
            <div class="box"><div class="label">Animal / Espécie</div><div class="val">${animal.nome} (${animal.especie})</div></div>
            <div class="box"><div class="label">Raça / Sexo / Porte</div><div class="val">${animal.raca} • ${animal.sexo} • ${animal.porte}</div></div>
            <div class="box" style="grid-column: span 2"><div class="label">${animal.temTutor ? 'Tutor Responsável' : 'Acomodação / Custódia'}</div><div class="val">${animal.temTutor ? (animal.tutor?.nomeCompleto || 'Tutor Externo') : (animal.currentOccupation?.kennel?.name || 'Centro de Bem-Estar Animal de Pouso Alegre')}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Prescrição e Cuidados Pós-Operatórios</div>
          ${prescriptions.map((i, idx) => `
            <div class="item-box">
              <div class="item-top">
                <div class="item-name">${idx + 1}. ${i.medicamento}</div>
                <div class="item-tag">${i.via || 'Oral'}</div>
              </div>
              <div class="item-grid">
                <div><div class="label">Dosagem</div><div class="val">${i.dosagem || 'Conforme orientação médica'}</div></div>
                <div><div class="label">Frequência</div><div class="val">${i.frequencia || '12/12h'}</div></div>
                <div><div class="label">Duração</div><div class="val">${i.duracao || '5 a 7 dias'}</div></div>
              </div>
              ${i.observacoes ? `<div class="obs-box"><strong>Orientações:</strong> ${i.observacoes}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="footer">
          <div class="line"></div>
          <div class="vet">${vet?.name || 'Médico(a) Veterinário(a)'}</div>
          <div class="crmv">${vet?.crmv ? `CRMV: ${vet.crmv}` : 'Responsável Técnico'}</div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleConfirmarConclusao = () => {
    if (!selectedCirurgiaToConcluir) return;
    const vetObj = users.find(u => u.id === conclusaoVetId);

    const validReceitas = incluirPrescricao
      ? prescricoesPosOp.filter(p => p.medicamento && p.medicamento.trim() !== '')
      : [];

    db.concluirCirurgia(selectedCirurgiaToConcluir.id, {
      realizadaPorId: conclusaoVetId || user?.id || '1',
      realizadaPorNome: vetObj ? vetObj.name : user?.name,
      observacoesPosOperatorias: conclusaoObs,
      dataRealizacao: new Date().toISOString(),
      receitas: validReceitas
    });

    if (imprimirPrescricaoAoConcluir && validReceitas.length > 0 && selectedCirurgiaToConcluir.animal) {
      handlePrintPrescriptionDirect(
        selectedCirurgiaToConcluir.animal,
        vetObj || user,
        validReceitas
      );
    }

    setIsConcluirModalOpen(false);
    setSelectedCirurgiaToConcluir(null);
    loadData();
  };

  const handleOpenCancelarModal = (c: CirurgiaJoined) => {
    setSelectedCirurgiaToCancelar(c);
    setMotivoCancelamento('');
    setIsCancelarModalOpen(true);
  };

  const handleConfirmarCancelamento = () => {
    if (!selectedCirurgiaToCancelar) return;
    if (!motivoCancelamento.trim()) {
      alert('Informe a justificativa de cancelamento.');
      return;
    }

    db.cancelarCirurgia(selectedCirurgiaToCancelar.id, motivoCancelamento.trim());
    setIsCancelarModalOpen(false);
    setSelectedCirurgiaToCancelar(null);
    loadData();
  };

  const handleMudarStatusPreOp = (c: CirurgiaJoined) => {
    db.saveCirurgia({
      id: c.id,
      animalId: c.animalId,
      dataAgendada: c.dataAgendada,
      status: CirurgiaStatus.EM_PREPARO
    }, user?.id || '1');
    loadData();
  };

  const handlePrintTermo = (c: CirurgiaJoined) => {
    const animal = c.animal;
    if (!animal) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Permita pop-ups para imprimir o termo.');
      return;
    }

    const dataFormatted = format(parseISO(c.dataAgendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Termo de Consentimento Cirúrgico - ${animal.nome}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.55; font-size: 14px; }
          .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 19px; font-weight: bold; text-transform: uppercase; color: #0f766e; }
          .subtitle { font-size: 13.5px; color: #64748b; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; }
          .value { font-size: 14.5px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          .text-block { text-align: justify; font-size: 13px; color: #334155; margin: 16px 0; line-height: 1.5; }
          .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .sig-line { border-top: 1px solid #0f172a; text-align: center; padding-top: 8px; font-weight: bold; font-size: 13.5px; }
          @media print { body { padding: 20px; font-size: 14px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SISBEM - Centro Municipal de Bem-Estar Animal</div>
          <div class="subtitle">TERMO DE AUTORIZAÇÃO E CONSENTIMENTO PARA PROCEDIMENTO CIRÚRGICO / CASTRAÇÃO</div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">1. DADOS DO PACIENTE</div>
          <div class="grid-3">
            <div><div class="label">Nome do Animal</div><div class="value">${animal.nome.toUpperCase()}</div></div>
            <div><div class="label">Espécie / Sexo</div><div class="value">${animal.especie} - ${animal.sexo}</div></div>
            <div><div class="label">Porte / Raça</div><div class="value">${animal.porte} | ${animal.raca}</div></div>
            <div><div class="label">Peso Estimado</div><div class="value">${animal.peso ? animal.peso + ' kg' : 'A aferir'}</div></div>
            <div><div class="label">Microchip</div><div class="value">${animal.numeroMicrochip || 'Não microchipado'}</div></div>
            <div><div class="label">Data Agendada</div><div class="value">${dataFormatted} (${c.horario || 'Manhã'})</div></div>
          </div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">2. RESPONSÁVEL / ORIGEM</div>
          <div class="grid-2">
            <div><div class="label">${animal.temTutor ? 'Tutor Legal' : 'Solicitante / Órgão'}</div><div class="value">${animal.temTutor ? animal.tutor?.nomeCompleto : (animal.solicitante?.nomeCompleto || 'Recolhimento Municipal')}</div></div>
            <div><div class="label">CPF / Registro</div><div class="value">${animal.temTutor ? animal.tutor?.cpf : (animal.solicitante?.cpf || 'DESC-ANONIMO')}</div></div>
            <div><div class="label">Telefone de Contato</div><div class="value">${animal.temTutor ? animal.tutor?.telefone : (animal.solicitante?.telefone || '-')}</div></div>
            <div><div class="label">Endereço</div><div class="value">${animal.temTutor ? animal.tutor?.endereco || '-' : (animal.solicitante?.endereco || animal.localResgate)}</div></div>
          </div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">3. PROCEDIMENTO E ORIENTAÇÕES PRÉ-OPERATÓRIAS</div>
          <div><div class="label">Procedimento Proposto</div><div class="value">${c.tipoCirurgia}</div></div>
          <div style="margin-top: 8px;"><div class="label">Preparo Pré-Operatório</div><div class="value">${c.observacoesPreOperatorias || 'Jejum alimentar de 8h e hídrico de 2h.'}</div></div>
        </div>

        <div class="text-block">
          <p>Declaro estar ciente de que qualquer ato cirúrgico e anestésico envolve riscos imprevisíveis à vida do animal. Autorizo expressamente o corpo médico-veterinário do Centro de Bem-Estar Animal a realizar o procedimento de castração/esterilização cirúrgica e os procedimentos complementares ou de emergência que se fizerem necessários durante o ato cirúrgico.</p>
          <p style="margin-top: 8px;">Comprometo-me a seguir todas as orientações pós-operatórias para a devida recuperação do paciente, incluindo a administração dos medicamentos prescritos e o uso de colar elizabetano / roupa cirúrgica.</p>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">
              ${animal.temTutor && animal.tutor ? animal.tutor.nomeCompleto : 'Responsável / Solicitante'}<br>
              <span style="font-size: 9px; font-weight: normal; color: #64748b;">Assinatura do Responsável</span>
            </div>
          </div>
          <div>
            <div class="sig-line">
              ${c.veterinarioResponsavelNome || 'Médico(a) Veterinário(a)'}<br>
              <span style="font-size: 9px; font-weight: normal; color: #64748b;">CRMV / Equipe Cirúrgica</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const getStatusBadge = (status: CirurgiaStatus) => {
    switch (status) {
      case CirurgiaStatus.AGENDADA:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
            <Clock size={12} className="text-blue-600" /> Agendada
          </span>
        );
      case CirurgiaStatus.EM_PREPARO:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 shadow-sm animate-pulse">
            <AlertCircle size={12} className="text-amber-600" /> Em Pré-Operatório
          </span>
        );
      case CirurgiaStatus.REALIZADA:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <CheckCircle2 size={12} className="text-emerald-600" /> Castração Realizada
          </span>
        );
      case CirurgiaStatus.CANCELADA:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <XCircle size={12} className="text-rose-600" /> Cancelada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-md shadow-teal-600/20">
              <Scissors size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Fila Cirúrgica & Agenda de Castração
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Controle do cronograma cirúrgico, triagem pré-operatória e esterilização de animais.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isVetOrAdmin && (
            <button
              type="button"
              onClick={() => openNewAgendamentoModal()}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-xs font-black rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus size={16} /> Novo Agendamento Cirúrgico
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Cirúrgicas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agendadas Hoje</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Calendar size={16} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.agendadasHoje}</p>
          <p className="text-[11px] text-slate-500 font-medium">Procedimentos previstos para a data atual</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fila Cirúrgica Ativa</p>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><Scissors size={16} /></div>
          </div>
          <p className="text-2xl font-black text-teal-700">{stats.filaAtiva}</p>
          <p className="text-[11px] text-slate-500 font-medium">Pacientes aguardando ou em pré-op</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizadas no Mês</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={16} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-700">{stats.realizadasMes}</p>
          <p className="text-[11px] text-slate-500 font-medium">Castrações concluídas neste mês</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Não Castrados (Centro)</p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><AlertCircle size={16} /></div>
          </div>
          <p className="text-2xl font-black text-amber-600">{stats.naoCastrados}</p>
          <p className="text-[11px] text-slate-500 font-medium">Animais internos que precisam de castração</p>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('fila')}
          className={`pb-4 text-sm font-black transition-all relative flex items-center gap-2 ${
            activeTab === 'fila' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Scissors size={18} />
          Fila Cirúrgica ({cirurgias.filter(c => c.status !== CirurgiaStatus.CANCELADA).length})
          {activeTab === 'fila' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}
        </button>

        <button
          onClick={() => setActiveTab('calendario')}
          className={`pb-4 text-sm font-black transition-all relative flex items-center gap-2 ${
            activeTab === 'calendario' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar size={18} />
          Agenda Diária ({cirurgiasPorData.length} dias programados)
          {activeTab === 'calendario' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}
        </button>

        <button
          onClick={() => setActiveTab('pendentes')}
          className={`pb-4 text-sm font-black transition-all relative flex items-center gap-2 ${
            activeTab === 'pendentes' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <AlertTriangle size={18} className="text-amber-500" />
          Pacientes Não Castrados ({animaisPendentesSemAgendamento.length})
          {activeTab === 'pendentes' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600 rounded-t-full" />}
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por animal, raça, tutor, solicitante, cirurgião ou microchip..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium"
            />
          </div>

          <div>
            <select
              value={especieFilter}
              onChange={e => setEspecieFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
            >
              <option value="TODAS">Todas as Espécies</option>
              <option value={Especie.CAO}>Cães</option>
              <option value={Especie.GATO}>Gatos</option>
            </select>
          </div>

          <div>
            <select
              value={origemFilter}
              onChange={e => setOrigemFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
            >
              <option value="TODAS">Todas as Origens</option>
              <option value="TUTOR">Com Tutor (Externo)</option>
              <option value="RESGATE">Resgate / Sob Custódia</option>
            </select>
          </div>
        </div>

        {activeTab === 'fila' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-400 uppercase text-[10px]">Data:</span>
              {(['TODOS', 'HOJE', 'SEMANA', 'MES', 'ATRASADAS'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDataFilter(d)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    dataFilter === d 
                      ? 'bg-teal-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d === 'TODOS' ? 'Todas as Datas' : d === 'HOJE' ? 'Hoje' : d === 'SEMANA' ? 'Próximos 7 Dias' : d === 'MES' ? 'Este Mês' : 'Atrasadas'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-400 uppercase text-[10px]">Status:</span>
              {['TODOS', CirurgiaStatus.AGENDADA, CirurgiaStatus.EM_PREPARO, CirurgiaStatus.REALIZADA, CirurgiaStatus.CANCELADA].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === st 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'TODOS' ? 'Todos os Status' : st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ABA 1: FILA CIRÚRGICA */}
      {activeTab === 'fila' && (
        <div className="space-y-4">
          {filteredCirurgias.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Scissors size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800">Nenhum agendamento cirúrgico encontrado</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Não há cirurgias para os filtros selecionados. Você pode agendar novos procedimentos para animais não castrados.
              </p>
              {isVetOrAdmin && (
                <button
                  onClick={() => openNewAgendamentoModal()}
                  className="px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-teal-700"
                >
                  + Agendar Castração
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCirurgias.map(c => {
                const animal = c.animal;
                const dataCirurgia = parseISO(c.dataAgendada);
                const isLate = isPast(dataCirurgia) && !isToday(dataCirurgia) && c.status === CirurgiaStatus.AGENDADA;

                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-2xl border-2 shadow-sm transition-all overflow-hidden p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 ${
                      c.status === CirurgiaStatus.REALIZADA 
                        ? 'border-emerald-100 bg-emerald-50/20' 
                        : c.status === CirurgiaStatus.EM_PREPARO
                        ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/30'
                        : isLate 
                        ? 'border-rose-300 bg-rose-50/20' 
                        : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {/* Animal & Cirurgia Info */}
                    <div className="flex items-start sm:items-center gap-4 flex-1">
                      <div className="relative shrink-0">
                        {animal?.foto ? (
                          <img src={animal.foto} alt={animal.nome} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200" />
                        ) : (
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl border-2 ${
                            animal?.especie === Especie.GATO ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-teal-50 text-teal-600 border-teal-200'
                          }`}>
                            {animal?.especie === Especie.GATO ? <Cat size={28} /> : <Dog size={28} />}
                          </div>
                        )}
                        {animal?.sexo && (
                          <span className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase border shadow-sm ${
                            animal.sexo === Sexo.MACHO ? 'bg-blue-600 text-white border-blue-700' : 'bg-pink-600 text-white border-pink-700'
                          }`}>
                            {animal.sexo === Sexo.MACHO ? 'M' : 'F'}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/animais/ficha/${c.animalId}`} className="text-lg font-black text-slate-900 hover:text-teal-600 transition-colors uppercase truncate">
                            {animal?.nome || 'Animal sem identificação'}
                          </Link>
                          <span className="text-xs text-slate-500 font-bold">({animal?.especie} - {animal?.raca})</span>
                          {getStatusBadge(c.status)}
                          {c.prioridade === CirurgiaPrioridade.URGENTE && (
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">Urgente</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="font-bold text-teal-800 flex items-center gap-1">
                            <Scissors size={13} className="text-teal-600" /> {c.tipoCirurgia}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-slate-400" /> 
                            <strong className={isToday(dataCirurgia) ? 'text-teal-700 font-black' : ''}>
                              {format(dataCirurgia, "dd/MM/yyyy (eeee)", { locale: ptBR })}
                            </strong>
                          </span>
                          {c.horario && (
                            <span className="flex items-center gap-1 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              <Clock size={12} /> {c.horario}
                            </span>
                          )}
                        </div>

                        {/* Detalhes de Tutor ou Solicitante */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                          {animal?.temTutor && animal.tutor ? (
                            <span className="flex items-center gap-1 text-indigo-700 font-bold">
                              <UserCircle size={13} /> Tutor: {animal.tutor.nomeCompleto} ({animal.tutor.telefone || 'Sem fone'})
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-600">
                              <MapPin size={13} /> Origem: {animal?.solicitante?.nomeCompleto || 'Recolhimento Municipal'}
                            </span>
                          )}
                          {c.veterinarioResponsavelNome && (
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                              <Stethoscope size={13} className="text-teal-600" /> Cirurgião: {c.veterinarioResponsavelNome}
                            </span>
                          )}
                        </div>

                        {c.observacoesPreOperatorias && (
                          <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 px-2.5 py-1 rounded-lg inline-block mt-1">
                            <strong className="uppercase text-[9px] font-black">Preparo:</strong> {c.observacoesPreOperatorias}
                          </div>
                        )}

                        {c.status === CirurgiaStatus.CANCELADA && c.motivoCancelamento && (
                          <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg inline-block mt-1">
                            <strong className="uppercase text-[9px] font-black">Motivo do Cancelamento:</strong> {c.motivoCancelamento}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex flex-wrap lg:flex-col items-end gap-2 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                      {isVetOrAdmin && c.status === CirurgiaStatus.AGENDADA && (
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                          <button
                            type="button"
                            onClick={() => handleMudarStatusPreOp(c)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-300 font-bold text-xs rounded-xl hover:bg-amber-100 transition-all shadow-sm"
                            title="Iniciar triagem e preparo pré-operatório"
                          >
                            <AlertCircle size={14} /> Iniciar Pré-Op
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenConcluirModal(c)}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
                            title="Confirmar realização da cirurgia"
                          >
                            <CheckCircle2 size={14} /> Concluir Cirurgia
                          </button>
                        </div>
                      )}

                      {isVetOrAdmin && c.status === CirurgiaStatus.EM_PREPARO && (
                        <button
                          type="button"
                          onClick={() => handleOpenConcluirModal(c)}
                          className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 animate-pulse"
                        >
                          <CheckCircle2 size={16} /> Concluir Cirurgia
                        </button>
                      )}

                      <div className="flex items-center gap-1.5">
                        {c.status === CirurgiaStatus.REALIZADA && c.receitasPosOperatorias && c.receitasPosOperatorias.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePrintPrescriptionDirect(
                              c.animal!,
                              c.veterinarioResponsavel || users.find(u => u.id === c.realizadaPorId),
                              c.receitasPosOperatorias!
                            )}
                            className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-xs rounded-xl hover:bg-teal-100 transition-all shadow-sm"
                            title="Imprimir Receituário Pós-Cirúrgico"
                          >
                            <Pill size={14} className="text-teal-600" /> Receita
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePrintTermo(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
                          title="Imprimir Termo de Autorização e Ficha Pré-Operatória"
                        >
                          <Printer size={14} /> Termo
                        </button>

                        <Link
                          to={`/animais/ficha/${c.animalId}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
                          title="Ver ficha completa do animal"
                        >
                          <Eye size={14} /> Ficha
                        </Link>

                        {isVetOrAdmin && c.status !== CirurgiaStatus.REALIZADA && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                              title="Reagendar / Editar Cirurgia"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCancelarModal(c)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Cancelar agendamento"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: AGENDA DIÁRIA (CALENDÁRIO) */}
      {activeTab === 'calendario' && (
        <div className="space-y-6">
          {cirurgiasPorData.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
              <p className="text-slate-500 font-medium">Nenhuma data com cirurgias programadas.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cirurgiasPorData.map(group => {
                const dataObj = parseISO(group.data);
                const isDateToday = isToday(dataObj);
                const isDateTomorrow = isTomorrow(dataObj);

                return (
                  <div key={group.data} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className={`p-4 px-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isDateToday 
                        ? 'bg-teal-50 border-teal-200 text-teal-900' 
                        : isDateTomorrow 
                        ? 'bg-blue-50 border-blue-200 text-blue-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl font-mono font-black text-center min-w-[54px] ${
                          isDateToday ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          <span className="block text-xs uppercase">{format(dataObj, 'MMM', { locale: ptBR })}</span>
                          <span className="block text-lg leading-none">{format(dataObj, 'dd')}</span>
                        </div>
                        <div>
                          <h4 className="text-base font-black uppercase">
                            {format(dataObj, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </h4>
                          <span className="text-xs opacity-75 font-medium">
                            {isDateToday ? '⭐ Cirurgias de Hoje' : isDateTomorrow ? 'Amanhã' : 'Dia Programado'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-white text-slate-800 font-black rounded-lg text-xs border border-slate-200 shadow-sm">
                          {group.items.length} {group.items.length === 1 ? 'procedimento' : 'procedimentos'}
                        </span>
                        {isVetOrAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              openNewAgendamentoModal();
                              setFormDataAgendada(group.data);
                            }}
                            className="p-1.5 bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                            title="Adicionar mais um paciente neste dia"
                          >
                            <Plus size={14} /> Agendar neste dia
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.items.map(c => (
                        <div key={c.id} className="p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-xs font-black px-2 py-1 bg-slate-100 text-slate-700 rounded-md">
                              {c.horario || '08:30'}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <Link to={`/animais/ficha/${c.animalId}`} className="font-black text-slate-900 hover:text-teal-600 uppercase text-sm">
                                  {c.animal?.nome}
                                </Link>
                                <span className="text-xs text-slate-400">({c.animal?.especie} - {c.animal?.sexo})</span>
                                {getStatusBadge(c.status)}
                              </div>
                              <p className="text-xs text-teal-800 font-medium">{c.tipoCirurgia}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isVetOrAdmin && (c.status === CirurgiaStatus.AGENDADA || c.status === CirurgiaStatus.EM_PREPARO) && (
                              <button
                                onClick={() => handleOpenConcluirModal(c)}
                                className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700"
                              >
                                Concluir Cirurgia
                              </button>
                            )}
                            {c.status === CirurgiaStatus.REALIZADA && c.receitasPosOperatorias && c.receitasPosOperatorias.length > 0 && (
                              <button
                                onClick={() => handlePrintPrescriptionDirect(
                                  c.animal!,
                                  c.veterinarioResponsavel || users.find(u => u.id === c.realizadaPorId),
                                  c.receitasPosOperatorias!
                                )}
                                className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg"
                                title="Imprimir Receituário Pós-Cirúrgico"
                              >
                                <Pill size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handlePrintTermo(c)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                              title="Imprimir Termo"
                            >
                              <Printer size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: BANCO DE ANIMAIS NÃO CASTRADOS (SEM AGENDAMENTO) */}
      {activeTab === 'pendentes' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-900 uppercase">Banco de Espera para Castração (Animais Internos)</h4>
                <p className="text-xs text-amber-700">
                  Animais sob tutela do Centro (internos / resgatados) que ainda não foram castrados e não possuem data agendada.
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-900 bg-amber-200/70 px-3 py-1 rounded-xl self-start sm:self-auto">
              {animaisPendentesSemAgendamento.length} animais internos aptos
            </span>
          </div>

          {animaisPendentesSemAgendamento.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-base font-black text-slate-800">Nenhum animal interno pendente de castração sem agendamento!</h3>
              <p className="text-xs text-slate-500 mt-1">Todos os animais internos não castrados já possuem data cirúrgica programada na fila.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {animaisPendentesSemAgendamento.map(animal => (
                <div key={animal.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 transition-all flex flex-col justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {animal.foto ? (
                      <img src={animal.foto} alt={animal.nome} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold shrink-0">
                        {animal.especie === Especie.GATO ? <Cat size={24} /> : <Dog size={24} />}
                      </div>
                    )}
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <Link to={`/animais/ficha/${animal.id}`} className="font-black text-slate-900 hover:text-teal-600 uppercase text-sm truncate">
                          {animal.nome}
                        </Link>
                        <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Não Castrado
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{animal.especie} • {animal.raca} • {animal.sexo}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {animal.temTutor ? `Tutor: ${animal.tutor?.nomeCompleto}` : `Origem: ${animal.solicitante?.nomeCompleto || 'Resgate'}`}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">ID: {animal.id.substring(0, 8)}</span>
                    {isVetOrAdmin && (
                      <button
                        type="button"
                        onClick={() => openNewAgendamentoModal(animal)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 shadow-sm transition-all"
                      >
                        <Scissors size={14} /> Agendar Castração
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE AGENDAMENTO / EDIÇÃO DE CIRURGIA */}
      {isAgendamentoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Scissors size={22} className="text-teal-200" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">
                    {editingCirurgia ? 'Editar Agendamento Cirúrgico' : 'Agendar Cirurgia / Procedimento'}
                  </h3>
                  <p className="text-xs text-teal-100 font-medium">Cronograma da fila cirúrgica municipal</p>
                </div>
              </div>
              <button
                onClick={() => setIsAgendamentoModalOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAgendamento} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Seleção do Animal */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Paciente (Animal) *
                </label>
                <select
                  required
                  value={formAnimalId}
                  onChange={e => handleAnimalSelectInModal(e.target.value)}
                  disabled={!!editingCirurgia}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">Selecione o animal...</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nome.toUpperCase()} ({a.especie} - {a.sexo} - {a.raca}) {a.castrado ? '✓ Castrado' : '⚠️ Não Castrado'} {a.temTutor ? `[Tutor: ${a.tutor?.nomeCompleto}]` : '[Resgate]'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data e Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Data da Cirurgia *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDataAgendada}
                    onChange={e => setFormDataAgendada(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Horário / Turno
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={formHorario}
                      onChange={e => setFormHorario(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                    />
                    <select
                      value={formTurno}
                      onChange={e => setFormTurno(e.target.value as any)}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="MANHA">Manhã</option>
                      <option value="TARDE">Tarde</option>
                      <option value="INTEGRAL">Integral</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tipo de Procedimento e Prioridade */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Procedimento Cirúrgico *
                    </label>
                    <input
                      type="text"
                      required
                      value={formTipoCirurgia}
                      onChange={e => setFormTipoCirurgia(e.target.value)}
                      placeholder="Ex: Castração, Mastectomia, Sutura..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Nível de Prioridade
                    </label>
                    <select
                      value={formPrioridade}
                      onChange={e => setFormPrioridade(e.target.value as CirurgiaPrioridade)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value={CirurgiaPrioridade.NORMAL}>Normal (Eletiva)</option>
                      <option value={CirurgiaPrioridade.URGENTE}>Urgente (Prioritária)</option>
                      <option value={CirurgiaPrioridade.FILA_ESPERA}>Fila de Espera Regular</option>
                    </select>
                  </div>
                </div>

                {/* Sugestões Rápidas de Procedimentos */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Sugestões Rápidas de Procedimentos:
                  </span>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] font-black text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">Castrações:</span>
                    {['Castração Canina (Orquiectomia)', 'Castração Canina (OSH)', 'Castração Felina (Orquiectomia)', 'Castração Felina (OSH)'].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setFormTipoCirurgia(sug)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                          formTipoCirurgia === sug
                            ? 'bg-teal-600 text-white border-teal-600 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-200/80">
                    <span className="text-[9px] font-black text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded">Outras Cirurgias:</span>
                    {[
                      'Mastectomia',
                      'Nodulectomia / Exérese de Tumor',
                      'Sutura / Debridamento de Ferida',
                      'Amputação de Membro / Caudectomia',
                      'Enucleação Oftálmica',
                      'Herniorrafia (Umbilical/Inguinal)',
                      'Profilaxia Dentária / Extração',
                      'Desobstrução Uretral / Uretrostomia',
                      'Laparotomia Exploratória'
                    ].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setFormTipoCirurgia(sug)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                          formTipoCirurgia === sug
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cirurgião Responsável */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Médico Veterinário Cirurgião
                </label>
                <select
                  value={formVetId}
                  onChange={e => setFormVetId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">Selecione o profissional...</option>
                  {vets.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.crmv ? `(CRMV ${v.crmv})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Orientações Pré-Operatórias */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Orientações Pré-Operatórias (Jejum, Exames, Cuidados)
                </label>
                <textarea
                  rows={2}
                  value={formObsPre}
                  onChange={e => setFormObsPre(e.target.value)}
                  placeholder="Ex: Jejum alimentar de 8h e hídrico de 2h. Trazer cobertor e guia."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAgendamentoModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-600 text-white text-xs font-black rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all"
                >
                  {editingCirurgia ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONCLUSÃO DE CIRURGIA */}
      {isConcluirModalOpen && selectedCirurgiaToConcluir && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Cabeçalho */}
            <div className="p-5 sm:p-6 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <CheckCircle2 size={24} className="text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Conclusão de Cirurgia</h3>
                  <p className="text-xs text-emerald-100 font-medium">Registrar procedimento realizado e orientações pós-operatórias</p>
                </div>
              </div>
              <button
                onClick={() => setIsConcluirModalOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Informações do Paciente */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Paciente</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    {selectedCirurgiaToConcluir.tipoCirurgia}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 uppercase">
                  {selectedCirurgiaToConcluir.animal?.nome}
                  <span className="text-xs font-normal text-slate-500 normal-case ml-2">
                    ({selectedCirurgiaToConcluir.animal?.especie} • {selectedCirurgiaToConcluir.animal?.sexo} • {selectedCirurgiaToConcluir.animal?.porte})
                  </span>
                </p>
                <p className="text-xs text-emerald-800 font-medium">
                  Ao confirmar, o procedimento será registrado como <strong>REALIZADA</strong> no histórico clínico{selectedCirurgiaToConcluir.tipoCirurgia.toLowerCase().includes('castra') ? ' e o status do animal será atualizado para CASTRADO' : ''}.
                </p>
              </div>

              {/* Veterinário Executor */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Médico Veterinário que Realizou a Cirurgia
                </label>
                <select
                  value={conclusaoVetId}
                  onChange={e => setConclusaoVetId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {vets.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.crmv ? `(CRMV ${v.crmv})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Relato Pós-Operatório */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Relato Pós-Operatório / Observações
                </label>
                <textarea
                  rows={2}
                  value={conclusaoObs}
                  onChange={e => setConclusaoObs(e.target.value)}
                  placeholder="Descreva o procedimento, estabilidade do paciente e recomendações..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* SEÇÃO: INCLUIR PRESCRIÇÃO PÓS-CIRÚRGICA */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                      <Pill size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Prescrição Pós-Cirúrgica
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Incluir receituário médico e cuidados no prontuário do paciente
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incluirPrescricao}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIncluirPrescricao(checked);
                        if (checked && prescricoesPosOp.length === 0) {
                          handleCarregarProtocoloPadrao();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {incluirPrescricao && (
                  <div className="p-4 space-y-4 bg-slate-50/50">
                    {/* Botões de Ação Rápida */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleCarregarProtocoloPadrao}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 font-bold text-xs rounded-xl hover:bg-teal-100 transition-all"
                        title="Preencher com Meloxicam, Dipirona e Cuidados com a Ferida"
                      >
                        <Sparkles size={14} className="text-teal-600" /> Carregar Protocolo Sugerido
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddPrescricaoItem()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-sm"
                      >
                        <Plus size={14} /> Adicionar Medicamento
                      </button>
                    </div>

                    {/* Lista de Medicamentos Prescritos */}
                    {prescricoesPosOp.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-2">
                        <Pill size={24} className="text-slate-400 mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">
                          Nenhum medicamento prescrito ainda.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAddPrescricaoItem()}
                          className="text-xs font-bold text-teal-600 hover:text-teal-700 underline"
                        >
                          Clique para adicionar o primeiro medicamento
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {prescricoesPosOp.map((item, idx) => (
                          <div
                            key={item.id}
                            className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 flex items-center gap-1">
                                <Pill size={12} /> Medicamento #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePrescricaoItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Remover item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Medicamento / Princípio Ativo
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: Meloxicam 1mg, Dipirona..."
                                  value={item.medicamento}
                                  onChange={e => handlePrescricaoChange(item.id, 'medicamento', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Via de Administração
                                </label>
                                <select
                                  value={item.via}
                                  onChange={e => handlePrescricaoChange(item.id, 'via', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                  <option value="Oral">Oral</option>
                                  <option value="Tópica">Tópica</option>
                                  <option value="Subcutânea">Subcutânea</option>
                                  <option value="Intramuscular">Intramuscular</option>
                                  <option value="Oftálmica">Oftálmica</option>
                                  <option value="Otológica">Otológica</option>
                                  <option value="Outra">Outra</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Dosagem
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: 1 comprimido, 5 gotas..."
                                  value={item.dosagem}
                                  onChange={e => handlePrescricaoChange(item.id, 'dosagem', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Frequência
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: 12/12h, 1x ao dia..."
                                  value={item.frequencia}
                                  onChange={e => handlePrescricaoChange(item.id, 'frequencia', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Duração
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: 5 dias, 7 dias..."
                                  value={item.duracao}
                                  onChange={e => handlePrescricaoChange(item.id, 'duracao', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>

                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-600">
                                  Orientações / Recomendações
                                </label>
                                <input
                                  type="text"
                                  placeholder="ex: Administrar após a refeição. Manter colar elizabetano..."
                                  value={item.observacoes}
                                  onChange={e => handlePrescricaoChange(item.id, 'observacoes', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Opções de Impressão da Prescrição */}
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={imprimirPrescricaoAoConcluir}
                          onChange={e => setImprimirPrescricaoAoConcluir(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <span className="text-xs text-slate-700 font-medium">
                          Imprimir receituário pós-cirúrgico automaticamente ao concluir
                        </span>
                      </label>

                      {prescricoesPosOp.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handlePrintPrescriptionDirect(
                            selectedCirurgiaToConcluir.animal!,
                            users.find(u => u.id === conclusaoVetId) || user,
                            prescricoesPosOp.filter(p => p.medicamento.trim() !== '')
                          )}
                          className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
                        >
                          <Printer size={13} /> Visualizar / Imprimir Prévia
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé Fixo */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsConcluirModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarConclusao}
                className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <Check size={16} /> Concluir Cirurgia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO */}
      {isCancelarModalOpen && selectedCirurgiaToCancelar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <XCircle size={22} className="text-rose-200" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Cancelar Agendamento Cirúrgico</h3>
                  <p className="text-xs text-rose-100 font-medium">Paciente: {selectedCirurgiaToCancelar.animal?.nome}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCancelarModalOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Motivo / Justificativa do Cancelamento *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Paciente febril, tutor não compareceu, alteração nos exames pré-operatórios..."
                  value={motivoCancelamento}
                  onChange={e => setMotivoCancelamento(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCancelarModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarCancelamento}
                  className="px-5 py-2 bg-rose-600 text-white text-xs font-black rounded-xl shadow-md hover:bg-rose-700"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurgicalWaitlist;
