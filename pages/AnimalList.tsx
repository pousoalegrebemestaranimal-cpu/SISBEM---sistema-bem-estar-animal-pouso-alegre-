
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../services/db';
import { AnimalJoined, Especie, AnimalCondicao } from '../types';
import { useDebounce } from '../src/hooks/useDebounce';
import { Pagination } from '../components/Pagination';
import { fetchAnimalsPaginated } from '../src/lib/supabaseQueries';
import { getThumbnailUrl } from '../src/lib/storageService';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, Edit2, Trash2, Filter, Heart, Stethoscope, Clock, Eye, AlertCircle, Camera, Leaf, UserCheck, Skull, UserCircle, MapPin, CheckCircle2, Home, Cpu, Printer, Scissors, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { printAnimalSheet } from '../utils/printAnimalSheet';

const PAGE_SIZE = 20;

const AnimalList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [filterEspecie, setFilterEspecie] = useState<string>('TODOS');
  const [filterCondicao, setFilterCondicao] = useState<string>('TODOS');
  const [filterOrigem, setFilterOrigem] = useState<string>('TODOS');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [animals, setAnimals] = useState<AnimalJoined[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Consulta paginada REAL NO BANCO SUPABASE com LIMIT/RANGE e FILTROS no servidor PostgREST
  const loadPaginatedAnimals = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetchAnimalsPaginated({
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        especie: filterEspecie,
        condicao: filterCondicao,
        origem: filterOrigem
      });

      setAnimals(res.data);
      setTotalCount(res.totalCount);
    } catch (e) {
      console.warn('Erro ao carregar página de animais:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [currentPage, debouncedSearch, filterEspecie, filterCondicao, filterOrigem]);

  useEffect(() => {
    loadPaginatedAnimals();
  }, [loadPaginatedAnimals]);

  // Escuta alterações de animais vindas de outros usuários ou abas
  useEffect(() => {
    const handleAnimalsChanged = () => {
      loadPaginatedAnimals();
    };

    window.addEventListener('sisbem-animals-changed', handleAnimalsChanged);
    window.addEventListener('storage', handleAnimalsChanged);

    return () => {
      window.removeEventListener('sisbem-animals-changed', handleAnimalsChanged);
      window.removeEventListener('storage', handleAnimalsChanged);
    };
  }, [loadPaginatedAnimals]);

  // Reseta para a página 1 ao alterar filtros ou busca
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterEspecie, filterCondicao, filterOrigem]);

  const handleManualSync = async () => {
    await loadPaginatedAnimals();
  };

  const handleDelete = (id: string) => {
    db.deleteAnimal(id);
    setShowDeleteConfirm(null);
    loadPaginatedAnimals();
  };

  const renderCondicaoBadge = (condicao: AnimalCondicao) => {
    switch (condicao) {
      case AnimalCondicao.DISPONIVEL_ADOCAO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-emerald-50 text-emerald-700 border-emerald-200"><Heart size={10} className="fill-emerald-600" /> {condicao}</span>;
      case AnimalCondicao.EM_TRATAMENTO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-blue-50 text-blue-700 border-blue-200"><Stethoscope size={10} /> {condicao}</span>;
      case AnimalCondicao.SOLTURA:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-teal-50 text-teal-700 border-teal-200"><Leaf size={10} /> {condicao}</span>;
      case AnimalCondicao.ADOTADO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200"><UserCheck size={10} /> {condicao}</span>;
      case AnimalCondicao.OBITO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-slate-900 text-white border-slate-900"><Skull size={10} /> {condicao}</span>;
      case AnimalCondicao.ATENDIDO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-indigo-50 text-indigo-600 border-indigo-200"><CheckCircle2 size={10} /> {condicao}</span>;
      case AnimalCondicao.AGUARDANDO_ATENDIMENTO:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200"><Clock size={10} /> {condicao}</span>;
      case AnimalCondicao.ACOLHIDO:
      default:
        return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-300"><Clock size={10} /> {condicao || 'Acolhido'}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lista de Animais</h2>
          <p className="text-slate-500 text-sm">Gerencie todos os registros cadastrados.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Atualizar lista com dados da nuvem"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-all text-sm disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={16} className={`text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>
          <Link to="/animais/novo" className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 transition-all text-sm"><Plus size={18} /> Novo Cadastro</Link>
        </div>
      </div>

      {/* Abas de Origem: Todos, Internos, Externos */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setFilterOrigem('TODOS')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            filterOrigem === 'TODOS'
              ? 'border-teal-600 text-teal-600 font-extrabold bg-teal-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Todos os Animais <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">{animals.length}</span>
        </button>
        <button
          onClick={() => setFilterOrigem('INTERNO')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            filterOrigem === 'INTERNO'
              ? 'border-teal-600 text-teal-600 font-extrabold bg-teal-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Internos (Sem Tutor) <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full">{animals.filter(a => !a.temTutor).length}</span>
        </button>
        <button
          onClick={() => setFilterOrigem('EXTERNO')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            filterOrigem === 'EXTERNO'
              ? 'border-teal-600 text-teal-600 font-extrabold bg-teal-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Externos (Com Tutor) <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full">{animals.filter(a => a.temTutor).length}</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar por nome, raça, tutor ou solicitante..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <select className="bg-slate-50 border rounded-lg px-3 py-1.5 text-xs font-bold" value={filterEspecie} onChange={e => setFilterEspecie(e.target.value)}>
            <option value="TODOS">Todas Espécies</option>
            <option value={Especie.CAO}>Cães</option>
            <option value={Especie.GATO}>Gatos</option>
          </select>
          <select className="bg-slate-50 border rounded-lg px-3 py-1.5 text-xs font-bold" value={filterCondicao} onChange={e => setFilterCondicao(e.target.value)}>
            <option value="TODOS">Todas Condições</option>
            {Object.values(AnimalCondicao).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Animal</th>
              <th className="px-6 py-4">Espécie / Sexo</th>
              <th className="px-6 py-4">Origem / Data</th>
              <th className="px-6 py-4">Responsável (Tutor/Sol.)</th>
              <th className="px-6 py-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {animals.map(animal => (
              <tr key={animal.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-slate-300">
                      {animal.foto ? (
                        <img src={getThumbnailUrl(animal.foto)} alt={animal.nome} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={16} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-black text-slate-900 text-sm uppercase">{animal.nome}</div>
                        {animal.temTutor ? (
                          <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-tighter">
                            <UserCircle size={10} /> Externo
                          </span>
                        ) : (
                          <span className="bg-teal-100 text-teal-800 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-tighter">
                            <Home size={10} /> Interno
                          </span>
                        )}
                        {animal.microchipado && (
                          <span className="bg-teal-50 text-teal-800 text-[8px] font-black font-mono px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-1 uppercase tracking-tight" title={`Microchip: ${animal.numeroMicrochip || 'Sim'}`}>
                            <Cpu size={10} className="text-teal-600" /> {animal.numeroMicrochip || 'CHIP'}
                          </span>
                        )}
                      </div>
                      <div>{renderCondicaoBadge(animal.condicao)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${animal.especie === Especie.CAO ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{animal.especie}</span>
                    {animal.castrado ? (
                      <Link to={`/cirurgias/fila?animalId=${animal.id}`} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-0.5" title="Animal Castrado - Clique para Agendar Outra Cirurgia">
                        Castrado <Scissors size={8} className="opacity-60" />
                      </Link>
                    ) : animal.agendamentoCastracaoAtivo ? (
                      <Link to="/cirurgias/fila" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-0.5" title="Castração Agendada">
                        <Scissors size={8} /> Agendado
                      </Link>
                    ) : (
                      <Link to={`/cirurgias/fila?animalId=${animal.id}`} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 flex items-center gap-0.5" title="Não Castrado - Clique para Agendar">
                        <Scissors size={8} /> Não Castrado
                      </Link>
                    )}
                  </div>
                  <div className="mt-1 text-slate-400 font-bold uppercase">{animal.sexo} • {animal.peso}kg{animal.idade ? ` • ${animal.idade}` : ''}</div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-600">
                  <div className="font-black">{format(new Date(animal.dataResgate), 'dd/MM/yyyy')}</div>
                  <div className="text-slate-400 truncate max-w-[150px] mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {animal.localResgate}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-700">
                  <div className="flex flex-col">
                    <span className="uppercase truncate max-w-[150px]">
                      {animal.temTutor ? animal.tutor?.nomeCompleto : animal.solicitante?.nomeCompleto}
                    </span>
                    <span className={`text-[9px] font-medium uppercase tracking-tighter ${animal.temTutor ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {animal.temTutor ? 'Tutor Responsável' : 'Solicitante Original'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-1.5">
                    {!animal.castrado && (
                      <Link 
                        to={`/cirurgias/fila?animalId=${animal.id}`} 
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" 
                        title={animal.agendamentoCastracaoAtivo ? "Ver Castração Agendada" : "Agendar Castração"}
                      >
                        <Scissors size={18} />
                      </Link>
                    )}
                    <button onClick={() => printAnimalSheet(animal)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all" title="Imprimir Ficha do Animal"><Printer size={18} /></button>
                    <Link to={`/animais/ficha/${animal.id}`} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="Ficha Clínica"><Eye size={18} /></Link>
                    <Link to={`/animais/editar/${animal.id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar Animal"><Edit2 size={18} /></Link>
                    <button onClick={() => setShowDeleteConfirm(animal.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir Animal"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {animals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum registro encontrado no sistema.</td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemName="animais"
        />
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="bg-red-100 text-red-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto"><AlertCircle size={24} /></div>
              <h3 className="text-xl font-bold">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 font-medium">Deseja remover este registro do sistema? Esta ação é irreversível e apagará todos os prontuários associados.</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimalList;
