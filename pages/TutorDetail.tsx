
import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeft, IdCard, Phone, UserCircle, Calendar, ClipboardCheck, Dog, MapPin, Eye, Home, HeartPulse, User, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TutorDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const tutor = useMemo(() => db.getTutores().find(t => t.id === id), [id]);
  const animals = useMemo(() => id ? db.getAnimalsByTutor(id) : [], [id]);

  const handleOpenDoc = (base64: string) => {
    const win = window.open();
    if (win) {
      win.document.write(
        `<html><head><title>Comprovante CadÚnico - ${tutor?.nomeCompleto}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;background:#1e293b;}</style></head><body>` +
        (base64.startsWith('data:application/pdf') 
          ? `<embed width="100%" height="100%" src="${base64}" type="application/pdf">`
          : `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`) +
        `</body></html>`
      );
      win.document.close();
    }
  };

  if (!tutor) return <div className="p-8 text-center text-slate-500 font-bold">Tutor não encontrado no sistema.</div>;

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/tutores')} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{tutor.nomeCompleto}</h2>
          <p className="text-sm text-slate-500 font-medium">Responsável Legal por Animais Externos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col items-center gap-4 border-b pb-6 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border-4 border-white shadow-md">
                <User size={40} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Tutor</p>
                <h3 className="font-black text-slate-900 uppercase text-sm">{tutor.nomeCompleto}</h3>
                <span className="bg-indigo-600 text-white text-[9px] font-black px-3 py-0.5 rounded-full uppercase mt-2 inline-block">Tutor Cadastrado</span>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><IdCard size={16} /></div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Documento CPF</p>
                  <p className="text-sm font-mono font-bold text-slate-700">{tutor.cpf}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><Phone size={16} /></div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Telefone / Contato</p>
                  <p className="text-sm font-bold text-slate-700">{tutor.telefone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><Home size={16} /></div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Endereço Residencial</p>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{tutor.endereco || 'Endereço não informado'}</p>
                </div>
              </div>
            </div>

            {/* CADUNICO SECTION */}
            <div className="pt-6 border-t border-slate-100">
               <div className={`p-4 rounded-2xl border-2 transition-all ${tutor.temCadUnico ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-xl ${tutor.temCadUnico ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-white'}`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Beneficiário</p>
                      <p className={`text-xs font-black uppercase ${tutor.temCadUnico ? 'text-indigo-700' : 'text-slate-500'}`}>CadÚnico: {tutor.temCadUnico ? 'Sim' : 'Não'}</p>
                    </div>
                  </div>
                  {tutor.temCadUnico && tutor.documentoCadUnico && (
                    <button 
                      onClick={() => handleOpenDoc(tutor.documentoCadUnico!)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-indigo-200 text-indigo-600 text-[10px] font-black uppercase rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                      <FileText size={14} /> Ver Comprovante
                    </button>
                  )}
               </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-600/20 space-y-1 overflow-hidden relative group">
            <HeartPulse size={80} className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Cuidado Continuado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{animals.length}</span>
              <span className="text-xs font-bold text-indigo-100 uppercase">Paciente(s) Vinculado(s)</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dog size={20} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900">Histórico de Animais sob Responsabilidade</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4">Animal</th>
                    <th className="px-6 py-4">Cadastrado em</th>
                    <th className="px-6 py-4">Status / Condição</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {animals.map(animal => (
                    <tr key={animal.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${animal.especie === 'Cão' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                            <Dog size={18} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm uppercase">{animal.nome}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{animal.raca} • {animal.sexo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {format(new Date(animal.dataCadastro), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                          animal.condicao === 'Atendido' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          animal.condicao === 'Em Tratamento' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>{animal.condicao}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <Link to={`/animais/ficha/${animal.id}`} className="p-2 text-slate-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-xl transition-all" title="Ver Ficha Clínica">
                            <Eye size={18} />
                          </Link>
                          <Link to={`/animais/atendimento/${animal.id}`} className="p-2 text-slate-300 group-hover:text-teal-600 group-hover:bg-teal-50 rounded-xl transition-all" title="Novo Atendimento">
                            <HeartPulse size={18} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {animals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-medium">Nenhum animal vinculado a este tutor.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-8 text-white flex items-center justify-between shadow-lg">
             <div className="space-y-1">
                <h4 className="text-lg font-black uppercase tracking-tight">Vincular Novo Animal</h4>
                <p className="text-slate-400 text-xs font-medium">O tutor trouxe um novo animal para consulta clínica?</p>
             </div>
             <Link to="/animais/novo" className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 text-xs uppercase tracking-widest">Novo Registro p/ Tutor</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorDetail;
