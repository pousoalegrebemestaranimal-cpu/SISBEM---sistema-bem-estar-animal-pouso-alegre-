import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Solicitante } from '../types';
import { ArrowLeft, IdCard, Phone, User, Calendar, ClipboardCheck, Dog, MapPin, Eye, Building2, QrCode, Copy, Check, Edit2, Mail, Home, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCPF, formatTelefone } from '../utils/validation';

const SolicitanteDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  const solicitante = useMemo(() => db.getSolicitantes().find(s => s.id === id), [id, refreshKey]);
  const animals = useMemo(() => id ? db.getAnimalsBySolicitante(id) : [], [id, refreshKey]);

  if (!solicitante) return <div className="p-8 text-center text-slate-500 font-bold">Solicitante não encontrado.</div>;

  const isOng = solicitante.tipo === 'ONG' || !!solicitante.codigoOng;
  const isOrgao = solicitante.tipo === 'ORGAO_PUBLICO';

  const handleCopyCode = () => {
    if (solicitante.codigoOng) {
      navigator.clipboard.writeText(solicitante.codigoOng);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleOpenEdit = () => {
    setFormData({
      nomeCompleto: solicitante.nomeCompleto || '',
      cpf: solicitante.cpf || '',
      telefone: solicitante.telefone || '',
      tipo: solicitante.tipo || (solicitante.codigoOng ? 'ONG' : 'CIDADAO'),
      codigoOng: solicitante.codigoOng || '',
      responsavel: solicitante.responsavel || '',
      endereco: solicitante.endereco || '',
      email: solicitante.email || '',
      observacoes: solicitante.observacoes || ''
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.nomeCompleto.trim()) {
      setFormError('Informe o nome / razão social.');
      return;
    }

    if (formData.tipo === 'ONG') {
      if (!formData.codigoOng.trim()) {
        setFormError('O código da ONG é obrigatório.');
        return;
      }

      const upper = formData.codigoOng.trim().toUpperCase();
      const existing = db.getSolicitanteByCodigoOng(upper);
      if (existing && existing.id !== solicitante.id) {
        setFormError(`O código "${upper}" já está em uso por outra ONG.`);
        return;
      }
    }

    try {
      db.saveSolicitante({
        id: solicitante.id,
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

      setIsEditModalOpen(false);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao atualizar dados.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/solicitantes')} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{solicitante.nomeCompleto}</h2>
              {isOng && (
                <span className="font-mono font-black text-xs bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1 rounded-lg">
                  {solicitante.codigoOng || 'ONG'}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {isOng ? 'Perfil da Organização Não Governamental (ONG)' : isOrgao ? 'Órgão Público Solicitante' : 'Perfil do Solicitante de Resgates'}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenEdit}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm transition-all text-xs uppercase tracking-wider"
        >
          <Edit2 size={16} /> Editar Dados
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Card Principal */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col items-center gap-4 border-b pb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${isOng ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                {isOng ? <Building2 size={36} /> : <User size={36} />}
              </div>
              <div className="text-center">
                <h3 className="font-bold text-slate-900 text-base">{solicitante.nomeCompleto}</h3>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 ${isOng ? 'bg-teal-100 text-teal-800' : isOrgao ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  {isOng ? 'ONG / Entidade' : isOrgao ? 'Órgão Público' : 'Cidadão'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Código da ONG */}
              {isOng && solicitante.codigoOng && (
                <div className="p-3 bg-teal-50 border-2 border-teal-200 rounded-xl space-y-1">
                  <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest flex items-center gap-1">
                    <QrCode size={12} /> Código SISBEM da ONG
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-black text-teal-950">{solicitante.codigoOng}</span>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-teal-300 text-teal-800 rounded-lg text-xs font-bold hover:bg-teal-100 transition-colors shadow-sm"
                    >
                      {copiedCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {solicitante.responsavel && (
                <div className="flex items-start gap-3">
                  <User size={18} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Representante / Responsável</p>
                    <p className="text-sm font-semibold text-slate-800">{solicitante.responsavel}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <IdCard size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{isOng ? 'CNPJ / Registro' : 'CPF'}</p>
                  <p className="text-sm font-mono text-slate-700">{solicitante.cpf || 'Não informado'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Telefone</p>
                  <p className="text-sm font-semibold text-slate-800">{solicitante.telefone || 'Não informado'}</p>
                </div>
              </div>

              {solicitante.endereco && (
                <div className="flex items-start gap-3">
                  <Home size={18} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Endereço</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{solicitante.endereco}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-6 rounded-2xl text-white shadow-lg space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-100">Total de Resgates Solicitados</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{animals.length}</span>
              <span className="text-xs font-bold text-teal-100">Animais Registrados</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-teal-600" />
                <h3 className="font-bold text-slate-900">Histórico de Animais Solicitados</h3>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {animals.length} {animals.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4">Animal</th>
                    <th className="px-6 py-4">Data Resgate</th>
                    <th className="px-6 py-4">Local</th>
                    <th className="px-6 py-4">Status Atual</th>
                    <th className="px-6 py-4 text-center">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {animals.map(animal => (
                    <tr key={animal.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${animal.especie === 'Cão' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                            <Dog size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{animal.nome}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{animal.raca}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {format(new Date(animal.dataResgate), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> {animal.localResgate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                          animal.condicao === 'Disponível para Adoção' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          animal.condicao === 'Em Tratamento' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>{animal.condicao}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <Link to={`/animais/ficha/${animal.id}`} className="p-1.5 text-slate-300 group-hover:text-teal-600 group-hover:bg-teal-50 rounded transition-all">
                            <Eye size={18} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {animals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum registro encontrado para este solicitante.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDIÇÃO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                  {formData.tipo === 'ONG' ? <Building2 size={20} /> : <User size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Editar Solicitante / ONG</h3>
                  <p className="text-xs text-slate-500">Atualizar dados cadastrais e código</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
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

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Código da ONG */}
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
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Telefone *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.telefone}
                    onChange={e => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
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
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-teal-600/20"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitanteDetail;
