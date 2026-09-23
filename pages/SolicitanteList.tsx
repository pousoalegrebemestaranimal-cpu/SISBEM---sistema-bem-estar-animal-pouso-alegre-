import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import { Solicitante } from '../types';
import { Search, UserSearch, Eye, Phone, IdCard, Plus, Building2, User, Copy, Check, Edit2, Trash2, X, Sparkles, Filter, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCPF, formatTelefone } from '../utils/validation';
import { useDebounce } from '../src/hooks/useDebounce';
import { Pagination } from '../components/Pagination';
import { fetchSolicitantesPaginated } from '../src/lib/supabaseQueries';

const PAGE_SIZE = 20;

const SolicitanteList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ONG' | 'CIDADAO' | 'ORGAO_PUBLICO'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [solicitantes, setSolicitantes] = useState<(Solicitante & { rescueCount: number })[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSolicitante, setEditingSolicitante] = useState<Partial<Solicitante> | null>(null);
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    cpf: '',
    telefone: '',
    tipo: 'ONG' as 'ONG' | 'CIDADAO' | 'PROTETOR' | 'ORGAO_PUBLICO',
    codigoOng: '',
    responsavel: '',
    endereco: '',
    email: '',
    observacoes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Paginação e filtros REAIS no Supabase (range/limit e ilike)
  const loadSolicitantes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchSolicitantesPaginated({
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        tipo: activeFilter
      });
      setSolicitantes(res.data);
      setTotalCount(res.totalCount);
    } catch (e) {
      console.warn('Erro ao carregar solicitantes:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, activeFilter]);

  useEffect(() => {
    loadSolicitantes();
  }, [loadSolicitantes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeFilter]);

  // Contadores globais leves a partir do cache local
  const stats = useMemo(() => {
    const list = db.getSolicitantes();
    const total = list.length;
    const ongs = list.filter(s => s.tipo === 'ONG' || !!s.codigoOng).length;
    const cidadaos = list.filter(s => s.tipo === 'CIDADAO' || (!s.tipo && !s.codigoOng)).length;
    const orgaos = list.filter(s => s.tipo === 'ORGAO_PUBLICO').length;
    return { total, ongs, cidadaos, orgaos };
  }, [totalCount]);

  const handleCopyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenCreateModal = (type: 'ONG' | 'CIDADAO' = 'ONG') => {
    // Generate next code if ONG
    let nextCode = 'ONG-01';
    if (type === 'ONG') {
      const existingOngs = db.getOngs();
      const count = existingOngs.length + 1;
      nextCode = `ONG-${count.toString().padStart(2, '0')}`;
    }

    setEditingSolicitante(null);
    setFormData({
      nomeCompleto: '',
      cpf: '',
      telefone: '',
      tipo: type,
      codigoOng: type === 'ONG' ? nextCode : '',
      responsavel: '',
      endereco: '',
      email: '',
      observacoes: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: Solicitante) => {
    setEditingSolicitante(s);
    setFormData({
      nomeCompleto: s.nomeCompleto || '',
      cpf: s.cpf || '',
      telefone: s.telefone || '',
      tipo: s.tipo || (s.codigoOng ? 'ONG' : 'CIDADAO'),
      codigoOng: s.codigoOng || '',
      responsavel: s.responsavel || '',
      endereco: s.endereco || '',
      email: s.email || '',
      observacoes: s.observacoes || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.nomeCompleto.trim()) {
      setFormError('Informe o nome completo ou razão social.');
      return;
    }

    if (formData.tipo === 'ONG') {
      if (!formData.codigoOng.trim()) {
        setFormError('O código da ONG é obrigatório para preenchimento automático.');
        return;
      }

      // Check if code is already in use by another solicitante
      const upperCode = formData.codigoOng.trim().toUpperCase();
      const existingWithCode = db.getSolicitanteByCodigoOng(upperCode);
      if (existingWithCode && existingWithCode.id !== editingSolicitante?.id) {
        setFormError(`O código "${upperCode}" já está em uso pela ONG "${existingWithCode.nomeCompleto}". Escolha um código exclusivo.`);
        return;
      }
    }

    try {
      db.saveSolicitante({
        id: editingSolicitante?.id,
        nomeCompleto: formData.nomeCompleto.trim(),
        cpf: formData.cpf.trim(),
        telefone: formData.telefone.trim(),
        tipo: formData.tipo,
        codigoOng: formData.tipo === 'ONG' ? formData.codigoOng.trim().toUpperCase() : undefined,
        responsavel: formData.responsavel.trim(),
        endereco: formData.endereco.trim(),
        email: formData.email.trim(),
        observacoes: formData.observacoes.trim()
      });

      setIsModalOpen(false);
      loadSolicitantes();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar solicitante.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o solicitante "${name}"?`)) {
      db.deleteSolicitante(id);
      loadSolicitantes();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserSearch className="text-teal-600" /> Banco de Solicitantes e ONGs
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm">Gestão de ONGs com código de preenchimento automático e solicitantes de resgate.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleOpenCreateModal('ONG')}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all text-xs uppercase tracking-wider"
          >
            <Plus size={16} /> Cadastrar Nova ONG
          </button>
          <button
            onClick={() => handleOpenCreateModal('CIDADAO')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm transition-all text-xs uppercase tracking-wider"
          >
            <User size={16} /> Novo Cidadão
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button 
          onClick={() => setActiveFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all ${activeFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'}`}
        >
          <p className={`text-[10px] font-black uppercase tracking-wider ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>Total Cadastrados</p>
          <p className="text-2xl font-black mt-1">{stats.total}</p>
        </button>

        <button 
          onClick={() => setActiveFilter('ONG')}
          className={`p-4 rounded-xl border text-left transition-all ${activeFilter === 'ONG' ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-teal-300'}`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black uppercase tracking-wider ${activeFilter === 'ONG' ? 'text-teal-100' : 'text-teal-700'}`}>ONGs com Código</p>
            <Building2 size={16} className={activeFilter === 'ONG' ? 'text-teal-200' : 'text-teal-600'} />
          </div>
          <p className="text-2xl font-black mt-1">{stats.ongs}</p>
        </button>

        <button 
          onClick={() => setActiveFilter('CIDADAO')}
          className={`p-4 rounded-xl border text-left transition-all ${activeFilter === 'CIDADAO' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'}`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black uppercase tracking-wider ${activeFilter === 'CIDADAO' ? 'text-indigo-100' : 'text-indigo-600'}`}>Cidadãos</p>
            <User size={16} className={activeFilter === 'CIDADAO' ? 'text-indigo-200' : 'text-indigo-500'} />
          </div>
          <p className="text-2xl font-black mt-1">{stats.cidadaos}</p>
        </button>

        <button 
          onClick={() => setActiveFilter('ORGAO_PUBLICO')}
          className={`p-4 rounded-xl border text-left transition-all ${activeFilter === 'ORGAO_PUBLICO' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300'}`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black uppercase tracking-wider ${activeFilter === 'ORGAO_PUBLICO' ? 'text-amber-100' : 'text-amber-600'}`}>Órgãos Públicos</p>
            <Building2 size={16} className={activeFilter === 'ORGAO_PUBLICO' ? 'text-amber-200' : 'text-amber-500'} />
          </div>
          <p className="text-2xl font-black mt-1">{stats.orgaos}</p>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Código da ONG (ex: ONG-01), Nome, CNPJ/CPF ou Telefone..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Código / Tipo</th>
                <th className="px-6 py-4">Nome / Razão Social</th>
                <th className="px-6 py-4">CPF / CNPJ</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4 text-center">Resgates</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitantes.map(s => {
                const isOng = s.tipo === 'ONG' || !!s.codigoOng;
                const isOrgao = s.tipo === 'ORGAO_PUBLICO';

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      {isOng ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs bg-teal-100 text-teal-900 border border-teal-300 px-2 py-1 rounded-lg tracking-wider flex items-center gap-1">
                            <QrCode size={12} className="text-teal-600" />
                            {s.codigoOng || 'ONG'}
                          </span>
                          {s.codigoOng && (
                            <button
                              onClick={() => handleCopyCode(s.codigoOng!)}
                              className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                              title="Copiar Código da ONG"
                            >
                              {copiedCode === s.codigoOng ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      ) : isOrgao ? (
                        <span className="font-bold text-[10px] uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          Órgão Público
                        </span>
                      ) : (
                        <span className="font-bold text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Cidadão
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {isOng && <Building2 size={14} className="text-teal-600 shrink-0" />}
                        <span>{s.nomeCompleto}</span>
                      </div>
                      {s.endereco && <div className="text-[11px] text-slate-400 truncate max-w-xs">{s.endereco}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                      {s.cpf || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">
                      {s.responsavel ? (
                        <span className="font-medium">{s.responsavel}</span>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{s.telefone || '(Não informado)'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${s.rescueCount > 0 ? 'bg-teal-100 text-teal-800 border border-teal-200' : 'bg-slate-100 text-slate-400'}`}>
                        {s.rescueCount} {s.rescueCount === 1 ? 'RESGATE' : 'RESGATES'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link 
                          to={`/solicitantes/${s.id}`} 
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" 
                          title="Ver Perfil e Histórico"
                        >
                          <Eye size={16} />
                        </Link>
                        <button 
                          onClick={() => handleOpenEditModal(s)} 
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                          title="Editar Dados"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id, s.nomeCompleto)} 
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {solicitantes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum solicitante ou ONG encontrado com os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="solicitantes"
        />
      </div>

      {/* MODAL CADASTRO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                  {formData.tipo === 'ONG' ? <Building2 size={20} /> : <User size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    {editingSolicitante ? 'Editar Solicitante / ONG' : 'Cadastrar no Banco de Solicitantes'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formData.tipo === 'ONG' ? 'ONGs possuem código para preenchimento rápido em atendimentos' : 'Cadastro de cidadão ou entidade'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Tipo Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tipo de Solicitante *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'ONG', label: 'ONG / Entidade', icon: Building2 },
                    { type: 'CIDADAO', label: 'Cidadão / Protetor', icon: User },
                    { type: 'ORGAO_PUBLICO', label: 'Órgão Público', icon: Building2 }
                  ].map(t => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        tipo: t.type as any,
                        codigoOng: t.type === 'ONG' ? (formData.codigoOng || 'ONG-01') : '' 
                      })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        formData.tipo === t.type 
                          ? 'bg-teal-50 border-teal-600 text-teal-800 ring-2 ring-teal-500/20' 
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <t.icon size={16} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Código da ONG (Se for ONG) */}
              {formData.tipo === 'ONG' && (
                <div className="p-4 bg-teal-50/70 border-2 border-teal-300 rounded-xl space-y-1.5">
                  <label className="text-xs font-black uppercase text-teal-900 tracking-wider flex items-center gap-1.5">
                    <QrCode size={16} className="text-teal-600" /> Código Exclusivo da ONG *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.codigoOng}
                    onChange={e => setFormData({ ...formData, codigoOng: e.target.value.toUpperCase() })}
                    placeholder="Ex: ONG-01, ONG-02, ONG-VPA..."
                    className="w-full px-4 py-2.5 bg-white border-2 border-teal-500 rounded-lg outline-none font-mono text-sm font-black text-teal-950 uppercase tracking-wider"
                  />
                  <p className="text-[11px] text-teal-700">
                    Ao digitar esse código no formulário de resgate, o nome, CNPJ e telefone da ONG serão preenchidos automaticamente!
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    {formData.tipo === 'ONG' ? 'Razão Social / Nome da ONG *' : 'Nome Completo *'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.nomeCompleto}
                    onChange={e => setFormData({ ...formData, nomeCompleto: e.target.value })}
                    placeholder={formData.tipo === 'ONG' ? 'Ex: ONG Vira-Lata Vira Amor' : 'Nome completo'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    {formData.tipo === 'ONG' ? 'CNPJ ou Documento' : 'CPF'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.cpf}
                    onChange={e => setFormData({ 
                      ...formData, 
                      cpf: formData.tipo === 'CIDADAO' ? formatCPF(e.target.value) : e.target.value 
                    })}
                    placeholder={formData.tipo === 'ONG' ? '00.000.000/0001-00' : '000.000.000-00'}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Telefone / WhatsApp *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.telefone}
                    onChange={e => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>

                {formData.tipo === 'ONG' && (
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Representante / Responsável da ONG</label>
                    <input 
                      type="text" 
                      value={formData.responsavel}
                      onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                      placeholder="Nome da pessoa responsável pelo contato ou resgates"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                )}

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Endereço / Sede</label>
                  <input 
                    type="text" 
                    value={formData.endereco}
                    onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, número, bairro, cidade..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-teal-600/20"
                >
                  Salvar Solicitante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitanteList;
