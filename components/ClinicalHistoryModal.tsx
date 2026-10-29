import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ClinicalRecord, 
  ClinicalRecordAddendum,
  AnimalJoined, 
  User, 
  AnimalCondicao, 
  Prescription, 
  Referral, 
  ExamFile 
} from '../types';
import { db } from '../services/db';
import { fetchClinicalRecordsByAnimalId } from '../src/lib/supabaseQueries';
import { addClinicalRecordAddendum } from '../src/lib/attendanceService';
import { generatePrintHTML } from '../utils/printPrescription';
import { printClinicalRecord } from '../utils/printClinicalRecord';
import { printAnimalSheet } from '../utils/printAnimalSheet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Stethoscope, 
  Activity, 
  ClipboardCheck, 
  Thermometer, 
  HeartPulse, 
  Wind, 
  Droplets, 
  Pill, 
  ArrowRightLeft, 
  FlaskConical, 
  User as UserIcon, 
  AlertCircle, 
  RefreshCw, 
  Syringe, 
  Cpu, 
  Printer, 
  MessageSquare, 
  ExternalLink, 
  Calendar, 
  Scale, 
  Eye, 
  Home, 
  FileSearch,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus
} from 'lucide-react';

interface ClinicalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: AnimalJoined;
  currentEditId?: string | null;
}

const safeFormatDate = (dateStr?: string | null, formatPattern: string = 'dd/MM/yyyy', fallback: string = '-') => {
  if (!dateStr) return fallback;
  try {
    const trimmed = String(dateStr).trim();
    if (!trimmed) return fallback;
    const parsed = trimmed.includes('T') ? new Date(trimmed) : new Date(`${trimmed}T12:00:00`);
    if (isNaN(parsed.getTime())) return fallback;
    return format(parsed, formatPattern, { locale: ptBR });
  } catch {
    return fallback;
  }
};

export const ClinicalHistoryModal: React.FC<ClinicalHistoryModalProps> = ({
  isOpen,
  onClose,
  animal,
  currentEditId
}) => {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; title: string } | null>(null);

  const users = useMemo(() => db.getUsers(), []);

  // Carrega o histórico clínico do animal APENAS quando o modal é aberto (Lazy Loading)
  const loadHistory = useCallback(async () => {
    if (!animal?.id) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Tenta buscar no Supabase através do serviço existente
      const fetchedRecords = await fetchClinicalRecordsByAnimalId(animal.id);

      // 2. Filtra eventuais registros inativos e, se estiver em modo de edição, ignora o prontuário atual
      const validRecords = (fetchedRecords || [])
        .filter(r => !r.inativo && (!currentEditId || r.id !== currentEditId))
        .sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());

      setRecords(validRecords);

      // Expande automaticamente o atendimento mais recente para facilitar a leitura imediata
      if (validRecords.length > 0) {
        setExpandedRecordIds({ [validRecords[0].id]: true });
      }
    } catch (err: any) {
      console.warn('[ClinicalHistoryModal] Erro ao buscar registros:', err);
      // Fallback seguro para o armazenamento local caso a rede falhe
      try {
        const localRecords = db.getRecords()
          .filter(r => r.animalId === animal.id && !r.inativo && (!currentEditId || r.id !== currentEditId))
          .sort((a, b) => new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime());

        if (localRecords.length > 0) {
          setRecords(localRecords);
          setExpandedRecordIds({ [localRecords[0].id]: true });
        } else {
          setError('Não foi possível carregar o histórico clínico. Tente novamente.');
        }
      } catch {
        setError('Não foi possível carregar o histórico clínico. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [animal?.id, currentEditId]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  // Suporte à tecla ESC para fechar sem perder foco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (viewingAttachment) {
          setViewingAttachment(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, viewingAttachment]);

  const toggleRecord = (recordId: string) => {
    setExpandedRecordIds(prev => ({
      ...prev,
      [recordId]: !prev[recordId]
    }));
  };

  const toggleAll = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    records.forEach(r => {
      newState[r.id] = expand;
    });
    setExpandedRecordIds(newState);
  };

  // Impressão segura compatível com iframes do ambiente
  const printHtmlSafely = (html: string) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }, 250);
      }
    } catch (err) {
      console.warn('Erro ao disparar impressão:', err);
    }
  };

  const handlePrintPrescriptions = (record: ClinicalRecord) => {
    if (!record.receitas || record.receitas.length === 0) return;
    const vet = users.find(u => u.id === record.veterinarioId);
    const html = generatePrintHTML(
      'Receituário Veterinário (Histórico)',
      animal,
      vet,
      record.receitas,
      'PRESCRIPTION'
    );
    printHtmlSafely(html);
  };

  const handlePrintReferrals = (record: ClinicalRecord) => {
    if (!record.encaminhamentos || record.encaminhamentos.length === 0) return;
    const vet = users.find(u => u.id === record.veterinarioId);
    const html = generatePrintHTML(
      'Guia de Encaminhamento Veterinário (Histórico)',
      animal,
      vet,
      record.encaminhamentos,
      'REFERRAL'
    );
    printHtmlSafely(html);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-2xl shadow-inner shrink-0">
              <History size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-950/60 border border-teal-800/60 px-2.5 py-0.5 rounded-full">
                  Consulta de Prontuários Anteriores
                </span>
                {animal.temTutor && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-0.5 rounded-full">
                    Animal com Tutor
                  </span>
                )}
              </div>
              <h2 id="history-modal-title" className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-1">
                Histórico Clínico: <span className="text-teal-300">{animal.nome}</span>
              </h2>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                <span>{animal.especie}</span>
                <span>•</span>
                <span>{animal.raca || 'SRD'}</span>
                <span>•</span>
                <span>{animal.sexo}</span>
                {animal.porte && (
                  <>
                    <span>•</span>
                    <span>Porte {animal.porte}</span>
                  </>
                )}
                {animal.idade && (
                  <>
                    <span>•</span>
                    <span>{animal.idade}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {records.length > 0 && !loading && !error && (
              <div className="flex items-center gap-1.5 mr-2">
                <button
                  type="button"
                  onClick={() => toggleAll(true)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  title="Expandir todos os prontuários"
                >
                  <ChevronDown size={13} /> Expandir Todos
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  title="Recolher todos os prontuários"
                >
                  <ChevronUp size={13} /> Recolher
                </button>
                <button
                  type="button"
                  onClick={() => printAnimalSheet(animal)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  title="Imprimir Ficha Completa com Todo o Histórico"
                >
                  <Printer size={13} /> Imprimir Ficha Completa
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              aria-label="Fechar consulta de histórico"
              title="Fechar consulta (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ÁREA DE ROLAGEM COM OS REGISTROS */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-100/60">
          
          {/* ESTADO: CARREGANDO */}
          {loading && (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <RefreshCw className="animate-spin text-teal-600 mx-auto" size={36} />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Carregando histórico clínico...</h3>
                <p className="text-xs text-slate-500">Consultando atendimentos anteriores registrados no SISBEM</p>
              </div>
            </div>
          )}

          {/* ESTADO: ERRO */}
          {!loading && error && (
            <div className="py-12 px-6 text-center space-y-4 bg-white rounded-2xl border border-rose-200 shadow-sm">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Não foi possível carregar o histórico clínico. Tente novamente.</h3>
                <p className="text-xs text-slate-500">Ocorreu uma falha na consulta aos registros. O atendimento atual não foi afetado.</p>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
              >
                <RefreshCw size={15} /> Tentar Novamente
              </button>
            </div>
          )}

          {/* ESTADO: NENHUM REGISTRO */}
          {!loading && !error && records.length === 0 && (
            <div className="py-16 px-6 text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <History size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Este animal ainda não possui atendimentos clínicos registrados.
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Este é o primeiro atendimento registrado para o paciente <strong className="text-slate-700 uppercase">{animal.nome}</strong> no sistema. As informações preenchidas nesta consulta comporão seu prontuário permanente.
              </p>
            </div>
          )}

          {/* LISTA DE PRONTUÁRIOS (DO MAIS RECENTE AO MAIS ANTIGO) */}
          {!loading && !error && records.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-teal-600" />
                  {records.length} {records.length === 1 ? 'atendimento anterior encontrado' : 'atendimentos anteriores encontrados'}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">Ordem cronológica decrescente</span>
              </div>

              {records.map((rec, index) => {
                const isExpanded = !!expandedRecordIds[rec.id];
                const vet = users.find(u => u.id === rec.veterinarioId);
                const prescCount = rec.receitas?.length || 0;
                const refCount = rec.encaminhamentos?.length || 0;
                const examCount = (rec.examesLaboratoriais?.length || 0) + (rec.examesSolicitados ? 1 : 0);

                return (
                  <div 
                    key={rec.id} 
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-teal-300"
                  >
                    {/* BARRA DE CABEÇALHO DO CARTÃO DO PRONTUÁRIO */}
                    <div 
                      onClick={() => toggleRecord(rec.id)}
                      className="p-4 bg-slate-50 hover:bg-slate-100/90 cursor-pointer border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-sm shrink-0">
                          <ClipboardCheck size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 uppercase">
                              Atendimento #{records.length - index} • {safeFormatDate(rec.dataAtendimento, "dd/MM/yyyy 'às' HH:mm")}
                            </span>
                            {rec.statusResultante && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                rec.statusResultante === AnimalCondicao.OBITO 
                                  ? 'bg-rose-100 text-rose-700 border-rose-200' 
                                  : rec.statusResultante === AnimalCondicao.EM_TRATAMENTO 
                                  ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}>
                                {rec.statusResultante}
                              </span>
                            )}
                            {rec.adendos && rec.adendos.length > 0 && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase border bg-teal-100 text-teal-800 border-teal-300 flex items-center gap-1">
                                <MessageSquare size={10} /> {rec.adendos.length} {rec.adendos.length === 1 ? 'complemento' : 'complementos'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 font-bold uppercase flex items-center gap-1.5 mt-0.5">
                            <UserIcon size={12} className="text-slate-400" /> 
                            Veterinário(a): <span className="text-slate-800 font-black">{vet?.name || 'Veterinário(a)'}</span>
                            {vet?.crmv && <span className="text-slate-400 font-normal">• CRMV: {vet.crmv}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rec.peso && (
                            <span className="text-[10px] font-black bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg uppercase shadow-2xs">
                              Peso: {rec.peso} kg
                            </span>
                          )}
                          {prescCount > 0 && (
                            <span className="text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                              <Pill size={11} /> {prescCount} receita(s)
                            </span>
                          )}
                          {refCount > 0 && (
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                              <ArrowRightLeft size={11} /> {refCount} guia(s)
                            </span>
                          )}
                          {examCount > 0 && (
                            <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg uppercase flex items-center gap-1">
                              <FlaskConical size={11} /> {examCount} exame(s)
                            </span>
                          )}
                          {rec.microchipAplicado && (
                            <span className="text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg uppercase flex items-center gap-1 font-mono">
                              <Cpu size={11} /> Chip
                            </span>
                          )}
                        </div>



                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            printClinicalRecord(rec, animal);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 hover:text-teal-700 hover:bg-slate-50 border border-slate-300 hover:border-teal-300 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-2xs hover:shadow-xs cursor-pointer ml-1"
                          title="Imprimir Prontuário Clínico deste atendimento"
                        >
                          <Printer size={13} className="text-teal-600" /> Imprimir Prontuário
                        </button>

                        <button 
                          type="button"
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors ml-1"
                          aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* CONTEÚDO EXPANDIDO DO PRONTUÁRIO */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 space-y-5 bg-white">
                        
                        {/* 1. DIAGNÓSTICO & CONDUTA / TRATAMENTO INSTITUÍDO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-1.5 text-teal-800 font-black text-xs uppercase tracking-wider">
                              <Stethoscope size={15} className="text-teal-600" /> Diagnóstico / Suspeita Clínica
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {rec.diagnosticoClinico || 'Não informado'}
                            </p>
                          </div>

                          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
                            <div className="flex items-center gap-1.5 text-blue-800 font-black text-xs uppercase tracking-wider">
                              <Activity size={15} className="text-blue-600" /> Tratamento Instituído / Conduta
                            </div>
                            <p className="text-xs font-semibold text-blue-950 leading-relaxed whitespace-pre-wrap">
                              {rec.tratamentoAmbulatorial || 'Sem procedimentos registrados'}
                            </p>
                          </div>
                        </div>

                        {/* 2. QUEIXA PRINCIPAL / ANAMNESE / OBSERVAÇÕES CLÍNICAS */}
                        {rec.observacoesGerais && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <MessageSquare size={13} className="text-slate-400" /> Queixa Principal / Anamnese / Observações Gerais
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {rec.observacoesGerais}
                            </p>
                          </div>
                        )}

                        {/* 3. EXAME FÍSICO & SINAIS VITAIS */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 px-1">
                            <ClipboardCheck size={14} className="text-slate-500" /> Exame Clínico & Sinais Vitais
                          </h4>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                <Thermometer size={11} className="text-teal-600" /> Temperatura
                              </p>
                              <p className="text-xs font-bold text-slate-800">{rec.temperatura ? `${rec.temperatura} °C` : '--'}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                <HeartPulse size={11} className="text-rose-500" /> Freq. Cardíaca
                              </p>
                              <p className="text-xs font-bold text-slate-800">{rec.frequenciaCardiaca ? `${rec.frequenciaCardiaca} bpm` : '--'}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                <Wind size={11} className="text-sky-500" /> Freq. Respiratória
                              </p>
                              <p className="text-xs font-bold text-slate-800">{rec.frequenciaRespiratoria ? `${rec.frequenciaRespiratoria} mpm` : '--'}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                                <Droplets size={11} className="text-blue-500" /> Hidratação
                              </p>
                              <p className="text-xs font-bold text-slate-800">{rec.hidratacao || '--'}</p>
                            </div>
                          </div>

                          {/* Avaliação de Sistemas */}
                          {(rec.mucosa || rec.palpacaoAbdominal || rec.auscultaCardiaca || rec.auscultaPulmonar) && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Mucosa</span>
                                  <span className="font-bold text-slate-700">{rec.mucosa || '--'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Palpação Abdominal</span>
                                  <span className="font-bold text-slate-700">{rec.palpacaoAbdominal || '--'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Ausculta Cardíaca</span>
                                  <span className="font-bold text-slate-700">{rec.auscultaCardiaca || '--'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Ausculta Pulmonar</span>
                                  <span className="font-bold text-slate-700">{rec.auscultaPulmonar || '--'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Aplicações no atendimento */}
                          {(rec.v10Aplicada || rec.antirrabicaAplicada || rec.vermifugoAplicado || rec.microchipAplicado || rec.vacinas || rec.parasitas) && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-2 items-center text-xs">
                              <span className="text-[10px] font-black uppercase text-slate-400 mr-2 flex items-center gap-1">
                                <Syringe size={12} className="text-teal-600" /> Aplicações Registradas:
                              </span>
                              {rec.v10Aplicada && (
                                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 font-bold rounded-lg text-[10px] uppercase border border-teal-200">
                                  Vacina V10 {rec.v10Data ? `(${rec.v10Data})` : ''}
                                </span>
                              )}
                              {rec.antirrabicaAplicada && (
                                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg text-[10px] uppercase border border-indigo-200">
                                  Antirrábica {rec.antirrabicaData ? `(${rec.antirrabicaData})` : ''}
                                </span>
                              )}
                              {rec.vermifugoAplicado && (
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-[10px] uppercase border border-amber-200">
                                  Vermífugo {rec.vermifugoData ? `(${rec.vermifugoData})` : ''}
                                </span>
                              )}
                              {rec.microchipAplicado && (
                                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-bold rounded-lg text-[10px] uppercase border border-purple-200 font-mono">
                                  Microchip: {rec.numeroMicrochipAplicado || 'Implantado'}
                                </span>
                              )}
                              {rec.vacinas && !rec.v10Aplicada && !rec.antirrabicaAplicada && (
                                <span className="text-slate-600 font-medium text-xs">Vacinas: {rec.vacinas}</span>
                              )}
                              {rec.parasitas && (
                                <span className="text-slate-600 font-medium text-xs">Parasitas: {rec.parasitas}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 4. PRESCRIÇÕES E MEDICAMENTOS */}
                        {rec.receitas && rec.receitas.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-700 flex items-center gap-1.5">
                                <Pill size={14} className="text-teal-600" /> Prescrições & Medicamentos ({rec.receitas.length})
                              </h4>
                              <button
                                type="button"
                                onClick={() => handlePrintPrescriptions(rec)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition cursor-pointer"
                              >
                                <Printer size={12} /> Imprimir Receita
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {rec.receitas.map((r, rIdx) => (
                                <div key={r.id || rIdx} className="p-3.5 bg-teal-50/40 border border-teal-100 rounded-xl space-y-1">
                                  <div className="flex justify-between items-start">
                                    <p className="text-xs font-black text-teal-900 uppercase">{r.medicamento}</p>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-teal-200 rounded text-teal-700 uppercase">
                                      {r.via || 'Oral'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-bold text-slate-700">
                                    {r.dosagem} • {r.frequencia} • {r.duracao}
                                  </p>
                                  {r.observacoes && (
                                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                                      Obs: {r.observacoes}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. ENCAMINHAMENTOS VETERINÁRIOS */}
                        {rec.encaminhamentos && rec.encaminhamentos.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1.5">
                                <ArrowRightLeft size={14} className="text-indigo-600" /> Guias de Encaminhamento ({rec.encaminhamentos.length})
                              </h4>
                              <button
                                type="button"
                                onClick={() => handlePrintReferrals(rec)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition cursor-pointer"
                              >
                                <Printer size={12} /> Imprimir Guia
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {rec.encaminhamentos.map((rf, rfIdx) => (
                                <div key={rf.id || rfIdx} className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1.5">
                                  <div className="flex justify-between items-start">
                                    <p className="text-xs font-black text-indigo-900 uppercase">{rf.especialidade}</p>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                      rf.urgencia === 'ALTA' || rf.urgencia === 'EMERGENCIA' 
                                        ? 'bg-rose-100 text-rose-700' 
                                        : 'bg-indigo-100 text-indigo-700'
                                    }`}>
                                      {rf.urgencia}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-700 font-medium">"{rf.motivo}"</p>
                                  {rf.localSugerido && (
                                    <p className="text-[10px] text-slate-500 font-bold">
                                      Local Sugerido: {rf.localSugerido}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 6. EXAMES SOLICITADOS OU REALIZADOS */}
                        {(rec.examesSolicitados || (rec.examesLaboratoriais && rec.examesLaboratoriais.length > 0)) && (
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                              <FlaskConical size={14} className="text-teal-600" /> Exames Solicitados / Laudos Laboratoriais
                            </h4>

                            {rec.examesSolicitados && (
                              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                                <p className="text-[10px] font-black text-amber-800 uppercase mb-0.5">Exames Solicitados:</p>
                                <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">{rec.examesSolicitados}</p>
                              </div>
                            )}

                            {rec.examesLaboratoriais && rec.examesLaboratoriais.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {rec.examesLaboratoriais.map(ex => (
                                  <button 
                                    key={ex.id} 
                                    type="button"
                                    onClick={() => setViewingAttachment({ url: ex.arquivo, title: ex.nomeExame })} 
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all shadow-2xs cursor-pointer"
                                  >
                                    <Eye size={12} />
                                    <span>{ex.nomeExame}</span>
                                    <span className="text-[9px] opacity-70">({safeFormatDate(ex.dataAnexo)})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 7. INTERNAÇÃO / ACOMODAÇÃO SE REGISTRADA */}
                        {rec.necessitaInternacao && (
                          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                            <Home size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold uppercase text-[10px] text-amber-800">
                                Indicação de Internação {rec.recommendedKennelType ? `• Baia Recomendada: ${rec.recommendedKennelType}` : ''}
                              </p>
                              {rec.accommodationJustification && (
                                <p className="text-slate-700 mt-0.5 font-medium">
                                  Justificativa: {rec.accommodationJustification}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 8. COMPLEMENTOS CLÍNICOS E ADENDOS HISTÓRICOS (SE HOUVER) */}
                        {rec.adendos && rec.adendos.length > 0 && (
                          <div className="pt-4 border-t border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-teal-500/10 text-teal-700 rounded-lg">
                                <MessageSquare size={14} />
                              </span>
                              <div>
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                                  Notas Complementares Registradas ({rec.adendos.length})
                                </h5>
                                <p className="text-[10px] text-slate-400">
                                  Registros históricos preservados associados a este prontuário
                                </p>
                              </div>
                            </div>

                            {/* LISTA DE COMPLEMENTOS EXISTENTES EM ORDEM CRONOLÓGICA */}
                            <div className="space-y-2 pt-1">
                              {rec.adendos.map((ad, adIdx) => {
                                const adVet = users.find(u => u.id === ad.veterinarioId);
                                const displayName = ad.veterinarioNome || adVet?.name || 'Médico Veterinário';
                                const displayCrmv = ad.crmv || adVet?.crmv;

                                return (
                                  <div
                                    key={ad.id || `ad-${adIdx}`}
                                    className="p-3.5 bg-slate-50 border-l-4 border-l-teal-600 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-[10px]">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black uppercase px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md tracking-wider">
                                          NOTA COMPLEMENTAR #{adIdx + 1} • {ad.motivo}
                                        </span>
                                        <span className="font-bold text-slate-600 flex items-center gap-1">
                                          <UserIcon size={11} className="text-slate-400" />
                                          {displayName} {displayCrmv ? `(CRMV: ${displayCrmv})` : ''}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200" title="Nota registrada e arquivada no prontuário oficial">
                                          <CheckCircle2 size={10} className="text-teal-600" /> Prontuário Central
                                        </span>
                                        <span className="text-slate-400 flex items-center gap-1">
                                          <Clock size={11} />
                                          {safeFormatDate(ad.createdAt, "dd/MM/yyyy 'às' HH:mm")}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed pl-0.5">
                                      {ad.texto}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* AÇÕES DE IMPRESSÃO E NOVO ATENDIMENTO */}
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium">
                            Prontuário Registrado • ID: {rec.id.substring(0, 8).toUpperCase()}
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/animais/atendimento/${animal.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                              title="Registrar novas informações clínicas abrindo um novo atendimento"
                            >
                              <Stethoscope size={14} /> Novo Atendimento Clínico
                            </a>
                            <button
                              type="button"
                              onClick={() => printClinicalRecord(rec, animal)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                            >
                              <Printer size={14} className="text-teal-400" /> Imprimir Prontuário
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Consulta em modo somente-leitura. As informações digitadas no formulário atual permanecem preservadas.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer self-end sm:self-auto"
          >
            Fechar Consulta
          </button>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO DE ANEXO (LAUDO/EXAME) */}
      {viewingAttachment && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setViewingAttachment(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="text-sm font-black text-slate-800 uppercase truncate">{viewingAttachment.title}</h4>
              <button 
                type="button"
                onClick={() => setViewingAttachment(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 rounded-xl p-2 min-h-[300px]">
              {viewingAttachment.url.startsWith('data:image/') || viewingAttachment.url.startsWith('http') ? (
                <img src={viewingAttachment.url} alt={viewingAttachment.title} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileSearch size={40} className="mx-auto text-slate-400" />
                  <p className="text-xs text-slate-500">Documento anexado ({viewingAttachment.title})</p>
                  <a 
                    href={viewingAttachment.url} 
                    download={viewingAttachment.title}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl hover:bg-teal-700 transition"
                  >
                    Baixar Arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
