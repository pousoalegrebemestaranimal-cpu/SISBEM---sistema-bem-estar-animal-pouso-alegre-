
import React, { useState, useEffect, useRef } from 'react';
// Fix: Use import * as and cast to any to bypass named export errors
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, useNavigate } = ReactRouterDOM as any;
import { db } from '../services/db';
import { Especie, Porte, Sexo, AnimalCondicao, Tutor, Solicitante } from '../types';
import { syncAnimalToSupabase } from '../src/lib/supabaseSync';
import { validateCPF, formatCPF, formatTelefone } from '../utils/validation';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Stethoscope, AlertTriangle, Skull, MapPin, Calendar, Palette, UserCheck, Camera, Upload, X, Building2, User, Ambulance, UserCircle, HeartPulse, ClipboardList, Home, FileText, CheckCircle, Cpu, QrCode, HelpCircle, Shield, TreePine, Flame, Clock } from 'lucide-react';

const AnimalForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadUnicoRef = useRef<HTMLInputElement>(null);
  const user = db.getCurrentUser();
  const isVetOrAdmin = user?.role === 'VETERINARIO' || user?.role === 'ADMIN';

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'RESGATE' | 'EXTERNO'>('RESGATE');
  const [solicitanteType, setSolicitanteType] = useState<'PARTICULAR' | 'ONG' | 'BOMBEIROS' | 'PM' | 'AMBIENTAL' | 'DESCONHECIDO'>('PARTICULAR');
  const [ongs, setOngs] = useState<Solicitante[]>([]);
  
  const [animal, setAnimal] = useState<any>({
    nome: '',
    peso: '',
    idade: '',
    corPelagem: '',
    especie: Especie.CAO,
    raca: '',
    porte: Porte.MEDIO,
    sexo: Sexo.MACHO,
    castrado: false,
    microchipado: false,
    numeroMicrochip: '',
    temTutor: false,
    condicao: AnimalCondicao.ACOLHIDO,
    localResgate: '',
    dataResgate: new Date().toISOString().split('T')[0],
    motivo: '',
    foto: '',
    resgateSamuvet: false,
    responsavelSamuvet: '',
    dataObito: '',
    causaObito: '',
    dataSoltura: '',
    localSoltura: ''
  });

  const [solicitante, setSolicitante] = useState<any>({
    id: '',
    nomeCompleto: '',
    cpf: '',
    telefone: '',
    tipo: 'CIDADAO',
    codigoOng: '',
    responsavel: '',
    endereco: '',
  });

  const [tutor, setTutor] = useState<any>({
    nomeCompleto: '',
    cpf: '',
    telefone: '',
    endereco: '',
    temCadUnico: false,
    documentoCadUnico: ''
  });

  useEffect(() => {
    setOngs(db.getOngs());
  }, []);

  useEffect(() => {
    if (id) {
      const existing = db.getAnimalsJoined().find(a => a.id === id);
      if (existing) {
        setAnimal({
          ...existing,
          peso: existing.peso.toString(),
          idade: existing.idade || '',
          corPelagem: existing.corPelagem || '',
          dataObito: existing.dataObito || '',
          causaObito: existing.causaObito || '',
          dataSoltura: existing.dataSoltura || '',
          localSoltura: existing.localSoltura || '',
          foto: existing.foto || '',
          resgateSamuvet: !!existing.resgateSamuvet,
          responsavelSamuvet: existing.responsavelSamuvet || '',
          temTutor: !!existing.temTutor,
          castrado: !!existing.castrado,
          microchipado: !!existing.microchipado,
          numeroMicrochip: existing.numeroMicrochip || ''
        });
        setActiveTab(existing.temTutor ? 'EXTERNO' : 'RESGATE');
        
        if (existing.tutor) {
          setTutor({
            nomeCompleto: existing.tutor.nomeCompleto || '',
            cpf: existing.tutor.cpf || '',
            telefone: existing.tutor.telefone || '',
            endereco: existing.tutor.endereco || '',
            temCadUnico: !!existing.tutor.temCadUnico,
            documentoCadUnico: existing.tutor.documentoCadUnico || ''
          });
        }

        if (existing.solicitante) {
          setSolicitante({
            id: existing.solicitante.id || '',
            nomeCompleto: existing.solicitante.nomeCompleto || '',
            cpf: existing.solicitante.cpf || '',
            telefone: existing.solicitante.telefone || '',
            tipo: existing.solicitante.tipo || (existing.solicitante.codigoOng ? 'ONG' : 'CIDADAO'),
            codigoOng: existing.solicitante.codigoOng || '',
            responsavel: existing.solicitante.responsavel || '',
            endereco: existing.solicitante.endereco || ''
          });
          
          if (existing.solicitante.cpf === 'INST-BOMBEIROS') setSolicitanteType('BOMBEIROS');
          else if (existing.solicitante.cpf === 'INST-PM') setSolicitanteType('PM');
          else if (existing.solicitante.cpf === 'INST-PA') setSolicitanteType('AMBIENTAL');
          else if (existing.solicitante.tipo === 'DESCONHECIDO' || existing.solicitante.cpf === 'DESC-ANONIMO' || existing.solicitante.nomeCompleto?.toLowerCase().includes('desconhecido')) setSolicitanteType('DESCONHECIDO');
          else if (existing.solicitante.tipo === 'ONG' || existing.solicitante.codigoOng) setSolicitanteType('ONG');
          else setSolicitanteType('PARTICULAR');
        }
      }
    }
  }, [id]);

  // Busca automática de Tutor por CPF
  useEffect(() => {
    const cleanCPF = tutor.cpf.replace(/\D/g, '');
    if (cleanCPF.length === 11 && activeTab === 'EXTERNO') {
      const existingTutor = db.getTutores().find(t => t.cpf === formatCPF(cleanCPF));
      if (existingTutor) {
        setTutor({
          nomeCompleto: existingTutor.nomeCompleto,
          cpf: existingTutor.cpf,
          telefone: existingTutor.telefone,
          endereco: existingTutor.endereco || '',
          temCadUnico: !!existingTutor.temCadUnico,
          documentoCadUnico: existingTutor.documentoCadUnico || ''
        });
        setMessage({ type: 'info', text: 'Tutor já cadastrado no sistema.' });
      }
    }
  }, [tutor.cpf, activeTab]);

  // Busca automática de Solicitante por CPF
  useEffect(() => {
    const cleanCPF = solicitante.cpf.replace(/\D/g, '');
    if (cleanCPF.length === 11 && !id && activeTab === 'RESGATE' && solicitanteType === 'PARTICULAR') { 
      const existingSolicitante = db.getSolicitantes().find(s => s.cpf === formatCPF(cleanCPF));
      if (existingSolicitante) {
        setSolicitante({
          id: existingSolicitante.id,
          nomeCompleto: existingSolicitante.nomeCompleto,
          cpf: existingSolicitante.cpf,
          telefone: existingSolicitante.telefone,
          tipo: 'CIDADAO'
        });
        setMessage({ type: 'info', text: 'Solicitante já cadastrado no sistema.' });
      }
    }
  }, [solicitante.cpf, id, solicitanteType, activeTab]);

  const handleCodigoOngChange = (codigo: string) => {
    const clean = codigo.trim().toUpperCase();
    const foundOng = db.getSolicitanteByCodigoOng(clean);

    if (foundOng) {
      setSolicitante({
        id: foundOng.id,
        nomeCompleto: foundOng.nomeCompleto,
        cpf: foundOng.cpf,
        telefone: foundOng.telefone,
        tipo: 'ONG',
        codigoOng: foundOng.codigoOng || clean,
        responsavel: foundOng.responsavel || '',
        endereco: foundOng.endereco || '',
      });
      setMessage({ type: 'success', text: `ONG identificada pelo código ${foundOng.codigoOng}: ${foundOng.nomeCompleto}` });
    } else {
      setSolicitante((prev: any) => ({
        ...prev,
        codigoOng: codigo.toUpperCase(),
        tipo: 'ONG'
      }));
    }
  };

  const handleSelectOng = (selectedOng: Solicitante) => {
    setSolicitante({
      id: selectedOng.id,
      nomeCompleto: selectedOng.nomeCompleto,
      cpf: selectedOng.cpf,
      telefone: selectedOng.telefone,
      tipo: 'ONG',
      codigoOng: selectedOng.codigoOng || '',
      responsavel: selectedOng.responsavel || '',
      endereco: selectedOng.endereco || '',
    });
    setMessage({ type: 'success', text: `ONG ${selectedOng.nomeCompleto} selecionada automaticamente.` });
  };

  const handleInstitutionalChange = (type: 'PARTICULAR' | 'ONG' | 'BOMBEIROS' | 'PM' | 'AMBIENTAL' | 'DESCONHECIDO') => {
    setSolicitanteType(type);
    switch(type) {
      case 'BOMBEIROS':
        setSolicitante({ id: 'inst-bombeiros', nomeCompleto: 'Corpo de Bombeiros', cpf: 'INST-BOMBEIROS', telefone: '193', tipo: 'ORGAO_PUBLICO' });
        break;
      case 'PM':
        setSolicitante({ id: 'inst-pm', nomeCompleto: 'Polícia Militar', cpf: 'INST-PM', telefone: '190', tipo: 'ORGAO_PUBLICO' });
        break;
      case 'AMBIENTAL':
        setSolicitante({ id: 'inst-pa', nomeCompleto: 'Polícia Ambiental', cpf: 'INST-PA', telefone: '(35) 3429-1900', tipo: 'ORGAO_PUBLICO' });
        break;
      case 'DESCONHECIDO':
        setSolicitante({
          id: 'inst-desconhecido',
          nomeCompleto: 'Solicitante Desconhecido / Anônimo',
          cpf: 'DESC-ANONIMO',
          telefone: 'Não informado',
          tipo: 'DESCONHECIDO',
          codigoOng: '',
          responsavel: '',
          endereco: ''
        });
        break;
      case 'ONG': {
        const existingOngs = db.getOngs();
        if (existingOngs.length > 0) {
          const first = existingOngs[0];
          setSolicitante({
            id: first.id,
            nomeCompleto: first.nomeCompleto,
            cpf: first.cpf,
            telefone: first.telefone,
            tipo: 'ONG',
            codigoOng: first.codigoOng || 'ONG-01',
            responsavel: first.responsavel || '',
            endereco: first.endereco || ''
          });
        } else {
          setSolicitante({ nomeCompleto: '', cpf: '', telefone: '', tipo: 'ONG', codigoOng: 'ONG-01', responsavel: '', endereco: '' });
        }
        break;
      }
      case 'PARTICULAR':
      default:
        setSolicitante({ id: '', nomeCompleto: '', cpf: '', telefone: '', tipo: 'CIDADAO', codigoOng: '', responsavel: '', endereco: '' });
        break;
    }
  };

  const handleModeSwitch = (mode: 'RESGATE' | 'EXTERNO') => {
    setActiveTab(mode);
    setAnimal({ 
      ...animal, 
      temTutor: mode === 'EXTERNO',
      condicao: mode === 'EXTERNO' ? AnimalCondicao.AGUARDANDO_ATENDIMENTO : AnimalCondicao.ACOLHIDO
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A foto é muito grande. Escolha uma imagem de até 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAnimal({ ...animal, foto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCadUnicoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Documento muito grande. Escolha um arquivo de até 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTutor({ ...tutor, documentoCadUnico: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFoto = () => {
    setAnimal({ ...animal, foto: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const isExterno = activeTab === 'EXTERNO';

    if (isExterno) {
      if (tutor.cpf && tutor.cpf.trim() !== "" && !validateCPF(tutor.cpf)) {
        setMessage({ type: 'error', text: 'O CPF informado para o tutor é inválido.' });
        return;
      }
    } else {
      if (solicitanteType === 'PARTICULAR' && solicitante.cpf && solicitante.cpf.trim() !== "" && !validateCPF(solicitante.cpf)) {
        setMessage({ type: 'error', text: 'O CPF informado para o solicitante é inválido.' });
        return;
      }
    }

    if (!animal.nome || !animal.peso || !animal.corPelagem || !animal.motivo) {
      setMessage({ type: 'error', text: 'Preencha os campos obrigatórios do animal.' });
      return;
    }

    if (animal.microchipado && !animal.numeroMicrochip?.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe o código do microchip do animal.' });
      return;
    }

    try {
      setLoading(true);
      const personaData = isExterno ? tutor : solicitante;
      const savedAnimal = db.saveAnimal(animal, personaData, user!.id);
      
      try {
        await syncAnimalToSupabase(savedAnimal);
        setMessage({ type: 'success', text: 'Registro salvo e sincronizado na nuvem com sucesso!' });
      } catch (syncErr) {
        setMessage({ type: 'success', text: 'Registro salvo localmente. Sincronização em nuvem em andamento.' });
      }

      setTimeout(() => navigate('/animais'), 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Ocorreu um erro ao salvar o registro.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">{id ? 'Editar Cadastro' : 'Novo Registro SISBEM'}</h2>
          <p className="text-slate-500 text-xs font-medium">Entrada de animais e triagem de atendimento.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
          message.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : message.type === 'info' ? <UserCheck size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* TRIAGEM DE IDENTIFICAÇÃO E NAVEGAÇÃO POR ABAS */}
      <section className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <UserCircle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Triagem Inicial</h3>
              <p className="text-[11px] text-slate-500 font-medium">Identifique o tipo de atendimento para prosseguir.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => handleModeSwitch('RESGATE')}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activeTab === 'RESGATE' ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-600/20' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-200'}`}
            >
              <div className={`p-3 rounded-xl ${activeTab === 'RESGATE' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <ClipboardList size={24} />
              </div>
              <div className="text-left">
                <p className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'RESGATE' ? 'text-teal-100' : 'text-slate-400'}`}>Animal Errante</p>
                <p className="text-sm font-black">Novo Resgate</p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => handleModeSwitch('EXTERNO')}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activeTab === 'EXTERNO' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}
            >
              <div className={`p-3 rounded-xl ${activeTab === 'EXTERNO' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <HeartPulse size={24} />
              </div>
              <div className="text-left">
                <p className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'EXTERNO' ? 'text-indigo-100' : 'text-slate-400'}`}>Possui Tutor</p>
                <p className="text-sm font-black">Atendimento Externo</p>
              </div>
            </button>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-12">
            {/* DADOS DO ANIMAL */}
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-4 gap-4">
                <h3 className={`text-xs font-black uppercase tracking-widest ${activeTab === 'EXTERNO' ? 'text-indigo-500' : 'text-teal-600'}`}>Dados do Animal</h3>
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Condição Atual</label>
                  <select 
                    value={animal.condicao} 
                    onChange={e => setAnimal({...animal, condicao: e.target.value as AnimalCondicao})} 
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black border-none outline-none focus:ring-0 bg-white shadow-sm"
                  >
                    {Object.values(AnimalCondicao).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Camera size={14} /> Foto</label>
                  <div onClick={() => fileInputRef.current?.click()} className={`relative aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group ${animal.foto ? 'border-teal-500' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'}`}>
                    {animal.foto ? (
                      <>
                        <img src={animal.foto} alt="Animal" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><p className="text-white text-[10px] font-bold uppercase tracking-widest">Alterar Foto</p></div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeFoto(); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-2 group-hover:text-teal-500 group-hover:bg-teal-50 transition-colors"><Upload size={24} /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Carregar Foto</p>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Nome do Animal *</label><input type="text" required value={animal.nome} onChange={e => setAnimal({...animal, nome: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all font-bold" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Clock size={14} className="text-teal-600" /> Idade / Estimativa</label><input type="text" value={animal.idade || ''} onChange={e => setAnimal({...animal, idade: e.target.value})} placeholder="Ex: 2 anos, 6 meses, Filhote, Adulto..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Peso aproximado (kg) *</label><input type="number" step="0.1" required value={animal.peso} onChange={e => setAnimal({...animal, peso: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Espécie *</label><select value={animal.especie} onChange={e => setAnimal({...animal, especie: e.target.value as Especie})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold"><option value={Especie.CAO}>Cão</option><option value={Especie.GATO}>Gato</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Raça *</label><input type="text" required value={animal.raca} onChange={e => setAnimal({...animal, raca: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Palette size={14} /> Cor / Pelagem *</label><input type="text" required value={animal.corPelagem} onChange={e => setAnimal({...animal, corPelagem: e.target.value})} placeholder="Ex: Preto e Branco, Caramelo..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                </div>

                <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Porte *</label><div className="flex gap-4 pt-2">{Object.values(Porte).map(p => (<label key={p} className="flex items-center gap-2 cursor-pointer"><input type="radio" name="porte" value={p} checked={animal.porte === p} onChange={() => setAnimal({...animal, porte: p})} className="text-teal-600 focus:ring-teal-500 h-4 w-4" /><span className="text-sm font-medium text-slate-700">{p}</span></label>))}</div></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Sexo *</label><div className="flex gap-4 pt-2">{Object.values(Sexo).map(s => (<label key={s} className="flex items-center gap-2 cursor-pointer"><input type="radio" name="sexo" value={s} checked={animal.sexo === s} onChange={() => setAnimal({...animal, sexo: s})} className="text-teal-600 focus:ring-teal-500 h-4 w-4" /><span className="text-sm font-medium text-slate-700">{s}</span></label>))}</div></div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Castrado? *</label>
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="castrado" checked={animal.castrado === true} onChange={() => setAnimal({...animal, castrado: true})} className="text-teal-600 focus:ring-teal-500 h-4 w-4" />
                        <span className="text-sm font-medium text-slate-700">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="castrado" checked={animal.castrado === false} onChange={() => setAnimal({...animal, castrado: false})} className="text-teal-600 focus:ring-teal-500 h-4 w-4" />
                        <span className="text-sm font-medium text-slate-700">Não</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      <Cpu size={14} className="text-teal-600" /> Animal Microchipado? *
                    </label>
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="microchipado" 
                          checked={animal.microchipado === true} 
                          onChange={() => setAnimal({...animal, microchipado: true})} 
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4" 
                        />
                        <span className="text-sm font-medium text-slate-700">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="microchipado" 
                          checked={animal.microchipado === false} 
                          onChange={() => setAnimal({...animal, microchipado: false, numeroMicrochip: ''})} 
                          className="text-teal-600 focus:ring-teal-500 h-4 w-4" 
                        />
                        <span className="text-sm font-medium text-slate-700">Não</span>
                      </label>
                    </div>
                  </div>

                  {animal.microchipado && (
                    <div className="col-span-1 md:col-span-2 space-y-1 animate-in fade-in zoom-in-95">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                        <QrCode size={14} className="text-teal-600" /> Código / Número do Microchip *
                      </label>
                      <input 
                        type="text" 
                        required={animal.microchipado} 
                        value={animal.numeroMicrochip || ''} 
                        onChange={e => setAnimal({...animal, numeroMicrochip: e.target.value})} 
                        placeholder="Digite o código do microchip (Ex: 981098101234567)" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono font-bold text-slate-800" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO CONTEXTUAL: RESGATE OU ATENDIMENTO EXTERNO */}
            <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
              <div className="border-b pb-4">
                <h3 className={`text-xs font-black uppercase tracking-widest ${activeTab === 'EXTERNO' ? 'text-indigo-500' : 'text-teal-600'}`}>
                  {activeTab === 'EXTERNO' ? 'Dados da Consulta Clínica' : 'Informações do Resgate'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {activeTab === 'RESGATE' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <MapPin size={14} /> Local do Resgate *
                      </label>
                      <input type="text" required value={animal.localResgate} onChange={e => setAnimal({...animal, localResgate: e.target.value})} placeholder="Onde o animal foi encontrado?" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Calendar size={14} /> Data do Resgate *
                      </label>
                      <input type="date" required value={animal.dataResgate} onChange={e => setAnimal({...animal, dataResgate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-4">
                      <div className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${animal.resgateSamuvet ? 'bg-teal-50 border-teal-500' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${animal.resgateSamuvet ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}><Ambulance size={20} /></div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-slate-700">Resgate SAMUVET?</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setAnimal({...animal, resgateSamuvet: !animal.resgateSamuvet})} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all shadow-sm ${animal.resgateSamuvet ? 'bg-teal-600 text-white' : 'bg-white border border-slate-300 text-slate-400'}`}>
                          {animal.resgateSamuvet ? 'Sim' : 'Não'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Calendar size={14} /> Data do Agendamento *
                    </label>
                    <input type="date" required value={animal.dataResgate} onChange={e => setAnimal({...animal, dataResgate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                )}

                <div className="col-span-1 md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    {activeTab === 'EXTERNO' ? 'Queixa Principal / Motivo da Consulta *' : 'Motivo do Resgate / Histórico *'}
                  </label>
                  <textarea required rows={3} value={animal.motivo} onChange={e => setAnimal({...animal, motivo: e.target.value})} placeholder={activeTab === 'EXTERNO' ? "Descreva o que o animal apresenta..." : "Relate as condições do resgate..."} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
                </div>
              </div>
            </div>

            {/* SEÇÃO DINÂMICA: BANCO DE TUTORES OU BANCO DE SOLICITANTES */}
            <div className="space-y-8">
              <div className="border-b pb-4">
                <h3 className={`text-xs font-black uppercase tracking-widest ${activeTab === 'EXTERNO' ? 'text-indigo-500' : 'text-teal-600'}`}>
                  {activeTab === 'EXTERNO' ? 'Dados do Tutor (Responsável Legal)' : 'Origem da Solicitação (Resgate)'}
                </h3>
              </div>
              
              {activeTab === 'RESGATE' ? (
                <div className="space-y-8 animate-in zoom-in-95">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { type: 'PARTICULAR', label: 'Cidadão', icon: User },
                      { type: 'ONG', label: 'ONG / Entidade', icon: QrCode },
                      { type: 'BOMBEIROS', label: 'Bombeiros', icon: Flame },
                      { type: 'PM', label: 'Polícia Militar', icon: Shield },
                      { type: 'AMBIENTAL', label: 'Pol. Ambiental', icon: TreePine },
                      { type: 'DESCONHECIDO', label: 'Desconhecido', icon: HelpCircle }
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInstitutionalChange(type as any)}
                        className={`flex flex-col items-center justify-center text-center gap-2 p-3 rounded-xl border-2 transition-all min-h-[76px] ${
                          solicitanteType === type 
                            ? 'bg-teal-50 border-teal-500 text-teal-700 font-bold shadow-sm ring-1 ring-teal-400' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100/70'
                        }`}
                      >
                        <Icon size={20} className={solicitanteType === type ? 'text-teal-600' : 'text-slate-400'} />
                        <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
                      </button>
                    ))}
                  </div>

                  {solicitanteType === 'DESCONHECIDO' ? (
                    <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100/80 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in shadow-inner">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-slate-200 text-slate-600 rounded-xl shrink-0">
                          <HelpCircle size={24} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Origem Desconhecida / Anônima</h4>
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-mono font-black px-2 py-0.5 rounded">DESC-ANONIMO</span>
                          </div>
                          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                            Animal recolhido diretamente pela equipe municipal em via pública, captura de rotina ou chamado/denúncia anônima sem solicitante formal identificado.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3.5 py-2 rounded-xl shrink-0 shadow-sm">
                        <CheckCircle2 size={16} className="text-teal-600" />
                        <span>Dispensa CPF e Telefone</span>
                      </div>
                    </div>
                  ) : solicitanteType === 'ONG' ? (
                    <div className="space-y-6 bg-gradient-to-br from-teal-50/70 to-emerald-50/40 p-5 rounded-2xl border-2 border-teal-200 shadow-sm">
                      {/* Código da ONG com Busca Automática */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <label className="text-xs font-black text-teal-900 uppercase tracking-wider flex items-center gap-2">
                            <QrCode size={18} className="text-teal-600" /> Código da ONG * (Preenchimento Automático)
                          </label>
                          <span className="text-[11px] text-teal-700 font-medium">Digite o código para preencher os dados da ONG instantaneamente</span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            required
                            value={solicitante.codigoOng || ''}
                            onChange={e => handleCodigoOngChange(e.target.value)}
                            placeholder="Ex: ONG-01, ONG-02, ONG-03..."
                            list="ongs-datalist"
                            className="w-full px-4 py-3 bg-white border-2 border-teal-500 rounded-xl focus:ring-4 focus:ring-teal-500/20 outline-none font-mono text-base font-black text-teal-950 shadow-sm uppercase tracking-wider"
                          />
                          <datalist id="ongs-datalist">
                            {ongs.map(o => (
                              <option key={o.id} value={o.codigoOng}>
                                {o.nomeCompleto} {o.responsavel ? `(${o.responsavel})` : ''}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Chips de Seleção Rápida */}
                      {ongs.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider flex items-center gap-1">
                            <span>ONGs Cadastradas no Banco de Solicitantes:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ongs.map(o => {
                              const isSelected = solicitante.codigoOng?.toUpperCase() === o.codigoOng?.toUpperCase();
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => handleSelectOng(o)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    isSelected 
                                      ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-300' 
                                      : 'bg-white text-slate-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50'
                                  }`}
                                >
                                  <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-black ${isSelected ? 'bg-teal-700 text-teal-100' : 'bg-teal-100 text-teal-800'}`}>
                                    {o.codigoOng}
                                  </span>
                                  <span>{o.nomeCompleto}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Dados Preenchidos da ONG */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Razão Social / Nome da ONG *</label>
                          <input
                            type="text"
                            required
                            value={solicitante.nomeCompleto}
                            onChange={e => setSolicitante({...solicitante, nomeCompleto: e.target.value})}
                            placeholder="Nome da ONG"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">CNPJ / Documento *</label>
                          <input
                            type="text"
                            required
                            value={solicitante.cpf}
                            onChange={e => setSolicitante({...solicitante, cpf: e.target.value})}
                            placeholder="CNPJ ou Código"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Telefone / WhatsApp *</label>
                          <input
                            type="text"
                            required
                            value={solicitante.telefone}
                            onChange={e => setSolicitante({...solicitante, telefone: formatTelefone(e.target.value)})}
                            placeholder="(00) 00000-0000"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-slate-800"
                          />
                        </div>
                        <div className="col-span-1 md:col-span-3 space-y-1">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Representante / Responsável da ONG</label>
                          <input
                            type="text"
                            value={solicitante.responsavel || ''}
                            onChange={e => setSolicitante({...solicitante, responsavel: e.target.value})}
                            placeholder="Nome do voluntário ou presidente responsável pelo resgate"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Nome do Solicitante *</label>
                        <input type="text" required value={solicitante.nomeCompleto} onChange={e => setSolicitante({...solicitante, nomeCompleto: e.target.value})} readOnly={['BOMBEIROS', 'PM', 'AMBIENTAL'].includes(solicitanteType)} className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all ${['BOMBEIROS', 'PM', 'AMBIENTAL'].includes(solicitanteType) ? 'bg-slate-100' : 'bg-slate-50'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">CPF *</label>
                        <input type="text" required value={solicitante.cpf} onChange={e => setSolicitante({...solicitante, cpf: solicitanteType === 'PARTICULAR' ? formatCPF(e.target.value) : e.target.value})} readOnly={solicitanteType !== 'PARTICULAR'} placeholder="000.000.000-00" className={`w-full px-4 py-2.5 border rounded-xl outline-none ${solicitanteType !== 'PARTICULAR' ? 'bg-slate-100' : 'bg-slate-50 font-mono'}`} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Telefone *</label>
                        <input type="text" required value={solicitante.telefone} onChange={e => setSolicitante({...solicitante, telefone: formatTelefone(e.target.value)})} placeholder="(00) 00000-0000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Nome Completo do Tutor *</label>
                      <input type="text" required value={tutor.nomeCompleto} onChange={e => setTutor({...tutor, nomeCompleto: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">CPF do Tutor *</label>
                      <input type="text" required value={tutor.cpf} onChange={e => setTutor({...tutor, cpf: formatCPF(e.target.value)})} placeholder="000.000.000-00" className="w-full px-4 py-2.5 bg-indigo-50/30 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Telefone do Tutor *</label>
                      <input type="text" required value={tutor.telefone} onChange={e => setTutor({...tutor, telefone: formatTelefone(e.target.value)})} placeholder="(00) 00000-0000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="col-span-1 md:col-span-3 space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1"><Home size={12} /> Endereço Residencial *</label>
                      <input type="text" required value={tutor.endereco} onChange={e => setTutor({...tutor, endereco: e.target.value})} placeholder="Rua, número, bairro, cidade..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    {/* OPÇÃO CADUNICO */}
                    <div className="col-span-1 md:col-span-3 pt-4 border-t border-slate-100">
                      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Possui CadÚnico?</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" checked={tutor.temCadUnico === true} onChange={() => setTutor({...tutor, temCadUnico: true})} className="text-indigo-600 focus:ring-indigo-500" />
                              <span className="text-sm font-bold text-slate-700">Sim</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" checked={tutor.temCadUnico === false} onChange={() => setTutor({...tutor, temCadUnico: false, documentoCadUnico: ''})} className="text-indigo-600 focus:ring-indigo-500" />
                              <span className="text-sm font-bold text-slate-700">Não</span>
                            </label>
                          </div>
                        </div>

                        {tutor.temCadUnico && (
                          <div className="flex-1 w-full animate-in slide-in-from-left-2 duration-300">
                             <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block mb-2">Comprovante CadÚnico (Anexar documento)</label>
                             <div 
                                onClick={() => cadUnicoRef.current?.click()}
                                className={`p-4 rounded-xl border-2 border-dashed transition-all flex items-center justify-between cursor-pointer ${tutor.documentoCadUnico ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-50 border-slate-300 hover:border-indigo-400'}`}
                             >
                               <div className="flex items-center gap-3">
                                 {tutor.documentoCadUnico ? <CheckCircle className="text-emerald-500" /> : <Upload className="text-slate-400" />}
                                 <div>
                                   <p className="text-xs font-bold text-slate-700">{tutor.documentoCadUnico ? 'Documento anexado com sucesso' : 'Selecione o arquivo (PDF ou Imagem)'}</p>
                                   <p className="text-[10px] text-slate-400 uppercase">Máximo 5MB</p>
                                 </div>
                               </div>
                               {tutor.documentoCadUnico && (
                                 <button type="button" onClick={(e) => { e.stopPropagation(); setTutor({...tutor, documentoCadUnico: ''}); }} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"><X size={14} /></button>
                               )}
                             </div>
                             <input type="file" ref={cadUnicoRef} onChange={handleCadUnicoFile} accept="image/*,application/pdf" className="hidden" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => navigate('/animais')} className="px-8 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
              <button type="submit" disabled={loading} className={`flex items-center gap-2 px-12 py-3 text-white font-black rounded-xl shadow-lg disabled:opacity-50 transition-all ${activeTab === 'EXTERNO' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
                {loading ? 'Processando...' : <><Save size={18} /> {id ? 'Atualizar Registro' : (activeTab === 'EXTERNO' ? 'Registrar Atendimento' : 'Registrar Resgate')}</>}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default AnimalForm;
