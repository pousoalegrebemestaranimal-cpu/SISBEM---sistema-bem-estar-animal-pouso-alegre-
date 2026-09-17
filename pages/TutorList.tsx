
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { Tutor } from '../types';
import { Search, UserCircle, Eye, Phone, IdCard, HeartPulse, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const TutorList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const tutores = useMemo(() => {
    const list = db.getTutores();
    const animals = db.getAnimals();
    
    return list.map(t => ({
      ...t,
      animalCount: animals.filter(a => a.tutorId === t.id).length
    })).sort((a, b) => b.animalCount - a.animalCount);
  }, []);

  const filtered = useMemo(() => {
    return tutores.filter(t => 
      t.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.cpf.includes(searchTerm)
    );
  }, [tutores, searchTerm]);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Atenção: Ao remover o tutor "${name}", todos os seus animais cadastrados perderão o vínculo legal de responsabilidade. Deseja prosseguir?`)) {
      db.deleteTutor(id);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCircle className="text-indigo-600" /> Banco de Tutores
          </h2>
          <p className="text-slate-500">Gestão de proprietários e responsáveis legais por animais externos.</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Base de Dados</p>
          <p className="text-sm font-black text-indigo-700">{tutores.length} Tutores Ativos</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar tutor por nome ou CPF..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Tutor Responsável</th>
              <th className="px-6 py-4">CPF</th>
              <th className="px-6 py-4 text-center">Animais</th>
              <th className="px-6 py-4">Contato / Endereço</th>
              <th className="px-6 py-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                      <UserCircle size={24} />
                    </div>
                    <div className="font-bold text-slate-900 uppercase text-sm">{t.nomeCompleto}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                  {t.cpf}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${t.animalCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    {t.animalCount} {t.animalCount === 1 ? 'ANIMAL' : 'ANIMAIS'}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {t.telefone}</div>
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]"><IdCard size={12} className="text-slate-400" /> {t.endereco || 'Endereço não informado'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-2">
                    <Link to={`/tutores/${t.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Histórico Clínico do Tutor"><Eye size={18} /></Link>
                    <button onClick={() => handleDelete(t.id, t.nomeCompleto)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-medium">Nenhum tutor localizado na base de dados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TutorList;
