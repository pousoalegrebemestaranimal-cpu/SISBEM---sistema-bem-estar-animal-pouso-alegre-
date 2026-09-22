
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { Especie, AnimalCondicao, AnimalJoined, CirurgiaStatus } from '../types';
import { 
  Dog, Cat, Calendar, ClipboardCheck, Clock, MapPin, Camera, Stethoscope, Heart, FileText, Scissors
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Dashboard: React.FC = () => {
  const [animals, setAnimals] = useState<AnimalJoined[]>([]);

  useEffect(() => {
    const refresh = () => setAnimals(db.getAnimalsJoined());
    refresh();

    window.addEventListener('sisbem-animals-changed', refresh);
    window.addEventListener('sisbem-occupations-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('sisbem-animals-changed', refresh);
      window.removeEventListener('sisbem-occupations-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stats = React.useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Filtramos apenas os animais que estão efetivamente sob custódia do centro (Ativos e sem tutor)
    const activeAnimals = animals.filter(a => 
      !a.temTutor && ![AnimalCondicao.ADOTADO, AnimalCondicao.OBITO, AnimalCondicao.SOLTURA].includes(a.condicao)
    );

    const cirurgiasAgendadas = db.getCirurgias().filter(c => c.status === CirurgiaStatus.AGENDADA || c.status === CirurgiaStatus.EM_PREPARO).length;
    const naoCastrados = activeAnimals.filter(a => !a.castrado).length;

    return {
      total: activeAnimals.length,
      caes: activeAnimals.filter(a => a.especie === Especie.CAO).length,
      gatos: activeAnimals.filter(a => a.especie === Especie.GATO).length,
      emTratamento: animals.filter(a => !a.temTutor && a.condicao === AnimalCondicao.EM_TRATAMENTO).length,
      disponivelAdocao: animals.filter(a => !a.temTutor && a.condicao === AnimalCondicao.DISPONIVEL_ADOCAO).length,
      cirurgiasAgendadas,
      naoCastrados,
      // O indicador de resgates do mês mostra apenas acolhimentos/resgates de animais sem tutor do mês
      resgatesMes: animals.filter(a => {
        if (a.temTutor || !a.dataResgate) return false;
        const d = new Date(a.dataResgate);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length
    };
  }, [animals]);

  const cards = [
    { label: 'Total em Acolhimento', value: stats.total, icon: ClipboardCheck, color: 'bg-indigo-500' },
    { label: 'Fila Cirúrgica / Agendadas', value: stats.cirurgiasAgendadas, icon: Scissors, color: 'bg-teal-600', link: '/cirurgias/fila' },
    { label: 'Não Castrados (Pendentes)', value: stats.naoCastrados, icon: Scissors, color: 'bg-amber-500', link: '/cirurgias/fila' },
    { label: 'Em Tratamento', value: stats.emTratamento, icon: Stethoscope, color: 'bg-blue-600' },
    { label: 'Para Adoção', value: stats.disponivelAdocao, icon: Heart, color: 'bg-emerald-500' },
    { label: 'Resgates (Mês)', value: stats.resgatesMes, icon: Calendar, color: 'bg-slate-700' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Painel de Controle Interno</h2>
          <p className="text-slate-500">Visão geral das atividades e ocupação atual do Centro.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/relatorios"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <FileText size={16} /> Emitir Relatórios
          </Link>
          <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200">
            {format(new Date(), "eeee, d 'de' MMMM", { locale: ptBR })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const CardContent = (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all group h-full">
              <div className={`${card.color} p-3 rounded-xl shadow-inner group-hover:scale-110 transition-transform`}>
                <Icon className="text-white" size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{card.label}</p>
                <p className="text-2xl font-black text-slate-900">{card.value}</p>
              </div>
            </div>
          );

          if (card.link) {
            return (
              <Link key={idx} to={card.link} className="block transition-transform hover:-translate-y-0.5">
                {CardContent}
              </Link>
            );
          }

          return (
            <div key={idx}>
              {CardContent}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Clock size={18} className="text-teal-600" /> Resgates Mais Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Animal</th>
                <th className="px-6 py-4">Status Atual</th>
                <th className="px-6 py-4">Local do Resgate</th>
                <th className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {animals.slice(0, 10).map((animal) => (
                <tr key={animal.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => window.location.hash = `#/animais/ficha/${animal.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-slate-300">
                        {animal.foto ? (
                          <img src={animal.foto} alt={animal.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Camera size={14} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors text-sm">{animal.nome}</div>
                        <div className="text-[10px] font-medium text-slate-400">{animal.raca} • {animal.especie}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      animal.condicao === AnimalCondicao.DISPONIVEL_ADOCAO ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      animal.condicao === AnimalCondicao.EM_TRATAMENTO ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      animal.condicao === AnimalCondicao.SOLTURA ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      animal.condicao === AnimalCondicao.ACOLHIDO ? 'bg-amber-50 text-amber-700 border-amber-300' :
                      animal.condicao === AnimalCondicao.AGUARDANDO_ATENDIMENTO ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      animal.condicao === AnimalCondicao.OBITO ? 'bg-slate-900 text-white border-slate-900' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>{animal.condicao}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="truncate max-w-[200px]">{animal.localResgate}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">
                    {format(new Date(animal.dataResgate), 'dd/MM/yyyy')}
                  </td>
                </tr>
              ))}
              {animals.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum animal cadastrado no sistema.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
