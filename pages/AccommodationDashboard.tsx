
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../services/db';
import { KennelType, Kennel, KennelOccupation, AnimalJoined, AnimalCondicao } from '../types';
import { Home, Users, Search, AlertTriangle, CheckCircle, ArrowRightLeft, User, ClipboardCheck, ArrowRight, Save, Info, Printer, History, LogOut, Layers, X, Check, Filter, RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pullFromSupabaseToLocal } from '../src/lib/supabaseSync';

const AccommodationDashboard: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [allocatingAnimal, setAllocatingAnimal] = useState<AnimalJoined | null>(null);
  const [selectedKennelId, setSelectedKennelId] = useState('');
  const [justification, setJustification] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados para modal de impressão de tratamentos
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printKennelTypeFilter, setPrintKennelTypeFilter] = useState<string>('TODOS');
  const [printOnlyActiveTreatment, setPrintOnlyActiveTreatment] = useState<boolean>(true);

  const user = db.getCurrentUser();
  const [kennels, setKennels] = useState<Kennel[]>(() => db.getKennels());
  const [occupations, setOccupations] = useState<KennelOccupation[]>(() => db.getOccupations());
  const [allAnimals, setAllAnimals] = useState<AnimalJoined[]>(() => db.getAnimalsJoined());

  const refreshData = () => {
    setKennels(db.getKennels());
    setOccupations(db.getOccupations());
    setAllAnimals(db.getAnimalsJoined());
  };

  useEffect(() => {
    refreshData();

    // Sincroniza em segundo plano ao abrir a tela
    pullFromSupabaseToLocal(db).then(() => {
      refreshData();
    }).catch(() => {});

    const handleUpdate = () => {
      refreshData();
    };

    window.addEventListener('sisbem-occupations-changed', handleUpdate);
    window.addEventListener('sisbem-animals-changed', handleUpdate);
    window.addEventListener('sisbem-kennels-changed', handleUpdate);
    window.addEventListener('sisbem-settings-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('sisbem-occupations-changed', handleUpdate);
      window.removeEventListener('sisbem-animals-changed', handleUpdate);
      window.removeEventListener('sisbem-kennels-changed', handleUpdate);
      window.removeEventListener('sisbem-settings-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await pullFromSupabaseToLocal(db);
      refreshData();
    } catch (e) {
      console.warn('Erro ao sincronizar baias:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const latestAllocatingRecord = useMemo(() => {
    if (!allocatingAnimal?.historico || allocatingAnimal.historico.length === 0) return null;
    return [...allocatingAnimal.historico].sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime())[0];
  }, [allocatingAnimal]);

  // Animais aguardando acomodação: 
  // 1. Não possuem ocupação ativa
  // 2. JÁ SAÍRAM DA FILA VETERINÁRIA (Condição diferente de ACOLHIDO) ou com indicação de internação
  // 3. Estão em condições que exigem abrigo no centro
  const waitingAnimals = useMemo(() => {
    return allAnimals.filter(a => 
      !occupations.some(o => o.animalId === a.id && !o.exitDate) && 
      ([AnimalCondicao.EM_TRATAMENTO, AnimalCondicao.DISPONIVEL_ADOCAO].includes(a.condicao) || !!a.necessitaInternacao)
    );
  }, [allAnimals, occupations]);

  const stats = useMemo(() => {
    const data = Object.values(KennelType).map(type => {
      const typeKennels = kennels.filter(k => k.type === type);
      const typeOccupations = occupations.filter(o => !o.exitDate && typeKennels.some(k => k.id === o.kennelId));
      const totalCapacity = typeKennels.reduce((acc, k) => acc + k.capacity, 0);
      return {
        type,
        total: typeKennels.length,
        capacity: totalCapacity,
        occupied: typeOccupations.length,
        percent: totalCapacity > 0 ? (typeOccupations.length / totalCapacity) * 100 : 0
      };
    });
    return data;
  }, [kennels, occupations]);

  const filteredKennels = useMemo(() => {
    return kennels.filter(k => {
      const matchType = filterType === 'TODOS' || k.type === filterType;
      const matchSearch = k.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
  }, [kennels, filterType, searchTerm]);

  const getKennelData = (kennelId: string) => {
    const activeOccs = occupations.filter(o => o.kennelId === kennelId && !o.exitDate);
    const occupants = activeOccs.map(o => allAnimals.find(a => a.id === o.animalId)).filter(Boolean);
    return { count: activeOccs.length, occupants };
  };

  const KENNEL_TYPE_PRINT_OPTIONS = [
    { id: 'TODOS', label: 'Todos os Tipos de Baias', desc: 'Todas as acomodações e setores do centro', icon: Layers, badgeColor: 'bg-teal-100 text-teal-800' },
    { id: KennelType.QUARENTENA, label: 'Quarentena / Isolamento', desc: 'Isolamento sanitário, infecciosos e suspeitas', icon: AlertTriangle, badgeColor: 'bg-amber-100 text-amber-800' },
    { id: KennelType.INDIVIDUAL, label: 'Baias Individuais', desc: 'Canis e acomodações individuais', icon: Home, badgeColor: 'bg-blue-100 text-blue-800' },
    { id: KennelType.COLETIVA, label: 'Baias Coletivas', desc: 'Acomodações compartilhadas e recreação', icon: Users, badgeColor: 'bg-indigo-100 text-indigo-800' },
    { id: KennelType.GATIL, label: 'Gatil / Acomodação Felina', desc: 'Gatil e acomodações exclusivas para gatos', icon: Home, badgeColor: 'bg-purple-100 text-purple-800' },
    { id: KennelType.PRE_OPERATORIO, label: 'Pré-Operatório', desc: 'Preparo cirúrgico, jejum e triagem prévia', icon: ClipboardCheck, badgeColor: 'bg-rose-100 text-rose-800' },
    { id: KennelType.POS_OPERATORIO, label: 'Pós-Operatório', desc: 'Recuperação anestésica e pós-cirúrgico', icon: CheckCircle, badgeColor: 'bg-emerald-100 text-emerald-800' },
    { id: 'SEM_BAIA', label: 'Aguardando Alocação (Fila)', desc: 'Animais aguardando direcionamento de baia', icon: ArrowRightLeft, badgeColor: 'bg-slate-100 text-slate-800' },
  ];

  const printCountsByType = useMemo(() => {
    const counts: Record<string, { total: number; inTreatment: number }> = {
      'TODOS': { total: 0, inTreatment: 0 },
      [KennelType.QUARENTENA]: { total: 0, inTreatment: 0 },
      [KennelType.INDIVIDUAL]: { total: 0, inTreatment: 0 },
      [KennelType.COLETIVA]: { total: 0, inTreatment: 0 },
      [KennelType.GATIL]: { total: 0, inTreatment: 0 },
      [KennelType.PRE_OPERATORIO]: { total: 0, inTreatment: 0 },
      [KennelType.POS_OPERATORIO]: { total: 0, inTreatment: 0 },
      'SEM_BAIA': { total: 0, inTreatment: 0 },
    };

    allAnimals.forEach(animal => {
      if ([AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO].includes(animal.condicao)) {
        return;
      }
      const hasActiveOcc = !!animal.currentOccupation;
      const isWaiting = !hasActiveOcc && ([AnimalCondicao.EM_TRATAMENTO, AnimalCondicao.DISPONIVEL_ADOCAO].includes(animal.condicao) || !!animal.necessitaInternacao);
      
      if (!hasActiveOcc && !isWaiting) return;

      const hasTreatment = animal.condicao === AnimalCondicao.EM_TRATAMENTO || 
        !!animal.necessitaInternacao || 
        (animal.historico && animal.historico.some(h => (h.receitas && h.receitas.length > 0) || !!h.tratamentoAmbulatorial));

      const type = animal.currentOccupation?.kennel?.type || 
        animal.tipoAcomodacaoSugerida || 
        animal.historico?.[0]?.recommendedKennelType || 
        'SEM_BAIA';

      counts['TODOS'].total += 1;
      if (hasTreatment) counts['TODOS'].inTreatment += 1;

      if (counts[type]) {
        counts[type].total += 1;
        if (hasTreatment) counts[type].inTreatment += 1;
      } else {
        counts['SEM_BAIA'].total += 1;
        if (hasTreatment) counts['SEM_BAIA'].inTreatment += 1;
      }
    });

    return counts;
  }, [allAnimals]);

  const handleQuickAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingAnimal || !selectedKennelId) return;

    try {
      await db.allocateAnimalAsync({
        kennelId: selectedKennelId,
        animalId: allocatingAnimal.id,
        vetId: user!.id,
        justification: justification || 'Alocação via Fila de Acomodação'
      });
      setAllocatingAnimal(null);
      setSelectedKennelId('');
      setJustification('');
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRelease = async (animalId: string, animalName: string) => {
    if (!window.confirm(`Tem certeza que deseja desalocar o animal ${animalName} desta baia?`)) return;
    try {
      await db.releaseAnimalFromKennelAsync(animalId);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintTreatmentSheet = (selectedType: string = printKennelTypeFilter, onlyTreatment: boolean = printOnlyActiveTreatment) => {
    const freshAnimals = db.getAnimalsJoined();
    
    // Filtrar animais excluindo desfechos definitivos (óbito, soltura, adoção)
    const activePool = freshAnimals.filter(a => 
      ![AnimalCondicao.OBITO, AnimalCondicao.SOLTURA, AnimalCondicao.ADOTADO].includes(a.condicao)
    );

    // Animais com tratamento ativo / prescrição médica
    const animalsInTreatment = activePool.filter(a => {
      if (a.condicao === AnimalCondicao.EM_TRATAMENTO || a.necessitaInternacao) {
        return true;
      }
      if (a.historico && a.historico.some(h => (h.receitas && h.receitas.length > 0) || h.tratamentoAmbulatorial)) {
        return true;
      }
      return false;
    });

    const pool = onlyTreatment
      ? (animalsInTreatment.length > 0 ? animalsInTreatment : activePool.filter(a => a.currentOccupation))
      : activePool.filter(a => a.currentOccupation || a.necessitaInternacao || a.condicao === AnimalCondicao.EM_TRATAMENTO);

    // Filtrar pelo tipo de baia selecionado
    const targetAnimals = pool.filter(animal => {
      if (selectedType === 'TODOS') return true;

      const animalTypeKey = animal.currentOccupation?.kennel?.type || 
        animal.tipoAcomodacaoSugerida || 
        animal.historico?.[0]?.recommendedKennelType || 
        'SEM_BAIA';

      return animalTypeKey === selectedType;
    });

    // Extrator do número da baia para ordenação crescente
    const extractKennelNumber = (kennelName?: string): number => {
      if (!kennelName) return 999999;
      const match = kennelName.match(/\d+/);
      return match ? parseInt(match[0], 10) : 999999;
    };

    const TYPE_TITLES: Record<string, string> = {
      [KennelType.QUARENTENA]: 'Baias de Quarentena / Isolamento',
      [KennelType.INDIVIDUAL]: 'Baias Individuais',
      [KennelType.COLETIVA]: 'Baias Coletivas',
      [KennelType.GATIL]: 'Gatil / Acomodação Felina',
      [KennelType.PRE_OPERATORIO]: 'Baias de Pré-Operatório',
      [KennelType.POS_OPERATORIO]: 'Baias de Pós-Operatório',
      'SEM_BAIA': 'Aguardando Alocação em Baia'
    };

    const TYPE_ORDER: Record<string, number> = {
      [KennelType.QUARENTENA]: 1,
      [KennelType.INDIVIDUAL]: 2,
      [KennelType.COLETIVA]: 3,
      [KennelType.GATIL]: 4,
      [KennelType.PRE_OPERATORIO]: 5,
      [KennelType.POS_OPERATORIO]: 6,
      'SEM_BAIA': 99
    };

    // Agrupamento por tipo de baia
    const groupsMap = new Map<string, AnimalJoined[]>();

    targetAnimals.forEach(animal => {
      let typeKey = 'SEM_BAIA';
      if (animal.currentOccupation?.kennel?.type) {
        typeKey = animal.currentOccupation.kennel.type;
      } else if (animal.tipoAcomodacaoSugerida) {
        typeKey = animal.tipoAcomodacaoSugerida;
      } else if (animal.historico && animal.historico.length > 0 && animal.historico[0].recommendedKennelType) {
        typeKey = animal.historico[0].recommendedKennelType;
      }

      if (!groupsMap.has(typeKey)) {
        groupsMap.set(typeKey, []);
      }
      groupsMap.get(typeKey)!.push(animal);
    });

    // Ordenação dos animais dentro de cada tipo de baia em ordem crescente pelo número da baia
    groupsMap.forEach((animals) => {
      animals.sort((a, b) => {
        const nameA = a.currentOccupation?.kennel?.name || '';
        const nameB = b.currentOccupation?.kennel?.name || '';
        const numA = extractKennelNumber(nameA);
        const numB = extractKennelNumber(nameB);

        if (numA !== numB) {
          return numA - numB;
        }

        const comp = nameA.localeCompare(nameB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        if (comp !== 0) return comp;

        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      });
    });

    // Ordenação dos grupos de baias
    const sortedGroupKeys = Array.from(groupsMap.keys()).sort((a, b) => {
      const orderA = TYPE_ORDER[a] ?? 50;
      const orderB = TYPE_ORDER[b] ?? 50;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'pt-BR');
    });

    const filterNameLabel = selectedType === 'TODOS' 
      ? 'Todos os Tipos de Baias (Geral do Centro)' 
      : (TYPE_TITLES[selectedType] || selectedType);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>SISBEM - Planilha de Manejo e Tratamentos por Baia</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 24px; 
            color: #0f172a; 
            font-size: 14px; 
            line-height: 1.45;
            background: #ffffff;
          }
          .header { 
            border-bottom: 2.5px solid #0d9488; 
            padding-bottom: 12px; 
            margin-bottom: 20px; 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-end; 
          }
          .header h1 { 
            margin: 0; 
            color: #0f766e; 
            font-size: 28px; 
            font-weight: 900; 
            letter-spacing: -0.5px;
          }
          .header h2 {
            margin: 2px 0 0 0;
            font-size: 16.5px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-meta { 
            text-align: right; 
            font-size: 13.5px; 
            color: #64748b; 
          }
          .header-meta strong { 
            color: #0f172a; 
            font-size: 14.5px; 
          }
          
          .summary-bar {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 18px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
            font-weight: 600;
            color: #475569;
          }
          .summary-bar span strong {
            color: #0d9488;
            font-weight: 800;
          }

          .section-block {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .section-title-wrap {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f1f5f9;
            border-left: 5px solid #0d9488;
            border-top: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #cbd5e1;
            padding: 10px 16px;
            border-radius: 6px 6px 0 0;
          }
          .section-title {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin: 0;
          }
          .section-count {
            font-size: 13px;
            font-weight: 800;
            background: #0d9488;
            color: #ffffff;
            padding: 4px 12px;
            border-radius: 12px;
          }

          table { 
            width: 100%; 
            border-collapse: collapse; 
            border: 1px solid #cbd5e1;
            border-top: none;
            background: #ffffff;
          }
          th { 
            background: #f8fafc; 
            text-align: left; 
            padding: 10px 12px; 
            border: 1px solid #cbd5e1; 
            font-size: 13.5px; 
            font-weight: 900; 
            text-transform: uppercase; 
            color: #475569; 
            letter-spacing: 0.3px;
          }
          td { 
            padding: 12px 10px; 
            border: 1px solid #cbd5e1; 
            vertical-align: top; 
          }
          tr:nth-child(even) {
            background-color: #fafafa;
          }

          .kennel-badge-box {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
            padding: 5px 12px;
            border-radius: 6px;
            font-weight: 900;
            font-size: 14.5px;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .animal-name { 
            font-size: 18px; 
            font-weight: 900; 
            color: #0f172a; 
            margin-bottom: 3px;
          }
          .animal-species {
            font-size: 13.5px; 
            font-weight: 700; 
            color: #64748b; 
            margin-bottom: 6px; 
            text-transform: uppercase;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 6px;
            font-size: 13px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 11.5px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .info-val {
            font-weight: 800;
            color: #1e293b;
            font-size: 13.5px;
          }
          .info-val.highlight {
            color: #0f766e;
          }

          .badge-tutor {
            display: block;
            margin-top: 5px;
            font-size: 12.5px;
            font-weight: 700;
            color: #4338ca;
            background: #eef2ff;
            border: 1px solid #e0e7ff;
            padding: 5px 9px;
            border-radius: 4px;
          }
          .badge-resgate {
            display: block;
            margin-top: 5px;
            font-size: 12.5px;
            font-weight: 700;
            color: #0f766e;
            background: #f0fdfa;
            border: 1px solid #ccfbf1;
            padding: 5px 9px;
            border-radius: 4px;
          }

          .diag-box {
            margin-top: 6px;
            padding: 8px 10px;
            background: #fffbeb;
            border-left: 3.5px solid #f59e0b;
            border-radius: 4px;
            font-size: 13px;
            color: #92400e;
            line-height: 1.4;
          }

          .prescription-item { 
            margin-bottom: 8px; 
            padding: 10px 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #0d9488;
            border-radius: 5px;
          }
          .prescription-item:last-child { 
            margin-bottom: 0; 
          }
          .med-name { 
            font-weight: 900; 
            color: #0f766e; 
            text-transform: uppercase; 
            font-size: 15.5px; 
            margin-bottom: 3px;
          }
          .med-details { 
            font-size: 14px; 
            color: #334155; 
            font-weight: 600;
            line-height: 1.4;
          }
          .med-meta { 
            display: flex;
            justify-content: space-between;
            font-size: 12px; 
            color: #64748b; 
            font-weight: 700; 
            margin-top: 5px; 
            text-transform: uppercase; 
          }
          .med-obs {
            margin-top: 5px;
            font-size: 13px;
            color: #b45309;
            font-style: italic;
          }

          .no-meds {
            padding: 14px;
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 6px;
            color: #64748b;
            font-size: 13px;
            font-style: italic;
          }

          .shifts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 6px;
            margin-bottom: 6px;
          }
          .shift-box {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 8px;
            background: #ffffff;
            min-height: 60px;
          }
          .shift-title {
            font-size: 12.5px;
            font-weight: 900;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .shift-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
          }

          .notes-box {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 10px;
            background: #ffffff;
            min-height: 56px;
            font-size: 12.5px;
            color: #64748b;
          }
          .checklist-item {
            font-size: 12.5px;
            color: #475569;
            margin-top: 3px;
          }

          .empty-msg { 
            text-align: center; 
            padding: 30px; 
            color: #94a3b8; 
            font-style: italic; 
            font-size: 15px;
          }

          @media print {
            body { padding: 0; font-size: 14px; }
            @page { margin: 8mm; size: landscape; }
            .no-print { display: none; }
            tr { page-break-inside: avoid; }
            .section-block { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>SISBEM • BEM-ESTAR ANIMAL</h1>
            <h2>Planilha de Tratamentos, Prescrições e Manejo • ${filterNameLabel}</h2>
          </div>
          <div class="header-meta">
            <div>Data de Emissão: <strong>${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></div>
            <div>Emitido por: <strong>${user?.name || 'Veterinário / Operador SISBEM'}</strong></div>
            <div>Setor / Tipo: <strong>${filterNameLabel}</strong></div>
            <div>Ordenação: <strong>Crescente por Número da Baia</strong></div>
          </div>
        </div>

        <div class="summary-bar">
          <span>Setor Selecionado: <strong>${filterNameLabel}</strong></span>
          <span>Total de Pacientes: <strong>${targetAnimals.length}</strong></span>
          <span>Grupos de Baias: <strong>${sortedGroupKeys.length}</strong></span>
          <span>Controle Diário: <strong>Manhã • Tarde • Noite</strong></span>
        </div>

        ${targetAnimals.length === 0 ? `
          <div class="empty-msg">Nenhum paciente em tratamento ou com acomodação registrada para o setor selecionado (${filterNameLabel}).</div>
        ` : sortedGroupKeys.map(groupKey => {
          const groupAnimals = groupsMap.get(groupKey) || [];
          const groupTitle = TYPE_TITLES[groupKey] || `Baias: ${groupKey}`;

          return `
            <div class="section-block">
              <div class="section-title-wrap">
                <h3 class="section-title">${groupTitle}</h3>
                <span class="section-count">${groupAnimals.length} ${groupAnimals.length === 1 ? 'paciente' : 'pacientes'}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 32%">Acomodação / Identificação do Animal</th>
                    <th style="width: 44%">Prescrições Médicas & Tratamento Ativo</th>
                    <th style="width: 24%">Controle de Aplicação & Manejo</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupAnimals.map(animal => {
                    const latestRecord = animal.historico && animal.historico.length > 0 
                      ? [...animal.historico].sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime())[0]
                      : null;
                    
                    const recipes = latestRecord?.receitas || [];
                    
                    // Formatação de Peso e Cor solicitadas pelo usuário
                    const pesoFormatted = animal.peso 
                      ? `${animal.peso.toString().replace('.', ',')} kg` 
                      : (latestRecord?.peso 
                          ? (latestRecord.peso.includes('kg') ? latestRecord.peso : `${latestRecord.peso} kg`)
                          : 'Não informado');

                    const corFormatted = animal.corPelagem?.trim() || 'Não informada';
                    const kennelName = animal.currentOccupation?.kennel?.name || animal.tipoAcomodacaoSugerida || 'Aguardando Alocação';

                    return `
                      <tr>
                        <td>
                          <div class="kennel-badge-box">
                            🏠 ${kennelName}
                          </div>
                          <div class="animal-name">${animal.nome}</div>
                          <div class="animal-species">${animal.especie} • ${animal.raca || 'SRD'}</div>

                          <div class="info-grid">
                            <div class="info-item">
                              <span class="info-label">⚖️ Peso</span>
                              <span class="info-val highlight">${pesoFormatted}</span>
                            </div>
                            <div class="info-item">
                              <span class="info-label">🎨 Cor / Pelagem</span>
                              <span class="info-val highlight">${corFormatted}</span>
                            </div>
                            <div class="info-item">
                              <span class="info-label">Sexo / Porte</span>
                              <span class="info-val">${animal.sexo || '-'} • ${animal.porte || '-'}${animal.castrado ? ' • Castrado(a)' : ''}</span>
                            </div>
                            <div class="info-item">
                              <span class="info-label">Idade Estimada</span>
                              <span class="info-val">${animal.idade || 'Não informada'}</span>
                            </div>
                          </div>

                          ${animal.numeroMicrochip ? `
                            <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
                              <strong>Microchip:</strong> ${animal.numeroMicrochip}
                            </div>
                          ` : ''}

                          ${animal.temTutor ? `
                            <div class="badge-tutor">
                              <strong>Tutor:</strong> ${animal.tutor?.nomeCompleto || animal.solicitante?.nomeCompleto || 'Paciente Particular'}
                              ${animal.tutor?.telefone ? ` • Tel: ${animal.tutor.telefone}` : ''}
                            </div>
                          ` : `
                            <div class="badge-resgate">
                              <strong>Origem:</strong> Resgate SISBEM ${animal.localResgate ? `(${animal.localResgate})` : ''}
                            </div>
                          `}

                          ${(latestRecord?.diagnosticoClinico || animal.motivo) ? `
                            <div class="diag-box">
                              <strong>Diagnóstico / Motivo:</strong> ${latestRecord?.diagnosticoClinico || animal.motivo}
                              ${animal.justificativaInternacao || latestRecord?.accommodationJustification ? `<br><em>Justificativa: ${animal.justificativaInternacao || latestRecord?.accommodationJustification}</em>` : ''}
                            </div>
                          ` : ''}
                        </td>

                        <td>
                          ${recipes.length > 0 ? recipes.map(r => `
                            <div class="prescription-item">
                              <div class="med-name">💊 ${r.medicamento}</div>
                              <div class="med-details">
                                <strong>Dose:</strong> ${r.dosagem} • <strong>Via:</strong> ${r.via} • <strong>Freq:</strong> ${r.frequencia} • <strong>Duração:</strong> ${r.duracao}
                              </div>
                              <div class="med-meta">
                                <span>Prescrito em: ${format(new Date(r.dataEmissao), 'dd/MM/yyyy')}</span>
                                ${r.frequencia ? `<span>Posologia: ${r.frequencia}</span>` : ''}
                              </div>
                              ${r.observacoes ? `<div class="med-obs">⚠️ Obs: ${r.observacoes}</div>` : ''}
                            </div>
                          `).join('') : `
                            <div class="no-meds">
                              <strong>Acompanhamento Clínico:</strong> Nenhuma medicação contínua registrada no último atendimento.
                              ${latestRecord?.tratamentoAmbulatorial ? `<div style="margin-top: 4px; color: #1e293b;"><strong>Conduta realizada:</strong> ${latestRecord.tratamentoAmbulatorial}</div>` : ''}
                            </div>
                          `}

                          ${latestRecord?.tratamentoAmbulatorial && recipes.length > 0 ? `
                            <div style="margin-top: 6px; padding: 6px 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 12px; color: #334155;">
                              <strong>TTO Ambulatorial Complementar:</strong> ${latestRecord.tratamentoAmbulatorial}
                            </div>
                          ` : ''}
                        </td>

                        <td>
                          <div class="shifts-grid">
                            <div class="shift-box">
                              <div class="shift-title">Manhã</div>
                              <div class="shift-label">Hora: _____</div>
                              <div class="shift-label" style="margin-top: 6px;">Visto: _____</div>
                            </div>
                            <div class="shift-box">
                              <div class="shift-title">Tarde</div>
                              <div class="shift-label">Hora: _____</div>
                              <div class="shift-label" style="margin-top: 6px;">Visto: _____</div>
                            </div>
                            <div class="shift-box">
                              <div class="shift-title">Noite</div>
                              <div class="shift-label">Hora: _____</div>
                              <div class="shift-label" style="margin-top: 6px;">Visto: _____</div>
                            </div>
                          </div>

                          <div class="notes-box">
                            <div style="font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11.5px; margin-bottom: 4px;">
                              Manejo / Alimentação:
                            </div>
                            <div class="checklist-item">[ ] Apetite normal [ ] Pouco</div>
                            <div class="checklist-item">[ ] Fezes / Urina normais</div>
                            <div style="margin-top: 6px; border-bottom: 1px dashed #e2e8f0;"></div>
                            <div style="margin-top: 4px; font-size: 11.5px;">Obs: __________________________</div>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
          <span>SISBEM • Sistema Integrado de Saúde e Bem-Estar Animal</span>
          <span>Documento gerado para controle interno de medicação e manejo de baias</span>
          <span>Responsável pelo Plantão: ___________________________________</span>
        </div>

        <script>
          window.onload = function() { 
            setTimeout(function() {
              window.print(); 
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Home className="text-teal-600" /> Controle de Baias e Acomodação
          </h2>
          <p className="text-slate-500">Gestão física e ocupacional das estruturas do centro.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Sincronizar baias e ocupações com o servidor agora"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-95 transition-all text-sm disabled:opacity-50"
          >
            <RotateCw size={16} className={`text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Atualizar Baias'}</span>
          </button>
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all cursor-pointer text-sm"
          >
            <Printer size={18} className="text-teal-600" /> Planilha de Tratamentos
          </button>
        </div>
      </div>

      {/* Fila de Acomodação (Pós-Veterinário) */}
      {waitingAnimals.length > 0 && (
        <section className="bg-amber-50 rounded-2xl border-2 border-amber-100 overflow-hidden shadow-sm">
          <div className="bg-amber-100/50 px-6 py-3 border-b border-amber-200 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-amber-600" />
            <h3 className="text-xs font-black uppercase text-amber-800 tracking-widest">Aguardando Acomodação (Pós-Triagem Veterinária)</h3>
            <span className="ml-auto bg-amber-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{waitingAnimals.length} animais</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-4 pb-2">
              {waitingAnimals.map(animal => {
                const latestRecord = animal.historico && animal.historico.length > 0
                  ? [...animal.historico].sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime())[0]
                  : null;
                const recKennelType = animal.tipoAcomodacaoSugerida || latestRecord?.recommendedKennelType;
                const recJustification = animal.justificativaInternacao || latestRecord?.accommodationJustification;

                return (
                  <div key={animal.id} className={`min-w-[320px] bg-white p-4 rounded-xl border shadow-sm space-y-3 shrink-0 ${animal.temTutor ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-amber-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{animal.nome}</p>
                          {animal.temTutor && (
                            <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                              Com Tutor (Internação)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{animal.especie} • {animal.raca}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${animal.temTutor ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        {animal.condicao}
                      </span>
                    </div>

                    {animal.temTutor && (animal.tutor || animal.solicitante) && (
                      <p className="text-[11px] font-semibold text-slate-600 truncate bg-slate-50 px-2 py-1 rounded">
                        Tutor: <span className="font-bold text-slate-800">{animal.tutor?.nomeCompleto || animal.solicitante?.nomeCompleto}</span>
                      </p>
                    )}

                    {/* Indicação do Veterinário */}
                    <div className={`p-2.5 rounded-lg border ${animal.temTutor ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[9px] font-black uppercase mb-1 flex items-center gap-1 ${animal.temTutor ? 'text-indigo-700' : 'text-teal-600'}`}>
                        <Info size={10} /> Indicação Veterinária {animal.temTutor ? 'de Internação' : 'de Acomodação'}
                      </p>
                      {recKennelType ? (
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-700">Tipo de Baia: <span className="text-indigo-700 font-black uppercase">{recKennelType}</span></p>
                          <p className="text-[10px] text-slate-500 italic line-clamp-2">"{recJustification || 'Sem justificativa detalhada'}"</p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">Sem indicação prévia de tipo de baia.</p>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        setAllocatingAnimal(animal);
                        setSelectedKennelId('');
                        setJustification(recJustification || (animal.temTutor ? 'Internação clínica autorizada pelo veterinário' : ''));
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-2 text-white text-xs font-bold rounded-lg transition-colors shadow-sm ${animal.temTutor ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                      Alocar Baia Agora <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Modal de Alocação Rápida */}
      {allocatingAnimal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className={`p-6 text-white ${allocatingAnimal.temTutor ? 'bg-indigo-900' : 'bg-slate-900'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2"><ArrowRightLeft size={20} /> Alocar {allocatingAnimal.nome}</h3>
                {allocatingAnimal.temTutor && (
                  <span className="bg-indigo-700 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Internação Externa
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-xs mt-1">
                {allocatingAnimal.temTutor 
                  ? 'Selecione a baia recomendada para a internação do animal com tutor.' 
                  : 'Selecione uma baia disponível para o animal.'}
              </p>
            </div>
            <form onSubmit={handleQuickAllocate} className="p-6 space-y-6">
              <div className="space-y-4">
                {(allocatingAnimal.tipoAcomodacaoSugerida || latestAllocatingRecord?.recommendedKennelType) && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${allocatingAnimal.temTutor ? 'bg-indigo-50 border-indigo-100' : 'bg-teal-50 border-teal-100'}`}>
                    <Info size={18} className={`mt-0.5 shrink-0 ${allocatingAnimal.temTutor ? 'text-indigo-600' : 'text-teal-600'}`} />
                    <div>
                      <p className={`text-xs font-black uppercase tracking-tighter ${allocatingAnimal.temTutor ? 'text-indigo-800' : 'text-teal-800'}`}>
                        Recomendação Médica {allocatingAnimal.temTutor ? '(Internação de Paciente Externo)' : ''}
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        Alocar em: <span className={`uppercase font-black ${allocatingAnimal.temTutor ? 'text-indigo-700' : 'text-teal-600'}`}>{allocatingAnimal.tipoAcomodacaoSugerida || latestAllocatingRecord?.recommendedKennelType}</span>
                      </p>
                      {(allocatingAnimal.justificativaInternacao || latestAllocatingRecord?.accommodationJustification) && (
                        <p className="text-xs text-slate-600 italic mt-1">
                          "{allocatingAnimal.justificativaInternacao || latestAllocatingRecord?.accommodationJustification}"
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selecione a Baia Disponível</label>
                  <select 
                    required 
                    value={selectedKennelId} 
                    onChange={e => setSelectedKennelId(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                  >
                    <option value="">-- Selecione uma baia --</option>
                    {kennels
                      .filter(k => {
                        const activeCount = occupations.filter(o => o.kennelId === k.id && !o.exitDate).length;
                        return activeCount < k.capacity;
                      })
                      .map(k => (
                        <option key={k.id} value={k.id}>
                          {k.name} - {k.type} (Vagas: {k.capacity - (occupations.filter(o => o.kennelId === k.id && !o.exitDate).length)})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Justificativa da Movimentação</label>
                  <input 
                    required 
                    type="text" 
                    value={justification} 
                    onChange={e => setJustification(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setAllocatingAnimal(null)} className="flex-1 px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 transition-all"><Save size={18} /> Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Escolha do Tipo de Baia para Impressão da Planilha */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 border border-slate-200">
            {/* Cabeçalho do Modal */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-600 rounded-xl shrink-0">
                  <Printer size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    Planilha de Tratamentos & Manejo
                  </h3>
                  <p className="text-xs text-slate-300">
                    Selecione qual setor/tipo de baia deseja imprimir ou emita a planilha de todas as baias.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Seção 1: Escolha do Tipo de Baia */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    1. Escolha o Setor ou Tipo de Baia:
                  </label>
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    Ordenação crescente por Baia
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {KENNEL_TYPE_PRINT_OPTIONS.map((opt) => {
                    const isSelected = printKennelTypeFilter === opt.id;
                    const IconComponent = opt.icon;
                    const count = printOnlyActiveTreatment 
                      ? (printCountsByType[opt.id]?.inTreatment || 0)
                      : (printCountsByType[opt.id]?.total || 0);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrintKennelTypeFilter(opt.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 relative cursor-pointer ${
                          isSelected 
                            ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20 shadow-sm' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <IconComponent size={18} />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-bold ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                              {opt.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {opt.desc}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              count > 0 
                                ? (isSelected ? 'bg-teal-200 text-teal-900' : 'bg-slate-200 text-slate-700') 
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {count} {count === 1 ? 'paciente' : 'pacientes'}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute top-3 right-3 text-teal-600">
                            <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seção 2: Critério de Filtragem */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">
                  2. Filtro de Pacientes:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    printOnlyActiveTreatment ? 'bg-white border-teal-500 shadow-sm ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-white bg-white/60'
                  }`}>
                    <input 
                      type="radio"
                      name="printScope"
                      checked={printOnlyActiveTreatment}
                      onChange={() => setPrintOnlyActiveTreatment(true)}
                      className="text-teal-600 focus:ring-teal-500 h-4 w-4 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Em Tratamento / Prescrição Ativa</div>
                      <div className="text-[10px] text-slate-500">Apenas animais com receitas e cuidados médicos</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    !printOnlyActiveTreatment ? 'bg-white border-teal-500 shadow-sm ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-white bg-white/60'
                  }`}>
                    <input 
                      type="radio"
                      name="printScope"
                      checked={!printOnlyActiveTreatment}
                      onChange={() => setPrintOnlyActiveTreatment(false)}
                      className="text-teal-600 focus:ring-teal-500 h-4 w-4 shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Todos Alojados no Setor</div>
                      <div className="text-[10px] text-slate-500">Manejo geral de rotina e alimentação</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Resumo da Impressão */}
              <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between font-bold text-teal-950">
                  <span className="flex items-center gap-1.5">
                    <Printer size={15} className="text-teal-600" />
                    Resumo da Emissão
                  </span>
                  <span className="bg-teal-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black">
                    {printOnlyActiveTreatment 
                      ? (printCountsByType[printKennelTypeFilter]?.inTreatment || 0)
                      : (printCountsByType[printKennelTypeFilter]?.total || 0)} pacientes selecionados
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div>
                    <strong>Setor da Impressão:</strong>{' '}
                    <span className="text-teal-900 font-bold">
                      {KENNEL_TYPE_PRINT_OPTIONS.find(o => o.id === printKennelTypeFilter)?.label || 'Todos'}
                    </span>
                  </div>
                  <div>
                    <strong>Ordem dos Pacientes:</strong> Crescente numérica (ex: Baia 01, Baia 02, Baia 03...).
                  </div>
                  <div>
                    <strong>Campos Inclusos:</strong> Peso, Cor/Pelagem, Prescrições Ativas com dosagem e horário, e grade de vistos por turno (Manhã • Tarde • Noite).
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé de Ações do Modal */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200/70 rounded-xl transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePrintTreatmentSheet(printKennelTypeFilter, printOnlyActiveTreatment);
                  setIsPrintModalOpen(false);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 transition-all text-sm cursor-pointer"
              >
                <Printer size={16} /> Imprimir Planilha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(s => (
          <div key={s.type} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none">{s.type}</p>
              {s.percent >= 90 ? <AlertTriangle size={14} className="text-red-500" /> : <CheckCircle size={14} className="text-emerald-500" />}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.occupied}/{s.capacity}</p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${s.percent >= 90 ? 'bg-red-500' : s.percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${s.percent}%` }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar baia pelo nome..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <select 
          className="bg-slate-50 border rounded-lg px-3 py-1.5 text-xs font-bold uppercase" 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="TODOS">Todos os Tipos</option>
          {Object.values(KennelType).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filteredKennels.map(kennel => {
          const { count, occupants } = getKennelData(kennel.id);
          const isFull = count >= kennel.capacity;
          return (
            <div key={kennel.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${isFull ? 'bg-red-50 border-red-100' : count > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isFull ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {kennel.type}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Cap: {kennel.capacity}</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{kennel.name}</h4>
              <p className="text-[10px] text-slate-500 font-medium mb-4">
                {count === 0 ? 'Disponível' : `${count} ocupante(s)`}
              </p>
              
              <div className="space-y-1.5">
                {occupants.map(occ => {
                  if (!occ) return null;
                  return (
                    <div key={occ.id} className="flex items-center justify-between gap-1 p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700">
                      <Link 
                        to={`/animais/ficha/${occ.id}`}
                        className="flex items-center gap-1.5 hover:text-teal-600 transition-colors truncate flex-1"
                        title="Ver Ficha"
                      >
                        <User size={10} className="text-teal-600 shrink-0" />
                        <span className="truncate">{occ.nome}</span>
                      </Link>
                      
                      {user && (user.role === 'ADMIN' || user.role === 'VETERINARIO') && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setAllocatingAnimal(occ);
                              setSelectedKennelId('');
                              setJustification(`Transferência de baia para melhor manejo.`);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-indigo-600 hover:text-indigo-800 transition-colors"
                            title="Trocar de Baia"
                          >
                            <ArrowRightLeft size={10} />
                          </button>
                          <button
                            onClick={() => handleRelease(occ.id, occ.nome)}
                            className="p-1 hover:bg-slate-100 rounded text-red-500 hover:text-red-700 transition-colors"
                            title="Desalocar"
                          >
                            <LogOut size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção de Histórico de Movimentações */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <History className="text-teal-600" size={18} />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Histórico Geral de Ocupações e Movimentações</h3>
          </div>
          <div className="text-[10px] font-bold text-slate-400">
            Total de movimentações: {occupations.length}
          </div>
        </div>
        
        {occupations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 italic text-sm">
            Nenhuma movimentação registrada no histórico.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Animal</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Acomodação</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Entrada</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Saída</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Justificativa</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...occupations]
                  .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                  .map(occ => {
                    const animal = allAnimals.find(a => a.id === occ.animalId);
                    const kennel = kennels.find(k => k.id === occ.kennelId);
                    const responsible = db.getUsers().find(u => u.id === occ.vetId);
                    
                    return (
                      <tr key={occ.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          {animal ? (
                            <Link to={`/animais/ficha/${animal.id}`} className="font-bold text-slate-900 hover:text-teal-600 transition-colors uppercase text-xs">
                              {animal.nome}
                            </Link>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Desconhecido</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {kennel ? `${kennel.name} (${kennel.type})` : 'Baia excluída'}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600 font-medium">
                          {format(new Date(occ.entryDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </td>
                        <td className="p-4 text-xs text-slate-600 font-medium">
                          {occ.exitDate ? (
                            format(new Date(occ.exitDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          ) : (
                            <span className="text-slate-400 italic">--</span>
                          )}
                        </td>
                        <td className="p-4">
                          {occ.exitDate ? (
                            <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                              Histórico
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                              Ativo
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-600 font-medium max-w-[200px] truncate" title={occ.justification}>
                          {occ.justification || <span className="text-slate-300 italic">Sem justificativa</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-500 font-semibold">
                          {responsible?.name || 'Sistema'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccommodationDashboard;
