
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { AnimalCondicao, Especie } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stethoscope, Clock, MapPin, ArrowRight, UserCircle, AlertCircle, Info } from 'lucide-react';
// Fix: Use import * as and cast to any to bypass named export errors
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

const VetWaitlist: React.FC = () => {
  const user = db.getCurrentUser();
  const animals = useMemo(() => db.getAnimalsJoined(), []);
  
  // Filtra animais aguardando atendimento (Resgates ou Atendimentos Externos)
  const waitlist = useMemo(() => {
    return animals
      .filter(a => a.condicao === AnimalCondicao.ACOLHIDO || a.condicao === AnimalCondicao.AGUARDANDO_ATENDIMENTO)
      .sort((a, b) => new Date(a.dataCadastro).getTime() - new Date(b.dataCadastro).getTime());
  }, [animals]);

  if (user?.role !== 'VETERINARIO' && user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500 font-bold">Acesso restrito ao corpo técnico veterinário.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Stethoscope className="text-teal-600" /> Fila de Espera Veterinária
        </h2>
        <p className="text-slate-500">Triagem de prontuários para novos animais e consultas externas.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {waitlist.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Clock size={32} />
            </div>
            <p className="text-slate-500 font-medium">Não há animais aguardando atendimento no momento.</p>
          </div>
        ) : (
          waitlist.map(animal => (
            <div 
              key={animal.id} 
              className={`bg-white rounded-2xl shadow-sm border-2 transition-all overflow-hidden ${
                animal.temTutor 
                ? 'border-indigo-100 hover:border-indigo-300 border-l-[6px] border-l-indigo-600' 
                : 'border-slate-200 hover:border-teal-300 border-l-[6px] border-l-teal-600'
              }`}
            >
              <div className="p-1 px-4 flex justify-between items-center border-b border-slate-50 bg-slate-50/50">
                <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${animal.temTutor ? 'text-indigo-600' : 'text-teal-600'}`}>
                  {animal.temTutor ? (
                    <><UserCircle size={12} /> Atendimento Externo (Com Tutor)</>
                  ) : (
                    <><AlertCircle size={12} /> Resgate / Errante</>
                  )}
                </span>
                <span className="text-[9px] font-bold text-slate-400">ID: {animal.id.substring(0,8).toUpperCase()}</span>
              </div>
              
              <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1 w-full">
                  <div className={`p-4 rounded-2xl shrink-0 ${
                    animal.temTutor ? 'bg-indigo-50 text-indigo-500' : 'bg-teal-50 text-teal-500'
                  }`}>
                    <Stethoscope size={28} />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900 truncate uppercase tracking-tight">{animal.nome}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${animal.especie === Especie.CAO ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {animal.especie}
                      </span>
                    </div>
                    
                    {animal.temTutor && animal.tutor && (
                      <div className="flex items-center gap-1.5 text-indigo-700">
                        <UserCircle size={14} />
                        <p className="text-sm font-bold">Tutor: <span className="uppercase">{animal.tutor.nomeCompleto}</span></p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {animal.temTutor ? 'Endereço:' : 'Local:'} {animal.localResgate}</span>
                      <span className="flex items-center gap-1 font-bold text-teal-600">
                        <Clock size={12} /> Esperando há {formatDistanceToNow(new Date(animal.dataCadastro), { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chegada</p>
                    <p className="text-sm font-black text-slate-700">{new Date(animal.dataCadastro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <Link 
                    to={`/animais/atendimento/${animal.id}`}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 text-white font-black rounded-xl shadow-lg transition-all group ${
                      animal.temTutor 
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' 
                      : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                    }`}
                  >
                    Atender {animal.temTutor ? 'Consulta' : 'Animal'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-xs flex items-start gap-3">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>A fila prioriza a ordem de chegada. Animais com <strong>Atendimento Externo</strong> são consultas clínicas agendadas ou triagens de tutores munícipes. Animais <strong>Errantes</strong> são novos acolhimentos que necessitam de triagem epidemiológica completa.</p>
      </div>
    </div>
  );
};

export default VetWaitlist;
