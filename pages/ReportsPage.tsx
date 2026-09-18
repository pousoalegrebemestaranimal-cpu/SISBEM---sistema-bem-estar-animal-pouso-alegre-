import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { AnimalCondicao, Especie, Porte, Sexo, AnimalJoined, ClinicalRecord, StatusLog, AgendamentoCirurgia, CirurgiaStatus } from '../types';
import { 
  FileText, Printer, Download, Calendar, Filter, Dog, Cat, Stethoscope, 
  Heart, Skull, CheckCircle2, TrendingUp, BarChart2, UserCheck, RefreshCw, 
  ShieldCheck, AlertCircle, MapPin, Building, Award, Clock, Eye, X, FileCheck, Scissors
} from 'lucide-react';
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, getWeek, parseISO, isWithinInterval, isValid 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PeriodType = 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'ANUAL' | 'PERSONALIZADO';
type TabType = 'RESUMO' | 'ANIMAIS' | 'ATENDIMENTOS' | 'CIRURGIAS' | 'DESFECHOS' | 'ACOMODACOES';
type ReportFormat = 'RESUMIDO' | 'ANALITICO';

const ReportsPage: React.FC = () => {
  const currentUser = db.getCurrentUser();
  
  // Estados para filtros de período
  const [periodType, setPeriodType] = useState<PeriodType>('MENSAL');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('RESUMIDO');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Filtros adicionais de dados
  const [filterEspecie, setFilterEspecie] = useState<string>('TODOS');
  const [filterOrigem, setFilterOrigem] = useState<string>('TODOS'); // TODOS, INTERNO, EXTERNO

  // Aba ativa na pré-visualização do relatório
  const [activeTab, setActiveTab] = useState<TabType>('RESUMO');

  // Estado para Modal de Pré-visualização de Impressão Completa
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Carregar dados gerais do DB
  const allAnimals = useMemo(() => db.getAnimalsJoined(), []);
  const allRecords = useMemo(() => db.getRecords(), []);
  const allCirurgias = useMemo(() => db.getCirurgias(), []);
  const allStatusLogs = useMemo(() => db.getStatusLogs(), []);
  const allOccupations = useMemo(() => db.getOccupations(), []);
  const allKennels = useMemo(() => db.getKennels(), []);
  const allUsers = useMemo(() => db.getUsers(), []);

  // Calcular o intervalo de datas do período selecionado
  const { dateRangeStart, dateRangeEnd, periodDescription, periodBadge } = useMemo(() => {
    let start: Date;
    let end: Date;
    let desc = '';
    let badge = '';

    const refDate = selectedDate ? parseISO(selectedDate) : new Date();
    const validRef = isValid(refDate) ? refDate : new Date();

    if (periodType === 'DIARIO') {
      start = new Date(validRef.getFullYear(), validRef.getMonth(), validRef.getDate(), 0, 0, 0, 0);
      end = new Date(validRef.getFullYear(), validRef.getMonth(), validRef.getDate(), 23, 59, 59, 999);
      desc = `Relatório Diário - ${format(start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
      badge = `Diário (${format(start, 'dd/MM/yyyy')})`;
    } else if (periodType === 'SEMANAL') {
      start = startOfWeek(validRef, { weekStartsOn: 1 });
      end = endOfWeek(validRef, { weekStartsOn: 1 });
      const weekNum = getWeek(validRef, { weekStartsOn: 1 });
      desc = `Relatório Semanal (Semana ${weekNum}) - De ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`;
      badge = `Semana ${weekNum} (${format(start, 'dd/MM')} a ${format(end, 'dd/MM')})`;
    } else if (periodType === 'MENSAL') {
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      start = startOfMonth(firstDay);
      end = endOfMonth(firstDay);
      const monthName = format(firstDay, 'MMMM', { locale: ptBR });
      desc = `Relatório Mensal - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${selectedYear}`;
      badge = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${selectedYear}`;
    } else if (periodType === 'ANUAL') {
      const firstDay = new Date(selectedYear, 0, 1);
      start = startOfYear(firstDay);
      end = endOfYear(firstDay);
      desc = `Relatório Anual - Exercício de ${selectedYear}`;
      badge = `Ano ${selectedYear}`;
    } else {
      // PERSONALIZADO
      const s = customStartDate ? parseISO(customStartDate) : new Date();
      const e = customEndDate ? parseISO(customEndDate) : new Date();
      start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
      desc = `Relatório Personalizado - De ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`;
      badge = `Personalizado (${format(start, 'dd/MM/yy')} - ${format(end, 'dd/MM/yy')})`;
    }

    return {
      dateRangeStart: start,
      dateRangeEnd: end,
      periodDescription: desc,
      periodBadge: badge
    };
  }, [periodType, selectedDate, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Filtrar Animais Cadastrados/Resgatados no período
  const filteredAnimals = useMemo(() => {
    return allAnimals.filter(animal => {
      // Data de resgate ou cadastro
      const dateStr = animal.dataResgate || animal.dataCadastro;
      if (!dateStr) return false;
      const animalDate = new Date(dateStr);
      if (!isValid(animalDate)) return false;

      const inPeriod = animalDate >= dateRangeStart && animalDate <= dateRangeEnd;
      if (!inPeriod) return false;

      // Filtro de Espécie
      if (filterEspecie !== 'TODOS' && animal.especie !== filterEspecie) return false;

      // Filtro de Origem (Interno sem tutor vs Externo com tutor)
      if (filterOrigem === 'INTERNO' && animal.temTutor) return false;
      if (filterOrigem === 'EXTERNO' && !animal.temTutor) return false;

      return true;
    });
  }, [allAnimals, dateRangeStart, dateRangeEnd, filterEspecie, filterOrigem]);

  // Animais Acolhidos / Resgatados no Centro (apenas animais sem tutor / internos)
  // Conforme diretriz institucional: acolhimento computa exclusivamente resgates e entradas de animais sem tutor sob custódia
  const acolhidosAnimals = useMemo(() => {
    return filteredAnimals.filter(animal => !animal.temTutor);
  }, [filteredAnimals]);

  // Filtrar Atendimentos Veterinários no período
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      if (rec.inativo) return false;
      const recDate = new Date(rec.dataAtendimento);
      if (!isValid(recDate)) return false;

      const inPeriod = recDate >= dateRangeStart && recDate <= dateRangeEnd;
      if (!inPeriod) return false;

      // Join com o animal para aplicar filtros de espécie/origem
      const animal = allAnimals.find(a => a.id === rec.animalId);
      if (filterEspecie !== 'TODOS' && animal?.especie !== filterEspecie) return false;
      if (filterOrigem === 'INTERNO' && animal?.temTutor) return false;
      if (filterOrigem === 'EXTERNO' && !animal?.temTutor) return false;

      return true;
    }).sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());
  }, [allRecords, allAnimals, dateRangeStart, dateRangeEnd, filterEspecie, filterOrigem]);

  // Filtrar Mudanças de Status (Desfechos: Adoções, Solturas, Óbitos) no período
  const filteredStatusLogs = useMemo(() => {
    return allStatusLogs.filter(log => {
      const logDate = new Date(log.dataAlteracao);
      if (!isValid(logDate)) return false;

      const inPeriod = logDate >= dateRangeStart && logDate <= dateRangeEnd;
      if (!inPeriod) return false;

      const animal = allAnimals.find(a => a.id === log.animalId);
      if (filterEspecie !== 'TODOS' && animal?.especie !== filterEspecie) return false;
      if (filterOrigem === 'INTERNO' && animal?.temTutor) return false;
      if (filterOrigem === 'EXTERNO' && !animal?.temTutor) return false;

      return true;
    }).sort((a, b) => new Date(b.dataAlteracao).getTime() - new Date(a.dataAlteracao).getTime());
  }, [allStatusLogs, allAnimals, dateRangeStart, dateRangeEnd, filterEspecie, filterOrigem]);

  // Filtrar Acomodações/Ocupações de Baias ocorridas no período
  const filteredOccupations = useMemo(() => {
    return allOccupations.filter(occ => {
      const entryD = new Date(occ.entryDate);
      const exitD = occ.exitDate ? new Date(occ.exitDate) : null;

      const entryInPeriod = entryD >= dateRangeStart && entryD <= dateRangeEnd;
      const exitInPeriod = exitD ? (exitD >= dateRangeStart && exitD <= dateRangeEnd) : false;

      if (!entryInPeriod && !exitInPeriod) return false;

      const animal = allAnimals.find(a => a.id === occ.animalId);
      if (filterEspecie !== 'TODOS' && animal?.especie !== filterEspecie) return false;
      if (filterOrigem === 'INTERNO' && animal?.temTutor) return false;
      if (filterOrigem === 'EXTERNO' && !animal?.temTutor) return false;

      return true;
    }).sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [allOccupations, allAnimals, dateRangeStart, dateRangeEnd, filterEspecie, filterOrigem]);

  // Filtrar Cirurgias e Agendamentos no período
  const filteredCirurgias = useMemo(() => {
    return allCirurgias.filter(cirurgia => {
      const dateStr = cirurgia.dataRealizacao || cirurgia.dataAgendada || cirurgia.dataCadastro;
      if (!dateStr) return false;
      const cDate = new Date(dateStr);
      if (!isValid(cDate)) return false;

      const inPeriod = cDate >= dateRangeStart && cDate <= dateRangeEnd;
      if (!inPeriod) return false;

      const animal = allAnimals.find(a => a.id === cirurgia.animalId);
      if (filterEspecie !== 'TODOS' && animal?.especie !== filterEspecie) return false;
      if (filterOrigem === 'INTERNO' && animal?.temTutor) return false;
      if (filterOrigem === 'EXTERNO' && !animal?.temTutor) return false;

      return true;
    }).sort((a, b) => new Date(b.dataRealizacao || b.dataAgendada).getTime() - new Date(a.dataRealizacao || a.dataAgendada).getTime());
  }, [allCirurgias, allAnimals, dateRangeStart, dateRangeEnd, filterEspecie, filterOrigem]);

  // Métricas Consolidadas do Relatório
  const metrics = useMemo(() => {
    // Acolhimento contabiliza apenas animais resgatados/entrados sem tutor (internos)
    const totalEntradas = acolhidosAnimals.length;
    const caesEntradas = acolhidosAnimals.filter(a => a.especie === Especie.CAO).length;
    const gatosEntradas = acolhidosAnimals.filter(a => a.especie === Especie.GATO).length;
    const internosEntradas = acolhidosAnimals.length;
    const externosEntradas = 0;
    const samuvetResgates = acolhidosAnimals.filter(a => a.resgateSamuvet).length;

    const totalAtendimentos = filteredRecords.length;
    const atendimentosInternos = filteredRecords.filter(r => {
      const a = allAnimals.find(an => an.id === r.animalId);
      return !a?.temTutor;
    }).length;
    const atendimentosExternos = filteredRecords.filter(r => {
      const a = allAnimals.find(an => an.id === r.animalId);
      return !!a?.temTutor;
    }).length;

    // Métricas de Cirurgias e Castrações
    const cirurgiasRealizadas = filteredCirurgias.filter(c => 
      c.status === CirurgiaStatus.REALIZADA || 
      (c.status as string) === 'Realizada' || 
      (c.status as string) === 'CONCLUIDA' || 
      (c.status as string) === 'REALIZADA'
    );
    const castracoesRealizadas = cirurgiasRealizadas.filter(c => {
      const tipo = (c.tipoCirurgia || '').toLowerCase();
      return tipo.includes('castra') || tipo.includes('osh') || tipo.includes('orquiectomia') || !c.tipoCirurgia;
    });

    const totalCastracoesRealizadas = castracoesRealizadas.length;
    const castracoesCaes = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.especie === Especie.CAO;
    }).length;
    const castracoesGatos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.especie === Especie.GATO;
    }).length;
    const castracoesInternos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return !a?.temTutor;
    }).length;
    const castracoesExternos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return !!a?.temTutor;
    }).length;

    // Desfechos do período
    const adocoesNoPeriodo = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.ADOTADO).length;
    const solturasNoPeriodo = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.SOLTURA).length;
    const obitosLogs = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.OBITO);
    const obitosNoPeriodo = obitosLogs.length;

    let obitosNaturalNoPeriodo = 0;
    let obitosEutanasiaNoPeriodo = 0;

    obitosLogs.forEach(l => {
      const a = allAnimals.find(an => an.id === l.animalId);
      const causa = (a?.causaObito || '').toLowerCase();
      if (causa.includes('eutaná') || causa.includes('eutana')) {
        obitosEutanasiaNoPeriodo++;
      } else {
        obitosNaturalNoPeriodo++;
      }
    });

    const altasNoPeriodo = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.ALTA).length;

    // Métricas por Porte dos Animais Acolhidos no período (apenas sem tutor)
    const portePequeno = acolhidosAnimals.filter(a => a.porte === Porte.PEQUENO).length;
    const porteMedio = acolhidosAnimals.filter(a => a.porte === Porte.MEDIO).length;
    const porteGrande = acolhidosAnimals.filter(a => a.porte === Porte.GRANDE).length;

    return {
      totalEntradas,
      caesEntradas,
      gatosEntradas,
      internosEntradas,
      externosEntradas,
      samuvetResgates,
      totalAtendimentos,
      atendimentosInternos,
      atendimentosExternos,
      totalCastracoesRealizadas,
      castracoesCaes,
      castracoesGatos,
      castracoesInternos,
      castracoesExternos,
      totalCirurgiasRealizadas: cirurgiasRealizadas.length,
      cirurgiasAgendadas: filteredCirurgias.filter(c => c.status === CirurgiaStatus.AGENDADA || c.status === CirurgiaStatus.EM_PREPARO).length,
      adocoesNoPeriodo,
      solturasNoPeriodo,
      obitosNoPeriodo,
      obitosNaturalNoPeriodo,
      obitosEutanasiaNoPeriodo,
      altasNoPeriodo,
      portePequeno,
      porteMedio,
      porteGrande,
      taxaSucessoSaidas: totalEntradas > 0 ? Math.round(((adocoesNoPeriodo + solturasNoPeriodo + altasNoPeriodo) / totalEntradas) * 100) : 0
    };
  }, [acolhidosAnimals, filteredRecords, filteredStatusLogs, filteredCirurgias, allAnimals]);

  // Quantitativo Consolidado de Serviços Prestados no Período
  const serviceCounts = useMemo(() => {
    // 1. Resgates e Acolhimento: computa estritamente animais acolhidos/resgatados sem tutor
    const totalResgates = acolhidosAnimals.length;
    const caesResgatados = acolhidosAnimals.filter(a => a.especie === Especie.CAO).length;
    const gatosResgatados = acolhidosAnimals.filter(a => a.especie === Especie.GATO).length;
    const outrosResgatados = acolhidosAnimals.filter(a => a.especie !== Especie.CAO && a.especie !== Especie.GATO).length;
    const samuvetResgates = acolhidosAnimals.filter(a => a.resgateSamuvet).length;
    const semTutorResgates = acolhidosAnimals.length;
    const comTutorResgates = 0;

    const portePequeno = acolhidosAnimals.filter(a => a.porte === Porte.PEQUENO).length;
    const porteMedio = acolhidosAnimals.filter(a => a.porte === Porte.MEDIO).length;
    const porteGrande = acolhidosAnimals.filter(a => a.porte === Porte.GRANDE).length;

    const totalAtendimentos = filteredRecords.length;
    const atendimentosInternos = filteredRecords.filter(r => {
      const a = allAnimals.find(an => an.id === r.animalId);
      return !a?.temTutor;
    }).length;
    const atendimentosExternos = filteredRecords.filter(r => {
      const a = allAnimals.find(an => an.id === r.animalId);
      return !!a?.temTutor;
    }).length;

    // Métricas de Cirurgias e Castrações Realizadas
    const cirurgiasRealizadas = filteredCirurgias.filter(c => 
      c.status === CirurgiaStatus.REALIZADA || 
      (c.status as string) === 'Realizada' || 
      (c.status as string) === 'CONCLUIDA' || 
      (c.status as string) === 'REALIZADA'
    );
    const castracoesRealizadas = cirurgiasRealizadas.filter(c => {
      const tipo = (c.tipoCirurgia || '').toLowerCase();
      return tipo.includes('castra') || tipo.includes('osh') || tipo.includes('orquiectomia') || !c.tipoCirurgia;
    });

    const totalCastracoesRealizadas = castracoesRealizadas.length;
    const castracoesCaes = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.especie === Especie.CAO;
    }).length;
    const castracoesGatos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.especie === Especie.GATO;
    }).length;
    const castracoesMachos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.sexo === Sexo.MACHO;
    }).length;
    const castracoesFemeas = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return a?.sexo === Sexo.FEMEA;
    }).length;
    const castracoesInternos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return !a?.temTutor;
    }).length;
    const castracoesExternos = castracoesRealizadas.filter(c => {
      const a = allAnimals.find(an => an.id === c.animalId);
      return !!a?.temTutor;
    }).length;

    const outrasCirurgiasRealizadas = cirurgiasRealizadas.length - totalCastracoesRealizadas;
    const totalCirurgiasRealizadas = cirurgiasRealizadas.length;
    const cirurgiasAgendadas = filteredCirurgias.filter(c => 
      c.status === CirurgiaStatus.AGENDADA || 
      c.status === CirurgiaStatus.EM_PREPARO || 
      (c.status as string) === 'Agendada' || 
      (c.status as string) === 'AGENDADA'
    ).length;

    // Contagem de cada suspeita/diagnóstico preenchido por atendimento (não por animal)
    const diagnosticoCounts: Record<string, number> = {
      'Tumores': 0,
      'Traumas': 0,
      'Suspeita cinomose': 0,
      'Suspeita parvovirose': 0,
      'Suspeita esporotricose': 0,
      'Suspeita envenenamento': 0,
      'Suspeita hemoparasitose': 0,
      'Miíases': 0,
      'Outro': 0,
      'Não Informado': 0
    };

    filteredRecords.forEach(r => {
      const diag = (r.diagnosticoClinico || r.diagnosticoProcedimentos || '').trim();
      if (!diag) {
        diagnosticoCounts['Não Informado']++;
        return;
      }
      const diagLower = diag.toLowerCase();

      if (diagLower.includes('tumor')) {
        diagnosticoCounts['Tumores']++;
      } else if (diagLower.includes('trauma')) {
        diagnosticoCounts['Traumas']++;
      } else if (diagLower.includes('cinomose')) {
        diagnosticoCounts['Suspeita cinomose']++;
      } else if (diagLower.includes('parvovirose')) {
        diagnosticoCounts['Suspeita parvovirose']++;
      } else if (diagLower.includes('esporotricose')) {
        diagnosticoCounts['Suspeita esporotricose']++;
      } else if (diagLower.includes('envenenamento')) {
        diagnosticoCounts['Suspeita envenenamento']++;
      } else if (diagLower.includes('hemoparasitose')) {
        diagnosticoCounts['Suspeita hemoparasitose']++;
      } else if (diagLower.includes('miíase') || diagLower.includes('miiase') || diagLower.includes('miíases') || diagLower.includes('miiases')) {
        diagnosticoCounts['Miíases']++;
      } else {
        diagnosticoCounts['Outro']++;
      }
    });

    const adocoes = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.ADOTADO).length;
    const solturas = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.SOLTURA).length;
    const altas = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.ALTA).length;
    const obitosLogs = filteredStatusLogs.filter(l => l.statusNovo === AnimalCondicao.OBITO);
    const obitos = obitosLogs.length;

    let obitosNatural = 0;
    let obitosEutanasia = 0;

    obitosLogs.forEach(l => {
      const a = allAnimals.find(an => an.id === l.animalId);
      const causa = (a?.causaObito || '').toLowerCase();
      if (causa.includes('eutaná') || causa.includes('eutana')) {
        obitosEutanasia++;
      } else {
        obitosNatural++;
      }
    });

    const totalDesfechos = adocoes + solturas + altas + obitos;

    const totalAcomodacoes = filteredOccupations.length;
    const acomodacoesLiberadas = filteredOccupations.filter(o => o.exitDate).length;
    const acomodacoesAtivas = filteredOccupations.filter(o => !o.exitDate).length;

    return {
      totalResgates,
      caesResgatados,
      gatosResgatados,
      outrosResgatados,
      samuvetResgates,
      semTutorResgates,
      comTutorResgates,
      portePequeno,
      porteMedio,
      porteGrande,
      totalAtendimentos,
      atendimentosInternos,
      atendimentosExternos,
      totalCastracoesRealizadas,
      castracoesCaes,
      castracoesGatos,
      castracoesMachos,
      castracoesFemeas,
      castracoesInternos,
      castracoesExternos,
      outrasCirurgiasRealizadas,
      totalCirurgiasRealizadas,
      cirurgiasAgendadas,
      diagnosticoCounts,
      adocoes,
      solturas,
      altas,
      obitos,
      obitosNatural,
      obitosEutanasia,
      totalDesfechos,
      totalAcomodacoes,
      acomodacoesLiberadas,
      acomodacoesAtivas
    };
  }, [acolhidosAnimals, filteredRecords, filteredStatusLogs, filteredOccupations, filteredCirurgias, allAnimals]);

  // Gerar HTML limpo para janela de impressão popup
  const getPrintHTML = () => {
    const currentDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const isResumido = reportFormat === 'RESUMIDO';

    const animalsRows = acolhidosAnimals.map(a => `
      <tr>
        <td><strong>${a.nome}</strong> ${a.resgateSamuvet ? '<span style="background:#fef3c7;color:#92400e;padding:1px 4px;font-size:9px;border-radius:2px;">SAMUVET</span>' : ''}<br><span style="color:#64748b;font-size:10px;">${a.raca || 'SRD'}</span></td>
        <td>${a.especie} • ${a.porte} • ${a.sexo}</td>
        <td>${a.temTutor ? 'Com Tutor (Externo)' : 'Sem Tutor (Interno)'}</td>
        <td>${a.dataResgate ? format(new Date(a.dataResgate), 'dd/MM/yyyy') : '-'}</td>
        <td>${a.solicitante?.nomeCompleto || 'Direto'}</td>
        <td><strong>${a.condicao}</strong></td>
      </tr>
    `).join('');

    const recordsRows = filteredRecords.map(r => {
      const animal = allAnimals.find(a => a.id === r.animalId);
      return `
        <tr>
          <td>${format(new Date(r.dataAtendimento), 'dd/MM/yyyy HH:mm')}</td>
          <td><strong>${animal?.nome || 'Desconhecido'}</strong></td>
          <td>${r.procedimentoOuAnamnese || '-'}</td>
          <td>${r.diagnosticoClinico || r.diagnosticoProcedimentos || '-'}</td>
          <td><strong>${r.recommendedCondicao || '-'}</strong></td>
        </tr>
      `;
    }).join('');

    const logsRows = filteredStatusLogs.map(l => {
      const animal = allAnimals.find(a => a.id === l.animalId);
      const user = allUsers.find(u => u.id === l.usuarioId);
      return `
        <tr>
          <td>${format(new Date(l.dataAlteracao), 'dd/MM/yyyy HH:mm')}</td>
          <td><strong>${animal?.nome || 'Desconhecido'}</strong></td>
          <td>${l.statusAnterior || 'Início'}</td>
          <td><strong>${l.statusNovo}</strong></td>
          <td>${user?.name || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    const occRows = filteredOccupations.map(o => {
      const animal = allAnimals.find(a => a.id === o.animalId);
      const kennel = allKennels.find(k => k.id === o.kennelId);
      return `
        <tr>
          <td><strong>${kennel?.name || o.kennelId}</strong></td>
          <td>${animal?.nome || 'Desconhecido'}</td>
          <td>${format(new Date(o.entryDate), 'dd/MM/yyyy HH:mm')}</td>
          <td>${o.exitDate ? format(new Date(o.exitDate), 'dd/MM/yyyy HH:mm') : 'Ocupado Atualmente'}</td>
          <td>${o.justification || '-'}</td>
        </tr>
      `;
    }).join('');

    const cirurgiasRows = filteredCirurgias.map(c => {
      const animal = allAnimals.find(a => a.id === c.animalId);
      const dataStr = c.dataRealizacao || c.dataAgendada;
      return `
        <tr>
          <td>${dataStr ? format(new Date(dataStr), 'dd/MM/yyyy') : '-'} ${c.horario ? '(' + c.horario + ')' : ''}</td>
          <td><strong>${animal?.nome || 'Desconhecido'}</strong><br><span style="color:#64748b;font-size:10px;">${animal?.especie || '-'} • ${animal?.sexo || '-'} • ${animal?.temTutor ? 'Com Tutor' : 'Interno'}</span></td>
          <td><strong>${c.tipoCirurgia || 'Castração'}</strong></td>
          <td>${c.veterinarioNome || c.cirurgiaoResponsavel || '-'}</td>
          <td><strong>${c.status}</strong></td>
          <td>${c.observacoes || c.condicoesPosOperatorio || '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório SISBEM (${isResumido ? 'Resumido Quantitativo' : 'Analítico'}) - ${periodBadge}</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; margin: 0; background: #ffffff; font-size: 13.5px; }
          .no-print { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; color: #0f172a; tracking: -0.02em; }
          .subtitle { font-size: 15.5px; font-weight: 800; color: #0f766e; margin: 3px 0; }
          .meta { font-size: 13px; color: #64748b; font-weight: 500; }
          .badge-box { text-align: right; border-left: 2px solid #cbd5e1; padding-left: 16px; }
          .period-info { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; display: flex; justify-content: space-between; font-weight: 600; }
          .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 24px; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa; }
          .card-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; }
          .card-value { font-size: 24px; font-weight: 900; color: #0f172a; margin: 2px 0; }
          .card-sub { font-size: 11.5px; color: #475569; font-weight: 600; }
          h3 { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 24px; margin-bottom: 10px; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 13px; }
          th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; color: #334155; font-size: 12.5px; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .signatures { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 13px; page-break-inside: avoid; }
          .line { border-top: 1px solid #0f172a; margin-bottom: 6px; width: 80%; margin-left: auto; margin-right: auto; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; font-size: 13.5px; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <span style="font-weight:bold;font-size:14px;color:#334155;">📄 Documento Oficial Gerado - Relatório ${isResumido ? 'Resumido de Serviços' : 'Analítico'}</span>
          <div>
            <button onclick="window.print()" style="background:#0f766e;color:white;border:none;padding:9px 18px;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer;margin-right:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">🖨️ Imprimir / Salvar em PDF</button>
            <button onclick="window.close()" style="background:#e2e8f0;color:#0f172a;border:none;padding:9px 16px;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer;">Fechar</button>
          </div>
        </div>

        <div class="header">
          <div>
            <h1 class="title">PREFEITURA MUNICIPAL DE POUSO ALEGRE</h1>
            <div class="subtitle">SUPERINTENDÊNCIA DE BEM-ESTAR ANIMAL - SISBEM</div>
            <div class="meta">Sistema Integrado de Gestão e Prontuários Veterinários</div>
          </div>
          <div class="badge-box">
            <div style="font-size:12.5px;font-weight:bold;color:#0f766e;text-transform:uppercase;">${isResumido ? 'RELATÓRIO RESUMIDO (QUANTIDADES)' : 'RELATÓRIO ANALÍTICO COMPLETO'}</div>
            <div style="font-size:16px;font-weight:900;color:#0f172a;">${periodBadge}</div>
            <div style="font-size:12px;color:#64748b;">Emissão: ${currentDate}</div>
          </div>
        </div>

        <div class="period-info">
          <span><strong>Período Analisado:</strong> ${periodDescription}</span>
          <span><strong>Modelo:</strong> ${isResumido ? 'Sintético (Quantidades de Serviços)' : 'Analítico (Discriminado)'}</span>
          <span><strong>Emitido por:</strong> ${currentUser?.name || 'Administrador'}</span>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-title">Acolhimentos</div>
            <div class="card-value">${metrics.totalEntradas}</div>
            <div class="card-sub">🐕 ${metrics.caesEntradas} Cães • 🐈 ${metrics.gatosEntradas} Gatos</div>
          </div>
          <div class="card" style="background:#fdf2f8;border-color:#fbcfe8;">
            <div class="card-title" style="color:#9d174d;">Castrações Realizadas</div>
            <div class="card-value" style="color:#831843;">${metrics.totalCastracoesRealizadas}</div>
            <div class="card-sub" style="color:#9d174d;">🏠 ${metrics.castracoesInternos} Internos • 👤 ${metrics.castracoesExternos} Externos</div>
          </div>
          <div class="card">
            <div class="card-title">Atendimentos Vet</div>
            <div class="card-value">${metrics.totalAtendimentos}</div>
            <div class="card-sub">🏠 ${metrics.atendimentosInternos} Internos • 👤 ${metrics.atendimentosExternos} Externos</div>
          </div>
          <div class="card">
            <div class="card-title">Adoções e Saídas</div>
            <div class="card-value">${metrics.adocoesNoPeriodo + metrics.solturasNoPeriodo}</div>
            <div class="card-sub">❤️ ${metrics.adocoesNoPeriodo} Adoções • 🌿 ${metrics.solturasNoPeriodo} Solturas</div>
          </div>
          <div class="card">
            <div class="card-title">Óbitos Registrados</div>
            <div class="card-value">${metrics.obitosNoPeriodo}</div>
            <div class="card-sub">${metrics.totalEntradas > 0 ? Math.round((metrics.obitosNoPeriodo / metrics.totalEntradas) * 100) : 0}% das entradas</div>
          </div>
        </div>

        <h3>Quadro Sintético - Quantitativo Consolidado de Serviços</h3>
        <table>
          <thead>
            <tr>
              <th>Categoria de Serviço / Indicador Operacional</th>
              <th class="text-right">Quantidade Prestada</th>
              <th class="text-right">Proporção / Detalhe</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#f8fafc;"><td colspan="3"><strong>1. Serviço de Resgate e Acolhimento Animal</strong></td></tr>
            <tr>
              <td>Total de Animais Resgatados / Acolhidos</td>
              <td class="text-right font-bold">${serviceCounts.totalResgates}</td>
              <td class="text-right font-bold">100%</td>
            </tr>
            <tr>
              <td>↳ Espécie Canina (Cães)</td>
              <td class="text-right font-bold">${serviceCounts.caesResgatados}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.caesResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
            </tr>
            <tr>
              <td>↳ Espécie Felina (Gatos)</td>
              <td class="text-right font-bold">${serviceCounts.gatosResgatados}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.gatosResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
            </tr>
            <tr>
              <td>↳ Outras Espécies</td>
              <td class="text-right font-bold">${serviceCounts.outrosResgatados}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.outrosResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
            </tr>
            <tr>
              <td>↳ Resgates Realizados pela Equipe SAMUVET</td>
              <td class="text-right font-bold">${serviceCounts.samuvetResgates}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.samuvetResgates/serviceCounts.totalResgates)*100) : 0}% dos resgates</td>
            </tr>
            <tr>
              <td>↳ Porte Pequeno / Porte Médio / Porte Grande</td>
              <td class="text-right font-bold">${serviceCounts.portePequeno} / ${serviceCounts.porteMedio} / ${serviceCounts.porteGrande}</td>
              <td class="text-right">Acolhidos no período</td>
            </tr>

            <tr style="background:#fdf2f8;"><td colspan="3"><strong style="color:#831843;">2. Programa de Esterilização Cirúrgica e Castrações</strong></td></tr>
            <tr>
              <td><strong style="color:#831843;">Total de Castrações Realizadas no Período</strong></td>
              <td class="text-right font-bold" style="color:#831843;font-size:14px;">${serviceCounts.totalCastracoesRealizadas}</td>
              <td class="text-right font-bold" style="color:#831843;">100% das castrações</td>
            </tr>
            <tr>
              <td style="padding-left:20px;">↳ Castrações de Animais Internos (Sem Tutor)</td>
              <td class="text-right font-bold">${serviceCounts.castracoesInternos}</td>
              <td class="text-right">${serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesInternos / serviceCounts.totalCastracoesRealizadas) * 100) : 0}%</td>
            </tr>
            <tr>
              <td style="padding-left:20px;">↳ Castrações de Animais Externos (Com Tutor)</td>
              <td class="text-right font-bold">${serviceCounts.castracoesExternos}</td>
              <td class="text-right">${serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesExternos / serviceCounts.totalCastracoesRealizadas) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>Outras Cirurgias Realizadas</td>
              <td class="text-right font-bold">${serviceCounts.outrasCirurgiasRealizadas}</td>
              <td class="text-right">Procedimentos Gerais</td>
            </tr>
            <tr>
              <td><strong>Total Geral de Procedimentos Cirúrgicos Realizados</strong></td>
              <td class="text-right font-bold">${serviceCounts.totalCirurgiasRealizadas}</td>
              <td class="text-right font-bold">100% das cirurgias</td>
            </tr>

            <tr style="background:#f8fafc;"><td colspan="3"><strong>3. Serviços Clínicos Veterinários</strong></td></tr>
            <tr>
              <td>Total de Atendimentos Veterinários Realizados</td>
              <td class="text-right font-bold">${serviceCounts.totalAtendimentos}</td>
              <td class="text-right font-bold">100% dos atendimentos</td>
            </tr>
            <tr>
              <td>↳ Atendimentos a Animais Internos (Sem Tutor / Centro de Controle)</td>
              <td class="text-right font-bold">${serviceCounts.atendimentosInternos}</td>
              <td class="text-right">${serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosInternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
            </tr>
            <tr>
              <td>↳ Atendimentos a Animais Externos (Com Tutor / Particular)</td>
              <td class="text-right font-bold">${serviceCounts.atendimentosExternos}</td>
              <td class="text-right">${serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosExternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
            </tr>
            <tr style="background:#f1f5f9;"><td colspan="3"><em>Quantitativo por Resumo de Diagnóstico / Suspeita Preenchida (Contagem por Atendimento)</em></td></tr>
            ${Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, count]: [string, number]) => `
              <tr>
                <td style="padding-left:20px;">↳ ${diagName}</td>
                <td class="text-right font-bold">${count}</td>
                <td class="text-right">${serviceCounts.totalAtendimentos > 0 ? Math.round((Number(count) / serviceCounts.totalAtendimentos) * 100) : 0}%</td>
              </tr>
            `).join('')}

            <tr style="background:#f8fafc;"><td colspan="3"><strong>4. Destinação e Desfechos Operacionais</strong></td></tr>
            <tr>
              <td>Adoções Responsáveis Concluídas</td>
              <td class="text-right font-bold">${serviceCounts.adocoes}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.adocoes/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
            </tr>
            <tr>
              <td>Solturas e Devoluções Executadas</td>
              <td class="text-right font-bold">${serviceCounts.solturas}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.solturas/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
            </tr>
            <tr>
              <td>Altas Médicas Veterinárias Concedidas</td>
              <td class="text-right font-bold">${serviceCounts.altas}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.altas/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
            </tr>
            <tr>
              <td>Total de Óbitos Registrados no Período</td>
              <td class="text-right font-bold">${serviceCounts.obitos}</td>
              <td class="text-right">${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.obitos/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
            </tr>
            <tr>
              <td style="padding-left:20px;">↳ Óbitos Naturais</td>
              <td class="text-right font-bold">${serviceCounts.obitosNatural}</td>
              <td class="text-right">${serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosNatural/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
            </tr>
            <tr>
              <td style="padding-left:20px;">↳ Eutanásias / Óbitos Induzidos</td>
              <td class="text-right font-bold">${serviceCounts.obitosEutanasia}</td>
              <td class="text-right">${serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosEutanasia/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
            </tr>

            ${!isResumido ? `
            <tr style="background:#f8fafc;"><td colspan="3"><strong>5. Gestão de Acomodações e Manejo de Baias</strong></td></tr>
            <tr>
              <td>Total de Alocações / Movimentações em Baias</td>
              <td class="text-right font-bold">${serviceCounts.totalAcomodacoes}</td>
              <td class="text-right">Registros de Manejo</td>
            </tr>
            <tr>
              <td>↳ Baias Atualmente Ocupadas</td>
              <td class="text-right font-bold">${serviceCounts.acomodacoesAtivas}</td>
              <td class="text-right">Ativas no Centro</td>
            </tr>
            <tr>
              <td>↳ Liberações / Desocupações Efetuadas</td>
              <td class="text-right font-bold">${serviceCounts.acomodacoesLiberadas}</td>
              <td class="text-right">Concluídas</td>
            </tr>
            ` : ''}
          </tbody>
        </table>

        ${!isResumido ? `
          <h3>1. Listagem Discriminada de Animais Acolhidos (${acolhidosAnimals.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Animal</th>
                <th>Espécie / Porte</th>
                <th>Origem</th>
                <th>Data Resgate</th>
                <th>Solicitante</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${animalsRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Nenhum registro no período.</td></tr>'}
            </tbody>
          </table>

          <h3>2. Cirurgias e Castrações (${filteredCirurgias.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Animal</th>
                <th>Procedimento Cirúrgico</th>
                <th>Cirurgião Veterinário</th>
                <th>Status</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              ${cirurgiasRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Nenhum registro cirúrgico no período.</td></tr>'}
            </tbody>
          </table>

          <h3>3. Atendimentos Veterinários (${filteredRecords.length})</h3>
          
          <div style="margin-bottom:12px;background:#f8fafc;padding:10px;border:1px solid #cbd5e1;border-radius:6px;">
            <div style="font-size:11px;font-weight:bold;color:#0f172a;margin-bottom:6px;">Quantitativo por Resumo do Diagnóstico / Suspeita Preenchida (Total de ${filteredRecords.length} atendimentos):</div>
            <table style="width:100%;font-size:10px;border-collapse:collapse;background:#ffffff;">
              <thead>
                <tr style="background:#e2e8f0;text-align:left;">
                  <th style="padding:4px 6px;border:1px solid #cbd5e1;">Suspeita / Diagnóstico</th>
                  <th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:right;">Qtd. Atendimentos</th>
                  <th style="padding:4px 6px;border:1px solid #cbd5e1;text-align:right;">% do Total</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, cnt]: [string, number]) => `
                  <tr>
                    <td style="padding:4px 6px;border:1px solid #e2e8f0;"><strong>${diagName}</strong></td>
                    <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;">${cnt}</td>
                    <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;">${serviceCounts.totalAtendimentos > 0 ? Math.round((Number(cnt) / serviceCounts.totalAtendimentos) * 100) : 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Animal</th>
                <th>Anamnese / Queixa</th>
                <th>Diagnóstico / Procedimento</th>
                <th>Status Recomendado</th>
              </tr>
            </thead>
            <tbody>
              ${recordsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhum atendimento no período.</td></tr>'}
            </tbody>
          </table>

          <h3>4. Histórico de Saídas e Desfechos (${filteredStatusLogs.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Animal</th>
                <th>Status Anterior</th>
                <th>Novo Status</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              ${logsRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhuma saída no período.</td></tr>'}
            </tbody>
          </table>

          <h3>5. Ocupação de Baias (${filteredOccupations.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Baia / Acomodação</th>
                <th>Animal</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              ${occRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Nenhuma movimentação de baia.</td></tr>'}
            </tbody>
          </table>
        ` : ''}

        <div class="signatures">
          <div>
            <div class="line"></div>
            <strong>Médico Veterinário Responsável</strong><br>
            <span style="font-size:11.5px;color:#64748b;">CRMV / Registro Técnico</span>
          </div>
          <div>
            <div class="line"></div>
            <strong>Coordenador do Centro de Bem-Estar Animal</strong><br>
            <span style="font-size:11.5px;color:#64748b;">Superintendência do SISBEM</span>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Função para acionar a impressão oficial
  const handlePrint = () => {
    // 1. Assegurar foco na janela ativa
    window.focus();

    // 2. Tentar abrir janela popup isolada para impressão limpa
    try {
      const printWindow = window.open('', '_blank', 'width=1000,height=850');
      if (printWindow) {
        printWindow.document.write(getPrintHTML());
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Incapaz de abrir pop-up de impressão, exibindo modal no app:', e);
    }

    // 3. Caso pop-ups sejam bloqueados pelo navegador, ativa a modal de pré-visualização de impressão
    setShowPrintModal(true);
  };

  // Executar impressão direta do navegador
  const handleDirectPrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Função para exportar dados em formato CSV
  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    let csvContent = '';
    const isResumido = reportFormat === 'RESUMIDO';

    // Cabeçalho do CSV
    csvContent += `RELATÓRIO TÉCNICO SISBEM - BEM-ESTAR ANIMAL (${isResumido ? 'RESUMIDO QUANTITATIVO' : 'ANALÍTICO COMPLETO'})\n`;
    csvContent += `PERÍODO,${periodDescription}\n`;
    csvContent += `GERADO EM,${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
    csvContent += `RESPONSÁVEL,${currentUser?.name || 'Sistema SISBEM'}\n\n`;

    // Resumo de Indicadores e Quantidades de Serviços
    csvContent += `QUANTITATIVO DE SERVIÇOS PRESTADOS NO PERÍODO\n`;
    csvContent += `Serviço / Indicador Operacional,Quantidade Prestada,Proporção / Detalhes\n`;
    csvContent += `Total de Resgates e Acolhimentos,${serviceCounts.totalResgates},100%\n`;
    csvContent += `Resgates de Cães (Canina),${serviceCounts.caesResgatados},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.caesResgatados/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Resgates de Gatos (Felina),${serviceCounts.gatosResgatados},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.gatosResgatados/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Resgates Outras Espécies,${serviceCounts.outrosResgatados},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.outrosResgatados/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Resgates Efetuados via SAMUVET,${serviceCounts.samuvetResgates},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.samuvetResgates/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Animais Porte Pequeno / Médio / Grande,${serviceCounts.portePequeno} / ${serviceCounts.porteMedio} / ${serviceCounts.porteGrande},Distribuídos\n`;
    csvContent += `Total de Castrações Realizadas no Período,${serviceCounts.totalCastracoesRealizadas},100% das castrações\n`;
    csvContent += `Castrações em Animais Internos (Sem Tutor),${serviceCounts.castracoesInternos},${serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesInternos/serviceCounts.totalCastracoesRealizadas)*100) : 0}%\n`;
    csvContent += `Castrações em Animais Externos (Com Tutor),${serviceCounts.castracoesExternos},${serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesExternos/serviceCounts.totalCastracoesRealizadas)*100) : 0}%\n`;
    csvContent += `Outras Cirurgias Realizadas,${serviceCounts.outrasCirurgiasRealizadas},-\n`;
    csvContent += `Total de Procedimentos Cirúrgicos Realizados,${serviceCounts.totalCirurgiasRealizadas},100%\n`;
    csvContent += `Total de Atendimentos Veterinários,${serviceCounts.totalAtendimentos},100%\n`;
    csvContent += `Atendimentos a Animais Internos,${serviceCounts.atendimentosInternos},${serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosInternos/serviceCounts.totalAtendimentos)*100) : 0}%\n`;
    csvContent += `Atendimentos a Animais Externos,${serviceCounts.atendimentosExternos},${serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosExternos/serviceCounts.totalAtendimentos)*100) : 0}%\n`;
    csvContent += `Adoções Concluídas,${serviceCounts.adocoes},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.adocoes/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Solturas e Devoluções Executadas,${serviceCounts.solturas},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.solturas/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Altas Médicas Concedidas,${serviceCounts.altas},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.altas/serviceCounts.totalResgates)*100) : 0}%\n`;
    csvContent += `Óbitos Registrados,${serviceCounts.obitos},${serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.obitos/serviceCounts.totalResgates)*100) : 0}%\n`;

    if (!isResumido) {
      csvContent += `Total de Alocações / Movimentações de Baias,${serviceCounts.totalAcomodacoes},-\n`;
      csvContent += `Acomodações Ativas Atualmente,${serviceCounts.acomodacoesAtivas},-\n\n`;
    } else {
      csvContent += `\n`;
    }

    if (!isResumido) {
      // Tabela detalhada de Animais do Período
      csvContent += `LISTA DE ANIMAIS ACOLHIDOS NO PERÍODO\n`;
      csvContent += `ID,Nome,Espécie,Raça,Porte,Sexo,Origem,Data Resgate,Condição Atual,Local Resgate\n`;
      
      acolhidosAnimals.forEach(a => {
        const origemStr = a.temTutor ? 'Com Tutor (Externo)' : 'Sem Tutor (Interno)';
        const dataStr = a.dataResgate ? format(new Date(a.dataResgate), 'dd/MM/yyyy') : '';
        csvContent += `"${a.id}","${a.nome}","${a.especie}","${a.raca || ''}","${a.porte}","${a.sexo}","${origemStr}","${dataStr}","${a.condicao}","${(a.localResgate || '').replace(/"/g, '""')}"\n`;
      });

      // Tabela detalhada de Cirurgias do Período
      csvContent += `\nLISTA DE CIRURGIAS E CASTRAÇÕES NO PERÍODO\n`;
      csvContent += `ID,Data,Horário,Animal,Espécie,Sexo,Origem,Procedimento,Cirurgião,Status,Observações\n`;
      filteredCirurgias.forEach(c => {
        const a = allAnimals.find(an => an.id === c.animalId);
        const dataStr = c.dataRealizacao || c.dataAgendada ? format(new Date(c.dataRealizacao || c.dataAgendada), 'dd/MM/yyyy') : '';
        const origemStr = a?.temTutor ? 'Com Tutor (Externo)' : 'Sem Tutor (Interno)';
        csvContent += `"${c.id}","${dataStr}","${c.horario || ''}","${a?.nome || ''}","${a?.especie || ''}","${a?.sexo || ''}","${origemStr}","${c.tipoCirurgia || 'Castração'}","${c.veterinarioNome || c.cirurgiaoResponsavel || ''}","${c.status}","${(c.observacoes || '').replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SISBEM-Relatorio-${reportFormat}-${periodType}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-16">
      
      {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO (Mostrado apenas ao imprimir via @media print) */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6 print-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">PREFEITURA MUNICIPAL DE POUSO ALEGRE</h1>
            <h2 className="text-lg font-bold text-teal-800">SUPERINTENDÊNCIA DE BEM-ESTAR ANIMAL - SISBEM</h2>
            <p className="text-sm text-slate-600 font-medium">Sistema Integrado de Gestão e Prontuários Veterinários</p>
          </div>
          <div className="text-right border-l-2 border-slate-300 pl-4">
            <div className="text-xs font-bold text-slate-500 uppercase">Documento Oficial</div>
            <div className="text-base font-black text-slate-900">{periodBadge}</div>
            <div className="text-xs text-slate-600">Emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
          </div>
        </div>
        <div className="mt-4 bg-slate-100 p-3 rounded-lg border border-slate-300 flex justify-between items-center text-sm font-semibold">
          <span><strong>Período Analisado:</strong> {periodDescription}</span>
          <span><strong>Emitido por:</strong> {currentUser?.name || 'Administrador'}</span>
        </div>
      </div>

      {/* CABEÇALHO DA TELA DE GERENCIAMENTO (Oculto na impressão) */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Emissão de Relatórios Gerenciais</h2>
              <p className="text-sm text-slate-500">Gere e imprima relatórios operacionais diários, semanais, mensais e anuais.</p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 transition-all text-sm shadow-sm"
            title="Pré-visualizar documento oficial completo antes de imprimir"
          >
            <Eye size={18} /> Pré-visualizar
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 transition-all text-sm shadow-sm"
            title="Exportar planilha completa em CSV / Excel"
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl shadow-md transition-all text-sm"
          >
            <Printer size={18} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* PAINEL DE FILTROS DE PERÍODO E FREQUÊNCIA (Oculto na impressão) */}
      <div className="no-print bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        
        {/* 1. Seleção do Tipo de Frequência */}
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-3">1. Selecione a Frequência do Relatório</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'DIARIO', label: 'Diário', desc: 'Dia específico' },
              { id: 'SEMANAL', label: 'Semanal', desc: 'Semana completa' },
              { id: 'MENSAL', label: 'Mensal', desc: 'Mês/Ano completo' },
              { id: 'ANUAL', label: 'Anual', desc: 'Ano de exercício' },
              { id: 'PERSONALIZADO', label: 'Personalizado', desc: 'Intervalo customizado' },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setPeriodType(type.id as PeriodType)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  periodType === type.id
                    ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500 text-teal-900 font-extrabold shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-sm font-bold flex items-center justify-between">
                  {type.label}
                  {periodType === type.id && <CheckCircle2 size={16} className="text-teal-600 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Seleção do Modelo do Relatório (Resumido vs Analítico) */}
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-3">2. Selecione o Modelo do Relatório</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setReportFormat('RESUMIDO')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                reportFormat === 'RESUMIDO'
                  ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500 text-teal-900 shadow-sm'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="space-y-1 pr-3">
                <div className="text-sm font-extrabold flex items-center gap-2">
                  <BarChart2 size={18} className="text-teal-600 shrink-0" />
                  Relatório Resumido (Quantidades de Serviços)
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Sintético: apresenta apenas os totais consolidados e contagens numéricas de acolhimentos, consultas, procedimentos, cirurgias e desfechos. Ideal para balanços executivos.
                </p>
              </div>
              {reportFormat === 'RESUMIDO' && <CheckCircle2 size={18} className="text-teal-600 shrink-0 mt-0.5" />}
            </button>

            <button
              onClick={() => setReportFormat('ANALITICO')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                reportFormat === 'ANALITICO'
                  ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500 text-teal-900 shadow-sm'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="space-y-1 pr-3">
                <div className="text-sm font-extrabold flex items-center gap-2">
                  <FileText size={18} className="text-teal-600 shrink-0" />
                  Relatório Analítico (Detalhado com Tabelas)
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Completo: inclui o quadro sintético de quantidades mais a listagem nominal discriminada de animais resgatados, atendimentos médicos e movimentação de baias.
                </p>
              </div>
              {reportFormat === 'ANALITICO' && <CheckCircle2 size={18} className="text-teal-600 shrink-0 mt-0.5" />}
            </button>
          </div>
        </div>

        {/* Parâmetros do Período Selecionado */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          
          {/* Opções conforme o Período Escolhido */}
          {periodType === 'DIARIO' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Data do Relatório *</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
          )}

          {periodType === 'SEMANAL' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Selecione um Dia da Semana *</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              />
            </div>
          )}

          {periodType === 'MENSAL' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Mês Referência *</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                >
                  {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Ano *</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                >
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {periodType === 'ANUAL' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Ano de Exercício *</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'PERSONALIZADO' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Data Inicial *</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Data Final *</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                />
              </div>
            </>
          )}

          {/* Filtros Secundários: Espécie e Origem */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">Filtrar por Espécie</label>
            <select
              value={filterEspecie}
              onChange={e => setFilterEspecie(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
            >
              <option value="TODOS">Todas as Espécies</option>
              <option value={Especie.CAO}>Cães (Canina)</option>
              <option value={Especie.GATO}>Gatos (Felina)</option>
              <option value={Especie.OUTRO}>Outros</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">Filtrar por Origem</label>
            <select
              value={filterOrigem}
              onChange={e => setFilterOrigem(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
            >
              <option value="TODOS">Todas as Origens</option>
              <option value="INTERNO">Internos (Sem Tutor / Centro)</option>
              <option value="EXTERNO">Externos (Com Tutor / Particular)</option>
            </select>
          </div>
        </div>

        {/* Resumo visual do Período Ativo */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-teal-50 border border-teal-200 text-teal-900 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-teal-600 shrink-0" />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-teal-700">Período Configurado: </span>
              <span className="text-sm font-bold">{periodDescription}</span>
            </div>
          </div>
          <div className="text-xs font-extrabold px-3 py-1 bg-teal-600 text-white rounded-lg shadow-sm">
            {reportFormat === 'RESUMIDO' ? '📊 Modelo Resumido (Somente Quantidades)' : '📋 Modelo Analítico (Discriminado)'}
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO DE INDICADORES (Impresso e em tela) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 print:grid-cols-5">
        
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm print-card space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Acolhimentos</span>
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg no-print"><Dog size={18} /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalEntradas}</div>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>🐕 {metrics.caesEntradas} cães</span> • <span>🐈 {metrics.gatosEntradas} gatos</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-200 shadow-sm print-card space-y-2 bg-gradient-to-br from-white to-pink-50/40">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-pink-700 uppercase tracking-wider">Castrações Realizadas</span>
            <div className="p-2 bg-pink-100 text-pink-800 rounded-lg no-print"><Scissors size={18} /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-pink-950">{metrics.totalCastracoesRealizadas}</div>
          <div className="text-[11px] font-semibold text-pink-800 flex items-center gap-1.5 flex-wrap">
            <span>🏠 {metrics.castracoesInternos} internos</span> • <span>👤 {metrics.castracoesExternos} externos</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm print-card space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Atendimentos Vet</span>
            <div className="p-2 bg-blue-100 text-blue-800 rounded-lg no-print"><Stethoscope size={18} /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.totalAtendimentos}</div>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>🏠 {metrics.atendimentosInternos} internos</span> • <span>👤 {metrics.atendimentosExternos} ext.</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm print-card space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Adoções e Saídas</span>
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg no-print"><Heart size={18} /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.adocoesNoPeriodo + metrics.solturasNoPeriodo}</div>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>❤️ {metrics.adocoesNoPeriodo} adota.</span> • <span>🌿 {metrics.solturasNoPeriodo} solturas</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm print-card space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Óbitos Totais</span>
            <div className="p-2 bg-slate-200 text-slate-800 rounded-lg no-print"><Skull size={18} /></div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.obitosNoPeriodo}</div>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>🌿 {metrics.obitosNaturalNoPeriodo} Nat.</span> • <span>✝️ {metrics.obitosEutanasiaNoPeriodo} Eut.</span>
          </div>
        </div>

      </div>

      {/* SELETOR DE ABAS PARA NAVEGAÇÃO ANALÍTICA (Oculto na Impressão e quando formato é Resumido) */}
      {reportFormat === 'ANALITICO' && (
        <div className="no-print border-b border-slate-200 flex flex-wrap gap-2">
          {[
            { id: 'RESUMO', label: 'Estatísticas Gerais', count: null },
            { id: 'ANIMAIS', label: 'Animais Acolhidos', count: acolhidosAnimals.length },
            { id: 'CIRURGIAS', label: 'Cirurgias e Castrações', count: filteredCirurgias.length },
            { id: 'ATENDIMENTOS', label: 'Atendimentos Médicos', count: filteredRecords.length },
            { id: 'DESFECHOS', label: 'Histórico de Saídas', count: filteredStatusLogs.length },
            { id: 'ACOMODACOES', label: 'Acomodações e Baias', count: filteredOccupations.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700 bg-teal-50/40 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* PAINEL PRINCIPAL DE EXIBIÇÃO DO RELATÓRIO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print-card">
        
        {/* VISUALIZAÇÃO DO RELATÓRIO RESUMIDO (QUANTIDADES DE SERVIÇOS) */}
        {reportFormat === 'RESUMIDO' && (
          <div className="p-6 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart2 className="text-teal-600" size={22} />
                  Relatório Resumido - Quantitativo Consolidado de Serviços
                </h3>
                <p className="text-xs text-slate-500 mt-1">Totalização de atendimentos, procedimentos, cirurgias e acolhimentos prestados no período.</p>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg">
                Sintético Executivo
              </span>
            </div>

            {/* Quadro Sintético de Quantidades */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-900 text-white px-4 py-3 font-bold text-xs uppercase tracking-wider flex justify-between items-center">
                <span>Indicadores e Quantidades de Serviços Prestados</span>
                <span className="text-[10px] text-slate-400 font-normal">{periodBadge}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left">Categoria de Serviço / Indicador Operacional</th>
                      <th className="p-3 text-right">Quantidade Prestada</th>
                      <th className="p-3 text-right">Proporção / Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {/* 1. Resgate e Acolhimento */}
                    <tr className="bg-teal-50/50">
                      <td colSpan={3} className="p-3 font-extrabold text-teal-900 uppercase tracking-wide text-[11px]">
                        1. Serviço de Resgate e Acolhimento Animal
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900">Total de Animais Resgatados / Acolhidos</td>
                      <td className="p-3 font-black text-right text-slate-900 text-sm">{serviceCounts.totalResgates}</td>
                      <td className="p-3 font-bold text-right text-teal-700">100% dos acolhimentos</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Espécie Canina (Cães)</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.caesResgatados}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.caesResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Espécie Felina (Gatos)</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.gatosResgatados}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.gatosResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Outras Espécies</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.outrosResgatados}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.outrosResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-amber-800 font-semibold">↳ Resgates Efetuados via Equipe SAMUVET</td>
                      <td className="p-3 font-bold text-right text-amber-800">{serviceCounts.samuvetResgates}</td>
                      <td className="p-3 text-right text-amber-800 font-semibold">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.samuvetResgates/serviceCounts.totalResgates)*100) : 0}% dos resgates</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Distribuição por Porte (Pequeno / Médio / Grande)</td>
                      <td className="p-3 font-bold text-right text-slate-800">{serviceCounts.portePequeno} / {serviceCounts.porteMedio} / {serviceCounts.porteGrande}</td>
                      <td className="p-3 text-right text-slate-500">Animais classificados</td>
                    </tr>

                    {/* 2. Programa de Esterilização Cirúrgica e Castrações */}
                    <tr className="bg-pink-50/70 border-t border-pink-200">
                      <td colSpan={3} className="p-3 font-extrabold text-pink-900 uppercase tracking-wide text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Scissors size={14} className="text-pink-600" />
                          2. Programa de Esterilização Cirúrgica e Castrações
                        </span>
                        <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full">
                          {serviceCounts.totalCastracoesRealizadas} castrações concluídas
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-pink-50/30">
                      <td className="p-3 font-black text-pink-950">Total de Castrações Realizadas no Período</td>
                      <td className="p-3 font-black text-right text-pink-950 text-base">{serviceCounts.totalCastracoesRealizadas}</td>
                      <td className="p-3 font-bold text-right text-pink-700">100% das castrações</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-700 font-medium">↳ Castrações de Animais Internos (Sem Tutor)</td>
                      <td className="p-3 font-bold text-right text-teal-800">{serviceCounts.castracoesInternos}</td>
                      <td className="p-3 text-right text-teal-700">{serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesInternos / serviceCounts.totalCastracoesRealizadas) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-700 font-medium">↳ Castrações de Animais Externos (Com Tutor)</td>
                      <td className="p-3 font-bold text-right text-indigo-700">{serviceCounts.castracoesExternos}</td>
                      <td className="p-3 text-right text-indigo-700">{serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesExternos / serviceCounts.totalCastracoesRealizadas) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-700 font-medium">↳ Outras Cirurgias Realizadas</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.outrasCirurgiasRealizadas}</td>
                      <td className="p-3 text-right text-slate-500">Procedimentos Gerais</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Total Geral de Cirurgias Realizadas</td>
                      <td className="p-3 font-black text-right text-slate-900 text-sm">{serviceCounts.totalCirurgiasRealizadas}</td>
                      <td className="p-3 font-bold text-right text-slate-700">100% das cirurgias</td>
                    </tr>

                    {/* 3. Serviços Clínicos Veterinários */}
                    <tr className="bg-blue-50/50">
                      <td colSpan={3} className="p-3 font-extrabold text-blue-900 uppercase tracking-wide text-[11px]">
                        3. Serviços Clínicos Veterinários
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900">Total de Atendimentos Veterinários Realizados</td>
                      <td className="p-3 font-black text-right text-blue-900 text-sm">{serviceCounts.totalAtendimentos}</td>
                      <td className="p-3 font-bold text-right text-blue-700">100% dos atendimentos</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Atendimentos a Animais Internos (Sem Tutor / Centro de Controle)</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.atendimentosInternos}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosInternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Atendimentos a Animais Externos (Com Tutor / Particular)</td>
                      <td className="p-3 font-bold text-right text-indigo-700">{serviceCounts.atendimentosExternos}</td>
                      <td className="p-3 text-right text-indigo-700">{serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosExternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
                    </tr>
                    <tr className="bg-slate-100/80">
                      <td colSpan={3} className="p-2.5 pl-6 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
                        ↳ Quantitativo por Resumo do Diagnóstico / Suspeita Preenchida (Por Atendimento)
                      </td>
                    </tr>
                    {Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, count]: [string, number]) => {
                      const percent = serviceCounts.totalAtendimentos > 0 ? Math.round((Number(count) / serviceCounts.totalAtendimentos) * 100) : 0;
                      return (
                        <tr key={diagName} className="hover:bg-slate-50">
                          <td className="p-2.5 pl-10 text-slate-600 text-xs">
                            ↳ {diagName}
                          </td>
                          <td className="p-2.5 font-bold text-right text-slate-900 text-xs">
                            {count}
                          </td>
                          <td className="p-2.5 text-right text-slate-500 text-xs">
                            {percent}%
                          </td>
                        </tr>
                      );
                    })}

                    {/* 4. Destinação e Saídas */}
                    <tr className="bg-emerald-50/50">
                      <td colSpan={3} className="p-3 font-extrabold text-emerald-900 uppercase tracking-wide text-[11px]">
                        4. Destinação e Desfechos Operacionais
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900">Adoções Responsáveis Concluídas</td>
                      <td className="p-3 font-black text-right text-emerald-700 text-sm">{serviceCounts.adocoes}</td>
                      <td className="p-3 font-bold text-right text-emerald-700">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.adocoes/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Solturas e Devoluções Executadas</td>
                      <td className="p-3 font-bold text-right text-teal-700">{serviceCounts.solturas}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.solturas/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Altas Médicas Veterinárias Concedidas</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.altas}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.altas/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-900">Total de Óbitos Registrados no Período</td>
                      <td className="p-3 font-black text-right text-slate-900 text-sm">{serviceCounts.obitos}</td>
                      <td className="p-3 font-bold text-right text-slate-600">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.obitos/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Óbitos Naturais</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.obitosNatural}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosNatural/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
                    </tr>
                    <tr>
                      <td className="p-3 pl-6 text-slate-600">↳ Eutanásias / Óbitos Induzidos</td>
                      <td className="p-3 font-bold text-right text-slate-900">{serviceCounts.obitosEutanasia}</td>
                      <td className="p-3 text-right text-slate-500">{serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosEutanasia/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* VISUALIZAÇÃO DO RELATÓRIO ANALÍTICO (DETALHADO POR TABAS) */}
        {reportFormat === 'ANALITICO' && activeTab === 'RESUMO' && (
          <div className="p-6 space-y-8">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart2 className="text-teal-600" size={20} />
                Detalhamento dos Indicadores Operacionais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Tabela de Origem e Espécie */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-3 font-bold text-xs uppercase tracking-wider text-slate-700 border-b">
                    Detalhamento de Acolhimentos / Entradas
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3 text-slate-600">Total de Entradas no Período</td>
                        <td className="p-3 font-bold text-right text-slate-900">{metrics.totalEntradas}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Espécie Canina (Cães)</td>
                        <td className="p-3 font-bold text-right text-teal-700">{metrics.caesEntradas}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Espécie Felina (Gatos)</td>
                        <td className="p-3 font-bold text-right text-purple-700">{metrics.gatosEntradas}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Resgatados por Equipe SAMUVET</td>
                        <td className="p-3 font-bold text-right text-amber-700">{metrics.samuvetResgates}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabela de Porte e Procedimentos */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-3 font-bold text-xs uppercase tracking-wider text-slate-700 border-b">
                    Porte dos Animais & Desfechos
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3 text-slate-600">Animais Porte Pequeno</td>
                        <td className="p-3 font-bold text-right text-slate-900">{metrics.portePequeno}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Animais Porte Médio</td>
                        <td className="p-3 font-bold text-right text-slate-900">{metrics.porteMedio}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Animais Porte Grande</td>
                        <td className="p-3 font-bold text-right text-slate-900">{metrics.porteGrande}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Atendimentos Médicos Concluídos</td>
                        <td className="p-3 font-bold text-right text-blue-700">{metrics.totalAtendimentos}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Adoções Registradas</td>
                        <td className="p-3 font-bold text-right text-emerald-700">{metrics.adocoesNoPeriodo}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-600">Solturas / Devoluções Executadas</td>
                        <td className="p-3 font-bold text-right text-teal-700">{metrics.solturasNoPeriodo}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ABA: LISTA DE ANIMAIS ACOLHIDOS NO PERÍODO */}
        {activeTab === 'ANIMAIS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Animal</th>
                  <th className="p-4">Espécie / Porte</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Data Resgate</th>
                  <th className="p-4">Solicitante</th>
                  <th className="p-4">Status Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {acolhidosAnimals.map(animal => (
                  <tr key={animal.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{animal.nome}</span>
                        {animal.resgateSamuvet && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-black">SAMUVET</span>
                        )}
                      </div>
                      <div className="text-[10px] font-normal text-slate-400">{animal.raca || 'Sem raça definida'}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {animal.especie} • {animal.porte} • {animal.sexo}
                    </td>
                    <td className="p-4 font-semibold">
                      {animal.temTutor ? (
                        <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-bold">Com Tutor</span>
                      ) : (
                        <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[10px] font-bold">Sem Tutor (Interno)</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {animal.dataResgate ? format(new Date(animal.dataResgate), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {animal.solicitante?.nomeCompleto || 'Direto'}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {animal.condicao}
                      </span>
                    </td>
                  </tr>
                ))}
                {acolhidosAnimals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      Nenhum animal acolhido registrado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA: LISTA DE CIRURGIAS E CASTRAÇÕES NO PERÍODO */}
        {activeTab === 'CIRURGIAS' && (
          <div className="overflow-x-auto">
            <div className="p-4 bg-pink-50/50 border-b border-pink-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 text-pink-700 rounded-xl">
                  <Scissors size={20} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Controle de Procedimentos Cirúrgicos e Esterilizações</h4>
                  <p className="text-xs text-slate-500">Mostrando {filteredCirurgias.length} registros no período filtrado</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
                  {metrics.totalCastracoesRealizadas} Castrações Concluídas
                </span>
                <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-lg">
                  {metrics.cirurgiasAgendadas} Agendadas / Fila
                </span>
              </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Data / Horário</th>
                  <th className="p-4">Paciente</th>
                  <th className="p-4">Espécie / Sexo</th>
                  <th className="p-4">Tipo de Cirurgia</th>
                  <th className="p-4">Veterinário Cirurgião</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCirurgias.map(cir => {
                  const animal = allAnimals.find(a => a.id === cir.animalId);
                  const isCastracao = (cir.tipoCirurgia || '').toLowerCase().includes('castra') ||
                    (cir.tipoCirurgia || '').toLowerCase().includes('osh') ||
                    (cir.tipoCirurgia || '').toLowerCase().includes('orquiectomia');
                  return (
                    <tr key={cir.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">
                        {cir.dataAgendamento ? format(new Date(cir.dataAgendamento), 'dd/MM/yyyy') : '-'}
                        {cir.horarioAgendamento && <span className="text-slate-400 font-normal ml-1">às {cir.horarioAgendamento}</span>}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{animal?.nome || cir.animalNome || 'Paciente'}</span>
                          {animal?.microchip && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              🏷️ {animal.microchip}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {animal?.temTutor ? 'Com Tutor (Externo)' : 'Sem Tutor (Interno)'}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        {animal?.especie || '-'} • {animal?.sexo || '-'} • {animal?.porte || '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {isCastracao && <Scissors size={14} className="text-pink-600" />}
                          <span className={`font-bold ${isCastracao ? 'text-pink-900' : 'text-slate-800'}`}>
                            {cir.tipoCirurgia}
                          </span>
                        </div>
                        {cir.observacoesPreOperatorias && (
                          <div className="text-[10px] text-slate-400 max-w-xs truncate">{cir.observacoesPreOperatorias}</div>
                        )}
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        {cir.veterinarioResponsavel || '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          cir.status === CirurgiaStatus.REALIZADA ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          cir.status === CirurgiaStatus.AGENDADA ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          cir.status === CirurgiaStatus.EM_PREPARO ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {cir.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredCirurgias.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      Nenhum procedimento cirúrgico ou castração registrado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA: ATENDIMENTOS VETERINÁRIOS */}
        {activeTab === 'ATENDIMENTOS' && (
          <div className="space-y-6">
            {/* Cards quantitativos de suspeita/diagnóstico por atendimento */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">🩺</span>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Quantitativo por Resumo de Diagnóstico / Suspeita Preenchida
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                  Total: <strong className="text-blue-900 font-extrabold">{filteredRecords.length}</strong> atendimentos no período
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
                {Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, count]: [string, number]) => {
                  const percent = serviceCounts.totalAtendimentos > 0 ? Math.round((Number(count) / serviceCounts.totalAtendimentos) * 100) : 0;
                  return (
                    <div key={diagName} className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-700 truncate" title={diagName}>{diagName}</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-lg font-black text-slate-900">{count}</span>
                        <span className="text-[10px] font-bold text-slate-400">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-500 italic">
                * Contagem realizada com base no campo Resumo do Diagnóstico de cada atendimento registrado (contando ocorrências por atendimento, não por animal único).
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Data / Hora</th>
                    <th className="p-4">Animal</th>
                    <th className="p-4">Anamnese / Queixa</th>
                    <th className="p-4">Diagnóstico / Conduta</th>
                    <th className="p-4">Status Recomendado</th>
                    <th className="p-4">Receitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredRecords.map(rec => {
                    const animal = allAnimals.find(a => a.id === rec.animalId);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-700 whitespace-nowrap">
                          {format(new Date(rec.dataAtendimento), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {animal?.nome || 'Desconhecido'}
                        </td>
                        <td className="p-4 font-medium text-slate-600 max-w-xs truncate">
                          {rec.procedimentoOuAnamnese || '-'}
                        </td>
                        <td className="p-4 font-medium text-slate-800 max-w-xs truncate">
                          {rec.diagnosticoClinico || rec.diagnosticoProcedimentos || '-'}
                        </td>
                        <td className="p-4 font-bold text-teal-700">
                          {rec.recommendedCondicao || '-'}
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                          {rec.prescriptions?.length || 0} medicamentos
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        Nenhum atendimento veterinário realizado no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: HISTÓRICO DE SAÍDAS / DESFECHOS */}
        {activeTab === 'DESFECHOS' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] font-black uppercase text-slate-400">Total de Desfechos</div>
                <div className="text-xl font-black text-slate-900">{serviceCounts.totalDesfechos}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <div className="text-[10px] font-black uppercase text-emerald-600">Adoções / Solturas</div>
                <div className="text-xl font-black text-emerald-800">{serviceCounts.adocoes + serviceCounts.solturas}</div>
                <div className="text-[10px] text-slate-500 font-semibold">❤️ {serviceCounts.adocoes} Adoções • 🌿 {serviceCounts.solturas} Solturas</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-300">
                <div className="text-[10px] font-black uppercase text-slate-600">Óbitos Totais</div>
                <div className="text-xl font-black text-slate-900">{serviceCounts.obitos}</div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  {serviceCounts.totalResgates > 0 ? `${Math.round((serviceCounts.obitos / serviceCounts.totalResgates) * 100)}% das entradas` : '0%'}
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-300">
                <div className="text-[10px] font-black uppercase text-slate-600">Classificação dos Óbitos</div>
                <div className="text-xs font-bold text-slate-800 space-y-0.5 mt-1">
                  <div>🌿 Óbito Natural: <span className="font-black text-slate-900">{serviceCounts.obitosNatural}</span></div>
                  <div>✝️ Eutanásia: <span className="font-black text-slate-900">{serviceCounts.obitosEutanasia}</span></div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Data</th>
                    <th className="p-4">Animal</th>
                    <th className="p-4">Status Anterior</th>
                    <th className="p-4">Novo Status (Desfecho)</th>
                    <th className="p-4">Causa / Detalhamento do Óbito</th>
                    <th className="p-4">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStatusLogs.map(log => {
                    const animal = allAnimals.find(a => a.id === log.animalId);
                    const user = allUsers.find(u => u.id === log.usuarioId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-700 whitespace-nowrap">
                          {format(new Date(log.dataAlteracao), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {animal?.nome || 'Desconhecido'}
                        </td>
                        <td className="p-4 font-medium text-slate-500">
                          {log.statusAnterior || 'Início'}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded font-extrabold text-[10px] uppercase border ${
                            log.statusNovo === AnimalCondicao.ADOTADO ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            log.statusNovo === AnimalCondicao.SOLTURA ? 'bg-teal-100 text-teal-800 border-teal-300' :
                            log.statusNovo === AnimalCondicao.OBITO ? 'bg-slate-900 text-white border-slate-900' :
                            'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {log.statusNovo}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {log.statusNovo === AnimalCondicao.OBITO ? (animal?.causaObito || '-') : '-'}
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                          {user?.name || 'Sistema'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStatusLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        Nenhuma alteração de status/desfecho registrada no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: ACOMODAÇÕES E BAIAS */}
        {activeTab === 'ACOMODACOES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Baia / Acomodação</th>
                  <th className="p-4">Animal</th>
                  <th className="p-4">Entrada</th>
                  <th className="p-4">Saída / Liberação</th>
                  <th className="p-4">Justificativa / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOccupations.map(occ => {
                  const animal = allAnimals.find(a => a.id === occ.animalId);
                  const kennel = allKennels.find(k => k.id === occ.kennelId);
                  return (
                    <tr key={occ.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-teal-800">
                        {kennel?.name || occ.kennelId}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {animal?.nome || 'Desconhecido'}
                      </td>
                      <td className="p-4 font-medium text-slate-600">
                        {format(new Date(occ.entryDate), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="p-4 font-medium text-slate-600">
                        {occ.exitDate ? format(new Date(occ.exitDate), 'dd/MM/yyyy HH:mm') : <span className="text-emerald-600 font-bold">Ocupado Atualmente</span>}
                      </td>
                      <td className="p-4 font-medium text-slate-500 max-w-xs truncate">
                        {occ.justification || '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredOccupations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                      Nenhuma alocação ou desalocação de baia registrada no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* RODAPÉ OFICIAL PARA ASSINATURAS (Impresso apenas ao emitir PDF/Impressão) */}
      <div className="hidden print:block mt-16 pt-8 border-t border-slate-400 print-header">
        <div className="grid grid-cols-2 gap-12 text-center text-xs">
          <div className="space-y-8">
            <div className="border-b border-slate-800 w-4/5 mx-auto"></div>
            <div>
              <div className="font-bold text-slate-900">Médico Veterinário Responsável</div>
              <div className="text-[10px] text-slate-600">CRMV / Registro Técnico</div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="border-b border-slate-800 w-4/5 mx-auto"></div>
            <div>
              <div className="font-bold text-slate-900">Coordenador do Centro de Bem-Estar Animal</div>
              <div className="text-[10px] text-slate-600">Superintendência do SISBEM</div>
            </div>
          </div>
        </div>
        <div className="text-center text-[9px] text-slate-400 mt-12">
          Relatório emitido automaticamente via SISBEM - Sistema Integrado de Bem-Estar Animal em {format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")}.
        </div>
      </div>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE IMPRESSÃO COMPLETA */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-4 sm:p-6 no-print">
          <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-300 my-8 overflow-hidden animate-in zoom-in-95">
            
            {/* Barra de Ações Superior do Modal */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 rounded-lg">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Pré-visualização Oficial do Documento</h3>
                  <p className="text-xs text-slate-400">{periodDescription}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleDirectPrint}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-xl text-xs shadow transition-all"
                >
                  <Printer size={16} /> Imprimir Agora / Salvar PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                  title="Fechar Pré-visualização"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Folha do Documento para Impressão */}
            <div className="p-8 sm:p-12 bg-white m-4 sm:m-8 rounded-xl shadow-md border border-slate-200 text-slate-900 space-y-8 font-sans">
              
              {/* Cabeçalho */}
              <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight">PREFEITURA MUNICIPAL DE POUSO ALEGRE</h1>
                  <h2 className="text-sm font-bold text-teal-800">SUPERINTENDÊNCIA DE BEM-ESTAR ANIMAL - SISBEM</h2>
                  <p className="text-xs text-slate-500">Sistema Integrado de Gestão e Prontuários Veterinários</p>
                </div>
                <div className="text-right border-l-2 border-slate-300 pl-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Documento Oficial</div>
                  <div className="text-sm font-black text-slate-900">{periodBadge}</div>
                  <div className="text-[10px] text-slate-500">Emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
                </div>
              </div>

              {/* Informações de Período */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between text-xs font-semibold text-slate-800">
                <span><strong>Período Analisado:</strong> {periodDescription}</span>
                <span><strong>Emitido por:</strong> {currentUser?.name || 'Administrador'}</span>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase">Acolhimentos</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.totalEntradas}</div>
                  <div className="text-[9px] text-slate-500 font-medium">🐕 {metrics.caesEntradas} • 🐈 {metrics.gatosEntradas}</div>
                </div>
                <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl">
                  <div className="text-[9px] font-extrabold text-pink-700 uppercase">Castrações Concluídas</div>
                  <div className="text-xl font-black text-pink-950 mt-0.5">{metrics.totalCastracoesRealizadas}</div>
                  <div className="text-[9px] text-pink-800 font-medium">🏠 {metrics.castracoesInternos} int. • 👤 {metrics.castracoesExternos} ext.</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase">Atendimentos Vet</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.totalAtendimentos}</div>
                  <div className="text-[9px] text-slate-500 font-medium">🏠 {metrics.atendimentosInternos} • 👤 {metrics.atendimentosExternos}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase">Adoções / Saídas</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.adocoesNoPeriodo + metrics.solturasNoPeriodo}</div>
                  <div className="text-[9px] text-slate-500 font-medium">❤️ {metrics.adocoesNoPeriodo} • 🌿 {metrics.solturasNoPeriodo}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase">Óbitos Totais</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.obitosNoPeriodo}</div>
                  <div className="text-[9px] text-slate-500 font-medium">🌿 {metrics.obitosNaturalNoPeriodo} • ✝️ {metrics.obitosEutanasiaNoPeriodo}</div>
                </div>
              </div>

              {/* Conteúdo conforme o Modelo Escolhido (RESUMIDO vs ANALÍTICO) */}
              {reportFormat === 'RESUMIDO' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                    Quadro Sintético de Quantidades dos Serviços Prestados
                  </h3>
                  <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                    <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-700">
                      <tr>
                        <th className="p-2 border border-slate-300">Serviço / Indicador Operacional</th>
                        <th className="p-2 border border-slate-300 text-right">Quantidade</th>
                        <th className="p-2 border border-slate-300 text-right">Proporção / Detalhamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {/* Acolhimentos */}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="p-2 border border-slate-300 text-teal-900">1. RESGATE E ACOLHIMENTO ANIMAL</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold">Total de Animais Acolhidos</td>
                        <td className="p-2 border border-slate-300 font-black text-right text-sm">{serviceCounts.totalResgates}</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-teal-700">100% dos acolhimentos</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Cães (Caninos)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.caesResgatados}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.caesResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Gatos (Felinos)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.gatosResgatados}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.gatosResgatados/serviceCounts.totalResgates)*100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Resgates via SAMUVET</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-amber-800">{serviceCounts.samuvetResgates}</td>
                        <td className="p-2 border border-slate-300 text-right text-amber-800 font-semibold">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.samuvetResgates/serviceCounts.totalResgates)*100) : 0}% dos resgates</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Porte (Pequeno / Médio / Grande)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">{serviceCounts.portePequeno} / {serviceCounts.porteMedio} / {serviceCounts.porteGrande}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">Acolhidos no período</td>
                      </tr>

                      {/* Castrações */}
                      <tr className="bg-pink-50 font-bold">
                        <td colSpan={3} className="p-2 border border-slate-300 text-pink-900">2. PROGRAMA DE ESTERILIZAÇÃO CIRÚRGICA E CASTRAÇÕES</td>
                      </tr>
                      <tr className="font-semibold">
                        <td className="p-2 border border-slate-300 font-bold text-pink-950">Total de Castrações Realizadas no Período</td>
                        <td className="p-2 border border-slate-300 font-black text-right text-sm text-pink-950">{serviceCounts.totalCastracoesRealizadas}</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-pink-700">100% das castrações</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Castrações de Animais Internos (Sem Tutor)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-teal-800">{serviceCounts.castracoesInternos}</td>
                        <td className="p-2 border border-slate-300 text-right text-teal-700">{serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesInternos/serviceCounts.totalCastracoesRealizadas)*100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Castrações de Animais Externos (Com Tutor)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-indigo-700">{serviceCounts.castracoesExternos}</td>
                        <td className="p-2 border border-slate-300 text-right text-indigo-700">{serviceCounts.totalCastracoesRealizadas > 0 ? Math.round((serviceCounts.castracoesExternos/serviceCounts.totalCastracoesRealizadas)*100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Outras Cirurgias Realizadas</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.outrasCirurgiasRealizadas}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">Procedimentos Gerais</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2 border border-slate-300 font-bold">Total Geral de Cirurgias Realizadas</td>
                        <td className="p-2 border border-slate-300 font-bold text-right text-slate-900">{serviceCounts.totalCirurgiasRealizadas}</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-slate-700">100% das cirurgias</td>
                      </tr>

                      {/* Atendimentos */}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="p-2 border border-slate-300 text-blue-900">3. SERVIÇOS CLÍNICOS VETERINÁRIOS</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold">Total de Atendimentos Veterinários</td>
                        <td className="p-2 border border-slate-300 font-black text-right text-sm text-blue-900">{serviceCounts.totalAtendimentos}</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-blue-700">100% dos atendimentos</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Atendimentos a Animais Internos (Sem Tutor)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.atendimentosInternos}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosInternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Atendimentos a Animais Externos (Com Tutor)</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-indigo-700">{serviceCounts.atendimentosExternos}</td>
                        <td className="p-2 border border-slate-300 text-right text-indigo-700">{serviceCounts.totalAtendimentos > 0 ? Math.round((serviceCounts.atendimentosExternos/serviceCounts.totalAtendimentos)*100) : 0}%</td>
                      </tr>
                      <tr className="bg-slate-50 font-semibold text-[10px] uppercase">
                        <td colSpan={3} className="p-1.5 pl-4 border border-slate-300 text-slate-700">
                          ↳ Quantitativo por Resumo de Diagnóstico / Suspeita Preenchida (Por Atendimento)
                        </td>
                      </tr>
                      {Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, count]: [string, number]) => (
                        <tr key={diagName}>
                          <td className="p-1.5 pl-6 border border-slate-300 text-slate-700">↳ {diagName}</td>
                          <td className="p-1.5 border border-slate-300 text-right font-bold text-slate-900">{count}</td>
                          <td className="p-1.5 border border-slate-300 text-right text-slate-600">
                            {serviceCounts.totalAtendimentos > 0 ? Math.round((Number(count) / serviceCounts.totalAtendimentos) * 100) : 0}%
                          </td>
                        </tr>
                      ))}

                      {/* Desfechos */}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={3} className="p-2 border border-slate-300 text-emerald-900">4. DESFECHOS E DESTITUIÇÕES</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold">Adoções Concluídas</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-emerald-700">{serviceCounts.adocoes}</td>
                        <td className="p-2 border border-slate-300 text-right text-emerald-700">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.adocoes/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Solturas e Devoluções</td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-teal-700">{serviceCounts.solturas}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.solturas/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold">Total de Óbitos Registrados</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.obitos}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.totalResgates > 0 ? Math.round((serviceCounts.obitos/serviceCounts.totalResgates)*100) : 0}% das entradas</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Óbitos Naturais</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.obitosNatural}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosNatural/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 pl-4">↳ Eutanásias / Induzidos</td>
                        <td className="p-2 border border-slate-300 text-right font-bold">{serviceCounts.obitosEutanasia}</td>
                        <td className="p-2 border border-slate-300 text-right text-slate-600">{serviceCounts.obitos > 0 ? Math.round((serviceCounts.obitosEutanasia/serviceCounts.obitos)*100) : 0}% dos óbitos</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  {/* Tabela 1: Animais */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                      1. Animais Acolhidos / Resgatados no Período ({acolhidosAnimals.length})
                    </h3>
                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Animal</th>
                          <th className="p-2 border border-slate-200">Espécie / Porte</th>
                          <th className="p-2 border border-slate-200">Origem</th>
                          <th className="p-2 border border-slate-200">Data Resgate</th>
                          <th className="p-2 border border-slate-200">Solicitante</th>
                          <th className="p-2 border border-slate-200">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {acolhidosAnimals.map(a => (
                          <tr key={a.id}>
                            <td className="p-2 border border-slate-200 font-bold">{a.nome}</td>
                            <td className="p-2 border border-slate-200">{a.especie} • {a.porte}</td>
                            <td className="p-2 border border-slate-200">{a.temTutor ? 'Com Tutor' : 'Sem Tutor (Interno)'}</td>
                            <td className="p-2 border border-slate-200">{a.dataResgate ? format(new Date(a.dataResgate), 'dd/MM/yyyy') : '-'}</td>
                            <td className="p-2 border border-slate-200">{a.solicitante?.nomeCompleto || 'Direto'}</td>
                            <td className="p-2 border border-slate-200 font-bold">{a.condicao}</td>
                          </tr>
                        ))}
                        {acolhidosAnimals.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center italic text-slate-400">Nenhum registro.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Tabela 2: Cirurgias e Castrações */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                      2. Cirurgias e Castrações do Período ({filteredCirurgias.length})
                    </h3>
                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Data</th>
                          <th className="p-2 border border-slate-200">Paciente</th>
                          <th className="p-2 border border-slate-200">Espécie / Sexo</th>
                          <th className="p-2 border border-slate-200">Cirurgia</th>
                          <th className="p-2 border border-slate-200">Veterinário</th>
                          <th className="p-2 border border-slate-200">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {filteredCirurgias.map(c => {
                          const animal = allAnimals.find(a => a.id === c.animalId);
                          return (
                            <tr key={c.id}>
                              <td className="p-2 border border-slate-200 font-semibold">{c.dataAgendamento ? format(new Date(c.dataAgendamento), 'dd/MM/yyyy') : '-'}</td>
                              <td className="p-2 border border-slate-200 font-bold">{animal?.nome || c.animalNome}</td>
                              <td className="p-2 border border-slate-200">{animal?.especie || '-'} • {animal?.sexo || '-'}</td>
                              <td className="p-2 border border-slate-200 font-bold text-pink-900">{c.tipoCirurgia}</td>
                              <td className="p-2 border border-slate-200">{c.veterinarioResponsavel || '-'}</td>
                              <td className="p-2 border border-slate-200 font-bold">{c.status}</td>
                            </tr>
                          );
                        })}
                        {filteredCirurgias.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center italic text-slate-400">Nenhuma cirurgia registrada no período.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Tabela 3: Atendimentos */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                      3. Atendimentos Veterinários ({filteredRecords.length})
                    </h3>
                    
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2 mb-3">
                      <div className="text-[11px] font-bold text-slate-800">Quantitativo por Resumo do Diagnóstico / Suspeita Preenchida (Contagem por Atendimento):</div>
                      <table className="w-full text-left border-collapse border border-slate-200 text-[10px] bg-white">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                          <tr>
                            <th className="p-1.5 border border-slate-200">Suspeita / Diagnóstico</th>
                            <th className="p-1.5 border border-slate-200 text-right">Qtd. Atendimentos</th>
                            <th className="p-1.5 border border-slate-200 text-right">% do Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(serviceCounts.diagnosticoCounts).map(([diagName, cnt]: [string, number]) => (
                            <tr key={diagName}>
                              <td className="p-1.5 border border-slate-200 font-medium">{diagName}</td>
                              <td className="p-1.5 border border-slate-200 text-right font-bold">{cnt}</td>
                              <td className="p-1.5 border border-slate-200 text-right">
                                {serviceCounts.totalAtendimentos > 0 ? Math.round((Number(cnt) / serviceCounts.totalAtendimentos) * 100) : 0}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Data/Hora</th>
                          <th className="p-2 border border-slate-200">Animal</th>
                          <th className="p-2 border border-slate-200">Anamnese / Queixa</th>
                          <th className="p-2 border border-slate-200">Diagnóstico</th>
                          <th className="p-2 border border-slate-200">Status Recomendado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {filteredRecords.map(r => {
                          const animal = allAnimals.find(a => a.id === r.animalId);
                          return (
                            <tr key={r.id}>
                              <td className="p-2 border border-slate-200 font-semibold">{format(new Date(r.dataAtendimento), 'dd/MM/yyyy HH:mm')}</td>
                              <td className="p-2 border border-slate-200 font-bold">{animal?.nome || 'Desconhecido'}</td>
                              <td className="p-2 border border-slate-200">{r.procedimentoOuAnamnese || '-'}</td>
                              <td className="p-2 border border-slate-200">{r.diagnosticoClinico || r.diagnosticoProcedimentos || '-'}</td>
                              <td className="p-2 border border-slate-200 font-bold">{r.recommendedCondicao || '-'}</td>
                            </tr>
                          );
                        })}
                        {filteredRecords.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center italic text-slate-400">Nenhum atendimento no período.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Assinaturas */}
              <div className="pt-16 grid grid-cols-2 gap-12 text-center text-xs">
                <div>
                  <div className="border-b border-slate-900 w-4/5 mx-auto mb-2"></div>
                  <div className="font-bold text-slate-900">Médico Veterinário Responsável</div>
                  <div className="text-[10px] text-slate-500">CRMV / Registro Técnico</div>
                </div>
                <div>
                  <div className="border-b border-slate-900 w-4/5 mx-auto mb-2"></div>
                  <div className="font-bold text-slate-900">Coordenador do Centro de Bem-Estar Animal</div>
                  <div className="text-[10px] text-slate-500">Superintendência do SISBEM</div>
                </div>
              </div>

            </div>

            {/* Rodapé da Modal */}
            <div className="bg-slate-200 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-semibold text-slate-600 border-t border-slate-300">
              <span>Para salvar em PDF, selecione a opção "Salvar como PDF" na caixa de diálogo de impressão.</span>
              <button
                onClick={handleDirectPrint}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl shadow transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Imprimir / PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ReportsPage;
