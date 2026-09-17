
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/db';
import { ClinicalRecord, Prescription, Referral, AnimalCondicao, KennelType, AnimalJoined, ExamFile } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Clipboard, FileText, Activity, AlertCircle, CheckCircle2, Pill, PlusCircle, Skull, MapPin, FlaskConical, ClipboardCheck, Home, Calendar, MessageSquare, User, Info, Upload, X, FileSearch, HeartPulse, UserCircle, Phone, ArrowRightLeft, ExternalLink, Cpu, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DIAGNOSTIC_OPTIONS = [
  'Tumores',
  'Traumas',
  'Suspeita cinomose',
  'Suspeita parvovirose',
  'Suspeita esporotricose',
  'Suspeita envenenamento',
  'Suspeita hemoparasitose',
  'Miíases',
  'Outro'
];

const VeterinaryForm: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const user = useMemo(() => db.getCurrentUser(), []);
  const [animal, setAnimal] = useState<AnimalJoined | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mudarAcomodacao, setMudarAcomodacao] = useState(false);
  const [tipoObito, setTipoObito] = useState<'Óbito Natural' | 'Eutanásia'>('Óbito Natural');
  const [causaObitoInput, setCausaObitoInput] = useState('');
  
  // Internação para Animal Externo (Com Tutor)
  const [necessitaInternacaoExterno, setNecessitaInternacaoExterno] = useState<boolean>(false);
  const [tipoAcomodacaoExterno, setTipoAcomodacaoExterno] = useState<KennelType | ''>('');
  const [justificativaInternacaoExterno, setJustificativaInternacaoExterno] = useState<string>('');
  
  const [record, setRecord] = useState<Partial<ClinicalRecord>>({
    animalId: id,
    vacinas: '',
    parasitas: '',
    temperatura: '',
    peso: '',
    mucosa: '',
    palpacaoAbdominal: '',
    hidratacao: '',
    auscultaCardiaca: '',
    auscultaPulmonar: '',
    frequenciaCardiaca: '',
    frequenciaRespiratoria: '',
    observacoesGerais: '',
    examesSolicitados: '',
    tratamentoAmbulatorial: '',
    diagnosticoClinico: '',
    statusResultante: undefined,
    receitas: [],
    encaminhamentos: [],
    examesLaboratoriais: [],
    dataObito: '',
    causaObito: '',
    dataSoltura: '',
    localSoltura: '',
    recommendedKennelType: undefined,
    accommodationJustification: '',
    v10Aplicada: false,
    v10Data: '',
    antirrabicaAplicada: false,
    antirrabicaData: '',
    vermifugoAplicado: false,
    vermifugoData: '',
    microchipAplicado: false,
    numeroMicrochipAplicado: ''
  });

  useEffect(() => {
    if (user?.role !== 'VETERINARIO' && user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }

    const currentAnimal = db.getAnimalsJoined().find(a => a.id === id);
    setAnimal(currentAnimal);

    if (editId) {
      const existing = db.getRecords().find(r => r.id === editId);
      if (existing) {
        setRecord(existing);
        if (existing.necessitaInternacao !== undefined) {
          setNecessitaInternacaoExterno(existing.necessitaInternacao);
          if (existing.recommendedKennelType) setTipoAcomodacaoExterno(existing.recommendedKennelType);
          if (existing.accommodationJustification) setJustificativaInternacaoExterno(existing.accommodationJustification);
        }
      }
    } else if (currentAnimal) {
      setRecord(prev => ({
        ...prev,
        peso: prev.peso || currentAnimal.peso.toString(),
        animalId: id,
        statusResultante: currentAnimal.condicao,
        dataObito: new Date().toISOString().split('T')[0]
      }));
      if (currentAnimal.temTutor) {
        if (currentAnimal.necessitaInternacao || currentAnimal.condicao === AnimalCondicao.EM_TRATAMENTO) {
          setNecessitaInternacaoExterno(true);
          if (currentAnimal.tipoAcomodacaoSugerida) setTipoAcomodacaoExterno(currentAnimal.tipoAcomodacaoSugerida);
          if (currentAnimal.justificativaInternacao) setJustificativaInternacaoExterno(currentAnimal.justificativaInternacao);
        }
      }
    }
  }, [editId, user?.id, user?.role, navigate, id]);

  const handleAddPrescription = () => {
    const newP: any = {
      id: crypto.randomUUID(),
      medicamento: '',
      dosagem: '',
      via: '',
      frequencia: '',
      duracao: '',
      observacoes: '',
      animalId: id!,
      dataEmissao: new Date().toISOString()
    };
    setRecord({ ...record, receitas: [...(record.receitas || []), newP] });
  };

  const handlePrescriptionChange = (pId: string, field: keyof Prescription, value: string) => {
    const updated = record.receitas?.map(p => p.id === pId ? { ...p, [field]: value } : p);
    setRecord({ ...record, receitas: updated });
  };

  const handleRemovePrescription = (pId: string) => {
    setRecord({ ...record, receitas: record.receitas?.filter(p => p.id !== pId) });
  };

  const handleAddReferral = () => {
    const newR: Referral = {
      id: crypto.randomUUID(),
      especialidade: '',
      motivo: '',
      localSugerido: '',
      urgencia: 'BAIXA',
      dataEmissao: new Date().toISOString(),
      veterinarioId: user!.id,
      animalId: id!
    };
    setRecord({ ...record, encaminhamentos: [...(record.encaminhamentos || []), newR] });
  };

  const handleReferralChange = (rId: string, field: keyof Referral, value: string) => {
    const updated = record.encaminhamentos?.map(r => r.id === rId ? { ...r, [field]: value } : r);
    setRecord({ ...record, encaminhamentos: updated });
  };

  const handleRemoveReferral = (rId: string) => {
    setRecord({ ...record, encaminhamentos: record.encaminhamentos?.filter(r => r.id !== rId) });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("O arquivo é muito grande. Escolha algo de até 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const newExam: ExamFile = {
          id: crypto.randomUUID(),
          nomeExame: file.name.split('.')[0],
          arquivo: reader.result as string,
          dataAnexo: new Date().toISOString()
        };
        setRecord({ 
          ...record, 
          examesLaboratoriais: [...(record.examesLaboratoriais || []), newExam] 
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveExam = (examId: string) => {
    setRecord({ 
      ...record, 
      examesLaboratoriais: record.examesLaboratoriais?.filter(ex => ex.id !== examId) 
    });
  };

  const handleExamNameChange = (examId: string, newName: string) => {
    const updated = record.examesLaboratoriais?.map(ex => 
      ex.id === examId ? { ...ex, nomeExame: newName } : ex
    );
    setRecord({ ...record, examesLaboratoriais: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!id) {
      setError("Erro interno: Identificador do animal não encontrado.");
      return;
    }

    if (!animal?.temTutor) {
      if (record.statusResultante === AnimalCondicao.OBITO && (!record.dataObito || !record.causaObito)) {
        setError("Para o status Óbito, informe a data e a causa do falecimento.");
        return;
      }

      if (record.statusResultante === AnimalCondicao.SOLTURA && (!record.dataSoltura || !record.localSoltura)) {
        setError("Para o status Soltura, informe a data e o local da soltura.");
        return;
      }

      if (mudarAcomodacao && !record.accommodationJustification?.trim()) {
        setError("Por favor, preencha a justificativa para a mudança de acomodação.");
        return;
      }
    } else {
      // Validações para animal externo
      if (necessitaInternacaoExterno) {
        if (!tipoAcomodacaoExterno) {
          setError("Por favor, selecione o tipo de acomodação recomendada para a internação do animal.");
          return;
        }
        if (!justificativaInternacaoExterno.trim()) {
          setError("Por favor, preencha a justificativa técnica para a internação do animal.");
          return;
        }
      }
    }

    if (record.microchipAplicado && !record.numeroMicrochipAplicado?.trim()) {
      setError("Por favor, informe o código do microchip implantado.");
      return;
    }

    setLoading(true);
    try {
      const finalRecord = { ...record, animalId: id };
      
      if (finalRecord.statusResultante === AnimalCondicao.OBITO && finalRecord.causaObito) {
        const rawCausa = finalRecord.causaObito.trim();
        if (!rawCausa.toLowerCase().startsWith('eutana') && !rawCausa.toLowerCase().startsWith('eutaná') && !rawCausa.toLowerCase().startsWith('óbito natural') && !rawCausa.toLowerCase().startsWith('obito natural')) {
          finalRecord.causaObito = `${tipoObito} - ${rawCausa}`;
        }
      }

      // Tratamento de destinação/condição do animal externo
      if (animal?.temTutor) {
        if (necessitaInternacaoExterno) {
          finalRecord.statusResultante = AnimalCondicao.EM_TRATAMENTO;
          finalRecord.necessitaInternacao = true;
          finalRecord.recommendedKennelType = tipoAcomodacaoExterno as KennelType;
          finalRecord.accommodationJustification = justificativaInternacaoExterno.trim();
        } else {
          finalRecord.statusResultante = AnimalCondicao.ATENDIDO;
          finalRecord.necessitaInternacao = false;
          finalRecord.recommendedKennelType = undefined;
          finalRecord.accommodationJustification = undefined;
        }
      }
      
      db.saveRecord(finalRecord, user!.id);
      
      if (!animal?.temTutor && animal?.currentOccupation && mudarAcomodacao) {
        db.releaseAnimalFromKennel(id, record.accommodationJustification || 'Solicitado mudança de acomodação no atendimento técnico');
      }
      
      navigate(`/animais/ficha/${id}?tab=historico`); 
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao salvar o prontuário.');
    } finally {
      setLoading(false);
    }
  };

  if (!animal) return <div className="p-8 text-center text-slate-500 font-bold">Animal não encontrado.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{editId ? 'Editar Prontuário' : 'Atendimento Técnico'}</h2>
          <p className="text-sm text-slate-500">Paciente: <span className="font-bold text-teal-600 uppercase">{animal.nome}</span> {animal.temTutor && <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-200">Externo</span>}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <AlertCircle size={20} className="shrink-0" /><p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Painel de Contexto */}
        <section className={`p-8 rounded-2xl shadow-xl space-y-6 relative overflow-hidden transition-all duration-500 ${animal.temTutor ? 'bg-indigo-900' : 'bg-slate-900'} text-white`}>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            {animal.temTutor ? <HeartPulse size={120} /> : <Clipboard size={120} />}
          </div>
          
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            {animal.temTutor ? (
              <>
                <HeartPulse size={18} className="text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Queixa Principal / Motivo da Consulta</h3>
              </>
            ) : (
              <>
                <MapPin size={18} className="text-teal-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-teal-400">Contexto e Histórico de Resgate</h3>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {animal.temTutor ? (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight flex items-center gap-1.5">
                    <UserCircle size={10} /> Tutor Responsável
                  </p>
                  <p className="text-sm font-bold uppercase">{animal.tutor?.nomeCompleto || animal.solicitante?.nomeCompleto || 'Não Informado'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight flex items-center gap-1.5">
                    <Phone size={10} /> Contato do Tutor
                  </p>
                  <p className="text-sm font-bold">{animal.tutor?.telefone || animal.solicitante?.telefone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-tight flex items-center gap-1.5">
                    <Calendar size={10} /> Data Entrada
                  </p>
                  <p className="text-sm font-bold">
                    {format(new Date(animal.dataCadastro), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5">
                    <MapPin size={10} /> Local da Ocorrência
                  </p>
                  <p className="text-sm font-bold">{animal.localResgate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5">
                    <Calendar size={10} /> Data do Resgate
                  </p>
                  <p className="text-sm font-bold">
                    {format(new Date(animal.dataResgate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5">
                    <User size={10} /> Solicitante
                  </p>
                  <p className="text-sm font-bold truncate">{animal.solicitante?.nomeCompleto || 'Desconhecido'}</p>
                </div>
              </>
            )}
            <div className="space-y-1">
              <p className={`text-[10px] font-bold uppercase tracking-tight ${animal.temTutor ? 'text-indigo-300' : 'text-slate-400'}`}>Espécie / Sexo / Porte</p>
              <p className="text-sm font-bold">{animal.especie} • {animal.sexo} • {animal.porte}{animal.idade ? ` • ${animal.idade}` : ''}</p>
            </div>
          </div>

          <div className={`${animal.temTutor ? 'bg-indigo-800/40 border-indigo-700/50' : 'bg-slate-800/50 border-slate-700/50'} p-5 rounded-xl border`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${animal.temTutor ? 'text-indigo-400' : 'text-teal-400'}`}>
              <MessageSquare size={12} /> {animal.temTutor ? 'Relato do Tutor (Anamnese Inicial)' : 'Motivo / Relato do Resgate'}
            </p>
            <p className="text-sm text-white leading-relaxed italic font-medium">
              "{animal.motivo}"
            </p>
          </div>
        </section>

        {/* Sinais Vitais */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4 text-teal-600">
            <Activity size={18} />
            <h3 className="text-xs font-black uppercase tracking-widest">Sinais Vitais na Triagem</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Peso Atual (kg)</label><input type="text" value={record.peso} onChange={e => setRecord({...record, peso: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-bold" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Temperatura (°C)</label><input type="text" value={record.temperatura} onChange={e => setRecord({...record, temperatura: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">FC (bpm)</label><input type="text" value={record.frequenciaCardiaca} onChange={e => setRecord({...record, frequenciaCardiaca: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">FR (mpm)</label><input type="text" value={record.frequenciaRespiratoria} onChange={e => setRecord({...record, frequenciaRespiratoria: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
          </div>
        </section>

        {/* Avaliação Clínica Detalhada */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4 text-teal-600"><ClipboardCheck size={18} /><h3 className="text-xs font-black uppercase tracking-widest">Avaliação Clínica Detalhada</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Mucosa</label><input type="text" value={record.mucosa} onChange={e => setRecord({...record, mucosa: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Hidratação</label><input type="text" value={record.hidratacao} onChange={e => setRecord({...record, hidratacao: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Ausculta Cardíaca</label><input type="text" value={record.auscultaCardiaca} onChange={e => setRecord({...record, auscultaCardiaca: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Ausculta Pulmonar</label><input type="text" value={record.auscultaPulmonar} onChange={e => setRecord({...record, auscultaPulmonar: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" /></div>
            <div className="col-span-1 md:col-span-2 space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Palpação Abdominal</label><textarea rows={2} value={record.palpacaoAbdominal} onChange={e => setRecord({...record, palpacaoAbdominal: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Vacina V10</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.v10Aplicada === true} onChange={() => setRecord({...record, v10Aplicada: true})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.v10Aplicada === false} onChange={() => setRecord({...record, v10Aplicada: false, v10Data: ''})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Não</span>
                  </label>
                </div>
                {record.v10Aplicada && (
                  <div className="space-y-1 animate-in slide-in-from-top-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Data</label>
                    <input type="date" value={record.v10Data} onChange={e => setRecord({...record, v10Data: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Antirrábica</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.antirrabicaAplicada === true} onChange={() => setRecord({...record, antirrabicaAplicada: true})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.antirrabicaAplicada === false} onChange={() => setRecord({...record, antirrabicaAplicada: false, antirrabicaData: ''})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Não</span>
                  </label>
                </div>
                {record.antirrabicaAplicada && (
                  <div className="space-y-1 animate-in slide-in-from-top-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Data</label>
                    <input type="date" value={record.antirrabicaData} onChange={e => setRecord({...record, antirrabicaData: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Vermífugo</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.vermifugoAplicado === true} onChange={() => setRecord({...record, vermifugoAplicado: true})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={record.vermifugoAplicado === false} onChange={() => setRecord({...record, vermifugoAplicado: false, vermifugoData: ''})} className="text-teal-600 focus:ring-teal-500" />
                    <span className="text-xs font-bold text-slate-700">Não</span>
                  </label>
                </div>
                {record.vermifugoAplicado && (
                  <div className="space-y-1 animate-in slide-in-from-top-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Data</label>
                    <input type="date" value={record.vermifugoData} onChange={e => setRecord({...record, vermifugoData: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-[10px] font-black uppercase text-teal-700 tracking-wider flex items-center gap-1">
                  <Cpu size={12} /> Microchip
                </p>
                {animal?.microchipado ? (
                  <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg">
                    <span className="text-[9px] font-black uppercase text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200">Já Microchipado</span>
                    <p className="text-xs font-mono font-bold text-slate-800 mt-1.5 truncate" title={animal.numeroMicrochip}>{animal.numeroMicrochip || 'Código não cadastrado'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="microchipAtendimento" checked={record.microchipAplicado === true} onChange={() => setRecord({...record, microchipAplicado: true})} className="text-teal-600 focus:ring-teal-500" />
                        <span className="text-xs font-bold text-slate-700">Implantar Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="microchipAtendimento" checked={record.microchipAplicado === false} onChange={() => setRecord({...record, microchipAplicado: false, numeroMicrochipAplicado: ''})} className="text-teal-600 focus:ring-teal-500" />
                        <span className="text-xs font-bold text-slate-700">Não</span>
                      </label>
                    </div>
                    {record.microchipAplicado && (
                      <div className="space-y-1 animate-in slide-in-from-top-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <QrCode size={10} /> Código Microchip *
                        </label>
                        <input 
                          type="text" 
                          value={record.numeroMicrochipAplicado || ''} 
                          onChange={e => setRecord({...record, numeroMicrochipAplicado: e.target.value})} 
                          placeholder="Digite o código (Ex: 9810981...)" 
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-teal-500" 
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Diagnóstico e Conduta Clínica */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4 text-teal-600"><Clipboard size={18} /><h3 className="text-xs font-black uppercase tracking-widest">Diagnóstico e Conduta</h3></div>
          <div className="space-y-4">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-teal-600" />
                    Selecione o Diagnóstico / Suspeita
                  </label>
                  <select
                    value={
                      DIAGNOSTIC_OPTIONS.find(opt => opt.toLowerCase() === (record.diagnosticoClinico || '').toLowerCase() || (opt !== 'Outro' && (record.diagnosticoClinico || '').toLowerCase().startsWith(opt.toLowerCase()))) || (record.diagnosticoClinico ? 'Outro' : '')
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Outro') {
                        if (DIAGNOSTIC_OPTIONS.some(opt => opt !== 'Outro' && opt.toLowerCase() === (record.diagnosticoClinico || '').toLowerCase())) {
                          setRecord({ ...record, diagnosticoClinico: '' });
                        }
                      } else if (val) {
                        setRecord({ ...record, diagnosticoClinico: val });
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800 text-sm shadow-sm"
                  >
                    <option value="">-- Selecione uma opção --</option>
                    {DIAGNOSTIC_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase">Resumo / Detalhamento do Diagnóstico</label>
                  <input 
                    type="text" 
                    value={record.diagnosticoClinico || ''} 
                    onChange={e => setRecord({...record, diagnosticoClinico: e.target.value})} 
                    placeholder="Selecione ao lado ou digite o resumo detalhado do diagnóstico..."
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 text-sm shadow-sm" 
                  />
                </div>
              </div>

              {/* Botões / Tags para seleção rápida */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Opções Pré-definidas para Seleção Rápida:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DIAGNOSTIC_OPTIONS.map(opt => {
                    const isSelected = (record.diagnosticoClinico || '').toLowerCase().startsWith(opt.toLowerCase()) || (opt === 'Outro' && record.diagnosticoClinico && !DIAGNOSTIC_OPTIONS.some(o => o !== 'Outro' && (record.diagnosticoClinico || '').toLowerCase().startsWith(o.toLowerCase())));
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (opt === 'Outro') {
                            if (DIAGNOSTIC_OPTIONS.some(o => o !== 'Outro' && o.toLowerCase() === (record.diagnosticoClinico || '').toLowerCase())) {
                              setRecord({ ...record, diagnosticoClinico: '' });
                            }
                          } else {
                            setRecord({ ...record, diagnosticoClinico: opt });
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                          isSelected
                            ? 'bg-teal-600 text-white ring-2 ring-teal-400 font-extrabold'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Exames Complementares (Solicitação)</label><textarea rows={2} value={record.examesSolicitados} onChange={e => setRecord({...record, examesSolicitados: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">TTO Ambulatorial realizado</label><textarea rows={2} value={record.tratamentoAmbulatorial} onChange={e => setRecord({...record, tratamentoAmbulatorial: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Observações Gerais</label><textarea rows={3} value={record.observacoesGerais} onChange={e => setRecord({...record, observacoesGerais: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 resize-none" /></div>
          </div>
        </section>

        {/* ANEXAR EXAMES LABORATORIAIS */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2 text-teal-600">
              <FlaskConical size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Resultados de Exames / Imagem</h3>
            </div>
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              <Upload size={14} /> Anexar Resultado
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,application/pdf"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {record.examesLaboratoriais && record.examesLaboratoriais.length > 0 ? (
              record.examesLaboratoriais.map((ex) => (
                <div key={ex.id} className="group relative p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 hover:border-teal-400 transition-all">
                  <button 
                    type="button" 
                    onClick={() => handleRemoveExam(ex.id)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={12} />
                  </button>
                  
                  <div className="aspect-video rounded-lg overflow-hidden bg-slate-200 flex items-center justify-center border border-slate-100">
                    {ex.arquivo.startsWith('data:image') ? (
                      <img src={ex.arquivo} alt={ex.nomeExame} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <FileSearch size={32} />
                        <span className="text-[10px] font-bold uppercase mt-1">PDF / Documento</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Identificação do Exame</label>
                    <input 
                      type="text" 
                      value={ex.nomeExame} 
                      onChange={(e) => handleExamNameChange(ex.id, e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-teal-500" 
                    />
                  </div>
                  <p className="text-[8px] text-slate-400 uppercase font-medium">Anexado em: {format(new Date(ex.dataAnexo), 'dd/MM/yy HH:mm')}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full py-10 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                <p className="text-slate-400 text-sm">Nenhum exame laboratoriais anexado neste atendimento.</p>
              </div>
            )}
          </div>
        </section>

        {/* ENCAMINHAMENTO VETERINÁRIO */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <ArrowRightLeft size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Encaminhamento Veterinário ({record.encaminhamentos?.length || 0})</h3>
            </div>
            <button type="button" onClick={handleAddReferral} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors shadow-sm">
              <Plus size={14} /> Adicionar Encaminhamento
            </button>
          </div>
          
          <div className="space-y-6">
            {record.encaminhamentos && record.encaminhamentos.length > 0 ? (
              <div className="space-y-4">
                {record.encaminhamentos.map((r, index) => (
                  <div key={r.id} className="relative p-6 bg-indigo-50/30 border border-indigo-100 rounded-xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">Encaminhamento #{index + 1}</span>
                      <button type="button" onClick={() => handleRemoveReferral(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Especialidade / Serviço</label>
                        <input type="text" value={r.especialidade} onChange={e => handleReferralChange(r.id, 'especialidade', e.target.value)} placeholder="Ex: Cardiologia, Oftalmologia, RX..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Local Sugerido / Instituição</label>
                        <input type="text" value={r.localSugerido} onChange={e => handleReferralChange(r.id, 'localSugerido', e.target.value)} placeholder="Ex: Hospital Veterinário Regional" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prioridade / Urgência</label>
                        <select value={r.urgencia} onChange={e => handleReferralChange(r.id, 'urgencia', e.target.value as any)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-700">
                          <option value="BAIXA">BAIXA (Rotina)</option>
                          <option value="MEDIA">MÉDIA (Prioritário)</option>
                          <option value="ALTA">ALTA (Urgente)</option>
                          <option value="EMERGENCIA">EMERGÊNCIA (Imediato)</option>
                        </select>
                      </div>
                      <div className="md:col-span-12 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Justificativa Técnica / Motivo do Encaminhamento</label>
                        <textarea 
                          rows={3}
                          value={r.motivo} 
                          onChange={e => handleReferralChange(r.id, 'motivo', e.target.value)} 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                          placeholder="Descreva a necessidade do encaminhamento e suspeita clínica..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-slate-400 text-sm">Nenhum encaminhamento registrado.</p>
              </div>
            )}
          </div>
        </section>

        {/* Receituário Médico */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2 text-teal-600">
              <Pill size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Receituário Médico ({record.receitas?.length || 0})</h3>
            </div>
            <button type="button" onClick={handleAddPrescription} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-bold transition-colors shadow-sm">
              <Plus size={14} /> Adicionar Item
            </button>
          </div>
          
          <div className="space-y-6">
            {record.receitas && record.receitas.length > 0 ? (
              <div className="space-y-4">
                {record.receitas.map((p, index) => (
                  <div key={p.id} className="relative p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black bg-teal-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">Medicamento #{index + 1}</span>
                      <button type="button" onClick={() => handleRemovePrescription(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medicamento</label>
                        <input type="text" value={p.medicamento} onChange={e => handlePrescriptionChange(p.id, 'medicamento', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dosagem</label>
                        <input type="text" value={p.dosagem} onChange={e => handlePrescriptionChange(p.id, 'dosagem', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Via</label>
                        <input type="text" value={p.via} onChange={e => handlePrescriptionChange(p.id, 'via', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequência</label>
                        <input type="text" value={p.frequencia} onChange={e => handlePrescriptionChange(p.id, 'frequencia', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duração</label>
                        <input type="text" value={p.duracao} onChange={e => handlePrescriptionChange(p.id, 'duracao', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="md:col-span-12 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações do Medicamento</label>
                        <textarea 
                          rows={2}
                          value={p.observacoes} 
                          onChange={e => handlePrescriptionChange(p.id, 'observacoes', e.target.value)} 
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" 
                          placeholder="Instruções adicionais de aplicação ou cuidados..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-slate-400 text-sm">Nenhum medicamento prescrito.</p>
              </div>
            )}
          </div>
        </section>

        {/* Recomendação de Acomodação */}
        {!animal.temTutor && !animal.currentOccupation && (
          <section className="bg-slate-50 p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 border-b pb-4 text-slate-600"><Home size={18} /><h3 className="text-xs font-black uppercase tracking-widest">Recomendação Logística (Acomodação)</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Baia Recomendada</label>
                  <select 
                    value={record.recommendedKennelType}
                    onChange={e => setRecord({...record, recommendedKennelType: e.target.value as KennelType})}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold uppercase"
                  >
                    <option value="">-- Não Indicado --</option>
                    {Object.values(KennelType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Justificativa da Recomendação</label>
                  <input 
                    type="text" 
                    value={record.accommodationJustification} 
                    onChange={e => setRecord({...record, accommodationJustification: e.target.value})}
                    placeholder="Ex: Isolamento para quarentena..."
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                  />
               </div>
            </div>
          </section>
        )}

        {/* Conclusão do Atendimento */}
        {!animal.temTutor && (
          <section className="bg-teal-50 p-8 rounded-2xl border-2 border-teal-200 space-y-6 shadow-xl transition-all duration-500">
            <div className="flex items-center gap-2 border-b border-teal-200 pb-4 text-teal-800">
              <CheckCircle2 size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Conclusão do Atendimento</h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-3 max-w-md">
                <label className="text-sm font-bold text-teal-900">Nova Condição Técnica:</label>
                <div className="bg-white p-2 rounded-xl border border-teal-200">
                  <select required value={record.statusResultante} onChange={e => setRecord({...record, statusResultante: e.target.value as AnimalCondicao})} className="w-full bg-transparent p-2 text-sm font-black outline-none uppercase text-teal-700">
                    <option value={AnimalCondicao.ACOLHIDO}>-- Manter em Acolhimento --</option>
                    <option value={AnimalCondicao.EM_TRATAMENTO}>Mudar para: EM TRATAMENTO</option>
                    <option value={AnimalCondicao.DISPONIVEL_ADOCAO}>Mudar para: DISPONÍVEL PARA ADOÇÃO</option>
                    <option value={AnimalCondicao.OBITO}>Mudar para: ÓBITO</option>
                    <option value={AnimalCondicao.SOLTURA}>Mudar para: SOLTURA</option>
                  </select>
                </div>
              </div>

              {animal.currentOccupation && (
                <div className="space-y-3 max-w-xl">
                  <label className="text-sm font-bold text-teal-900 block">Movimentação Logística:</label>
                  <label className="flex items-start gap-3 bg-white p-4 rounded-xl border border-teal-200 cursor-pointer select-none hover:bg-teal-50/50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={mudarAcomodacao} 
                      onChange={e => setMudarAcomodacao(e.target.checked)} 
                      className="mt-1 h-4 w-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <ArrowRightLeft size={14} className="text-teal-600" /> Mudar de Acomodação
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        O animal está atualmente em: <span className="font-semibold text-slate-700">{animal.currentOccupation.kennel?.name || 'Baia'}</span>. 
                        Ao marcar esta opção, o animal será desalocado da baia atual e voltará para a fila de acomodação para que a equipe possa realocá-lo em uma baia mais adequada.
                      </p>
                    </div>
                  </label>

                  {mudarAcomodacao && (
                    <div className="bg-white p-5 rounded-xl border border-teal-200 mt-3 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Recomendar Novo Tipo de Acomodação</label>
                        <select 
                          value={record.recommendedKennelType || ''}
                          onChange={e => setRecord({...record, recommendedKennelType: e.target.value ? e.target.value as KennelType : undefined})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold uppercase text-teal-700"
                        >
                          <option value="">-- Selecione uma recomendação --</option>
                          {Object.values(KennelType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Justificativa da Mudança *</label>
                        <textarea 
                          required={mudarAcomodacao}
                          value={record.accommodationJustification || ''} 
                          onChange={e => setRecord({...record, accommodationJustification: e.target.value})}
                          placeholder="Ex: Apresentou melhora e pode ir para baia coletiva, necessita de isolamento para quarentena..."
                          rows={2}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {record.statusResultante === AnimalCondicao.OBITO && (
                <div className="bg-white p-6 rounded-xl border border-red-100 space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-red-600"><Skull size={18} /><h4 className="text-xs font-black uppercase tracking-widest">Dados do Falecimento</h4></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Classificação / Tipo do Óbito *</label>
                        <select 
                          value={tipoObito} 
                          onChange={e => setTipoObito(e.target.value as 'Óbito Natural' | 'Eutanásia')} 
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-400 text-sm font-bold"
                        >
                          <option value="Óbito Natural">Óbito Natural</option>
                          <option value="Eutanásia">Eutanásia</option>
                        </select>
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Data do Óbito *</label><input type="date" required value={record.dataObito} onChange={e => setRecord({...record, dataObito: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-400 text-sm font-bold" /></div>
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Causa Provável *</label><input type="text" required value={record.causaObito} onChange={e => setRecord({...record, causaObito: e.target.value})} placeholder="Ex: Parada Cardiorrespiratória" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-400 text-sm" /></div>
                  </div>
                </div>
              )}

              {record.statusResultante === AnimalCondicao.SOLTURA && (
                <div className="bg-white p-6 rounded-xl border border-teal-100 space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-teal-600"><MapPin size={18} /><h4 className="text-xs font-black uppercase tracking-widest">Dados da Soltura Técnica</h4></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Data da Soltura *</label><input type="date" required value={record.dataSoltura} onChange={e => setRecord({...record, dataSoltura: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-400 text-sm font-bold" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Local Planejado *</label><input type="text" required value={record.localSoltura} onChange={e => setRecord({...record, localSoltura: e.target.value})} placeholder="Ex: Área de preservação X" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-400 text-sm" /></div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Decisão de Internação e Destino do Animal Externo (Com Tutor) */}
        {animal.temTutor && (
          <section className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 p-8 rounded-2xl border-2 border-indigo-200 space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-4">
              <div className="flex items-center gap-3 text-indigo-950">
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                  <Home size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Internação e Destino do Animal Externo</h3>
                  <p className="text-xs text-indigo-700 font-medium">Defina a conduta pós-atendimento e a necessidade de internação no Centro de Bem-Estar</p>
                </div>
              </div>
              <span className={`self-start sm:self-auto px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${necessitaInternacaoExterno ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                {necessitaInternacaoExterno ? 'Internação Indicada' : 'Alta Ambulatorial'}
              </span>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-indigo-600" />
                  Será necessária a internação do animal? *
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Opção NÃO */}
                  <div
                    onClick={() => {
                      setNecessitaInternacaoExterno(false);
                      setTipoAcomodacaoExterno('');
                      setJustificativaInternacaoExterno('');
                    }}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      !necessitaInternacaoExterno 
                        ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                        : 'bg-white/60 border-slate-200 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <input 
                      type="radio" 
                      id="internacao-nao"
                      name="necessitaInternacao" 
                      checked={!necessitaInternacaoExterno} 
                      onChange={() => {
                        setNecessitaInternacaoExterno(false);
                        setTipoAcomodacaoExterno('');
                        setJustificativaInternacaoExterno('');
                      }}
                      className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="internacao-nao" className="space-y-1 cursor-pointer">
                      <p className="text-sm font-black text-slate-900 uppercase">Não - Alta Ambulatorial (Liberar com Tutor)</p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        O paciente está estável e o tratamento continuará em casa pelo tutor com as receitas e orientações emitidas. Status final: <strong>Atendido</strong>.
                      </p>
                    </label>
                  </div>

                  {/* Opção SIM */}
                  <div
                    onClick={() => setNecessitaInternacaoExterno(true)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      necessitaInternacaoExterno 
                        ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20' 
                        : 'bg-white/60 border-slate-200 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <input 
                      type="radio" 
                      id="internacao-sim"
                      name="necessitaInternacao" 
                      checked={necessitaInternacaoExterno} 
                      onChange={() => setNecessitaInternacaoExterno(true)}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="internacao-sim" className="space-y-1 cursor-pointer">
                      <p className="text-sm font-black text-indigo-900 uppercase">Sim - Necessita de Internação / Acomodação</p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        O paciente necessita permanecer internado no Centro para fluidoterapia, medicação contínua ou monitoramento. Irá para a <strong>Fila de Acomodação</strong>.
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Campos específicos caso necessite internação */}
              {necessitaInternacaoExterno && (
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wider border-b border-indigo-50 pb-3">
                    <ClipboardCheck size={16} className="text-indigo-600" />
                    Indicação do Tipo de Acomodação & Encaminhamento para a Fila de Baias
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Tipo de Acomodação Indicada *</span>
                        <span className="text-[10px] text-indigo-600 font-bold">Obrigatório</span>
                      </label>
                      <select 
                        required={necessitaInternacaoExterno}
                        value={tipoAcomodacaoExterno}
                        onChange={e => setTipoAcomodacaoExterno(e.target.value as KennelType)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold uppercase text-indigo-950 cursor-pointer"
                      >
                        <option value="">-- Selecione o Tipo de Baia --</option>
                        {Object.values(KennelType).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        O veterinário indica o tipo de acomodação adequada para o quadro clínico do paciente (ex: Quarentena, Individual, etc).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                        <span>Justificativa Técnica / Motivo da Internação *</span>
                        <span className="text-[10px] text-indigo-600 font-bold">Obrigatório</span>
                      </label>
                      <textarea 
                        required={necessitaInternacaoExterno}
                        rows={3}
                        value={justificativaInternacaoExterno}
                        onChange={e => setJustificativaInternacaoExterno(e.target.value)}
                        placeholder="Ex: Paciente com desidratação e gastroenterite, necessitando fluidoterapia venosa contínua e medicação injetável..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800 resize-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3">
                    <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                      Ao salvar este atendimento, o animal externo será registrado com a indicação médica e entrará imediatamente na <strong>Fila de Acomodação</strong> no menu Controle de Baias, onde a equipe poderá alocar a baia física recomendada.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl">Cancelar</button>
          <button type="submit" disabled={loading} className={`flex items-center gap-2 px-10 py-3 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all ${animal.temTutor ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'}`}><Save size={18} /> {loading ? 'Salvando...' : 'Finalizar Atendimento'}</button>
        </div>
      </form>
    </div>
  );
};

export default VeterinaryForm;
