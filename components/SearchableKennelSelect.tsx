import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Home, Layers, Sparkles, AlertCircle } from 'lucide-react';
import { Kennel, KennelOccupation, KennelType } from '../types';
import { getAllActiveOccupations } from '../src/lib/supabaseQueries';

export interface KennelOption {
  id: string;
  name: string;
  type: string;
  capacity: number;
  availableVacancies: number;
  isRecommended?: boolean;
}

interface SearchableKennelSelectProps {
  value: string;
  onChange: (kennelId: string) => void;
  kennels: Kennel[];
  occupations: KennelOccupation[];
  currentKennelId?: string;
  recommendedType?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

const SECTOR_BADGES: Record<string, { bg: string; text: string }> = {
  [KennelType.QUARENTENA]: { bg: 'bg-amber-100', text: 'text-amber-800' },
  [KennelType.INDIVIDUAL]: { bg: 'bg-blue-100', text: 'text-blue-800' },
  [KennelType.COLETIVA]: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  [KennelType.GATIL]: { bg: 'bg-purple-100', text: 'text-purple-800' },
  [KennelType.PRE_OPERATORIO]: { bg: 'bg-rose-100', text: 'text-rose-800' },
  [KennelType.POS_OPERATORIO]: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
};

export const SearchableKennelSelect: React.FC<SearchableKennelSelectProps> = ({
  value,
  onChange,
  kennels,
  occupations,
  currentKennelId,
  recommendedType,
  placeholder = '-- Selecione uma baia --',
  required = false,
  disabled = false,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('TODOS');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 1. Processa e filtra todas as baias que possuem vagas livres, em estrita ORDEM CRESCENTE
  const availableOptions = useMemo(() => {
    const activeOccs = getAllActiveOccupations(occupations);
    const options: KennelOption[] = [];

    for (const k of kennels) {
      if (!k || !k.id || !k.name) continue;
      // Não exibe a baia atual onde o animal já está alocado
      if (currentKennelId && k.id === currentKennelId) continue;

      const activeCount = activeOccs.filter(o => o.kennelId === k.id).length;
      const capacity = Number(k.capacity) || 1;
      const availableVacancies = capacity - activeCount;

      // Apenas baias com capacidade restante
      if (availableVacancies > 0) {
        const isRec = !!(
          recommendedType &&
          k.type &&
          k.type.toLowerCase().trim() === recommendedType.toLowerCase().trim()
        );

        options.push({
          id: k.id,
          name: k.name,
          type: k.type,
          capacity,
          availableVacancies,
          isRecommended: isRec,
        });
      }
    }

    // Ordenação Natural Crescente (ex: Individual 01, Individual 02, ..., Individual 54)
    return options.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [kennels, occupations, currentKennelId, recommendedType]);

  // Setores disponíveis com contagem de baias livres
  const sectorsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    availableOptions.forEach(o => {
      map.set(o.type, (map.get(o.type) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableOptions]);

  // 2. Filtra pela pesquisa digitada e pelo setor selecionado
  const displayedOptions = useMemo(() => {
    let list = availableOptions;

    if (selectedSector !== 'TODOS') {
      list = list.filter(o => o.type.toLowerCase().trim() === selectedSector.toLowerCase().trim());
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(o =>
        o.name.toLowerCase().includes(term) ||
        o.type.toLowerCase().includes(term)
      );
    }

    return list;
  }, [availableOptions, selectedSector, searchTerm]);

  // Identifica a baia atualmente selecionada para exibição
  const selectedKennel = useMemo(() => {
    if (!value) return null;
    return kennels.find(k => k.id === value) || null;
  }, [value, kennels]);

  // Vagas da baia selecionada
  const selectedVacancies = useMemo(() => {
    if (!selectedKennel) return null;
    const activeOccs = getAllActiveOccupations(occupations);
    const activeCount = activeOccs.filter(o => o.kennelId === selectedKennel.id).length;
    return (Number(selectedKennel.capacity) || 1) - activeCount;
  }, [selectedKennel, occupations]);

  // Foco no campo de busca ao abrir o dropdown
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setSelectedSector('TODOS');
    }
  }, [isOpen]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < displayedOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : displayedOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < displayedOptions.length) {
        handleSelect(displayedOptions[focusedIndex].id);
      }
    }
  };

  const handleSelect = (kennelId: string) => {
    onChange(kennelId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Input oculto nativo para validação obrigatória de formulário HTML */}
      <input
        type="text"
        id={id}
        name="kennelId"
        value={value}
        required={required}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Botão Gatilho / Seletor */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl flex items-center justify-between text-left transition-all duration-150 outline-none ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-200'
            : isOpen
            ? 'bg-white border-teal-500 ring-2 ring-teal-500 shadow-sm'
            : 'border-slate-200 hover:border-teal-400 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden pr-2">
          <div className={`p-1.5 rounded-lg shrink-0 ${selectedKennel ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>
            <Home size={16} />
          </div>

          {selectedKennel ? (
            <div className="truncate flex items-center gap-2">
              <span className="font-black text-slate-800 text-sm">{selectedKennel.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                SECTOR_BADGES[selectedKennel.type]?.bg || 'bg-slate-200'
              } ${SECTOR_BADGES[selectedKennel.type]?.text || 'text-slate-700'}`}>
                {selectedKennel.type}
              </span>
              {selectedVacancies !== null && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                  {selectedVacancies === 1 ? '1 vaga livre' : `${selectedVacancies} vagas livres`}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium text-sm">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as any); }}
              title="Limpar seleção"
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-600' : ''}`}
          />
        </div>
      </button>

      {/* Painel Dropdown com Barra de Pesquisa e Lista Ordenada Crescente */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Cabeçalho de Pesquisa */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setFocusedIndex(-1);
                }}
                placeholder="Pesquisar baia por nome, número ou setor..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Chips de Filtro Rápido por Setor */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSector('TODOS')}
                className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] tracking-wider shrink-0 transition-colors ${
                  selectedSector === 'TODOS'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todas ({availableOptions.length})
              </button>
              {sectorsWithCounts.map(([type, count]) => {
                const isSelected = selectedSector === type;
                const isRecType = recommendedType && type.toLowerCase().trim() === recommendedType.toLowerCase().trim();
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedSector(type)}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] tracking-wider shrink-0 transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-sm'
                        : isRecType
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isRecType && <Sparkles size={10} className="text-amber-500" />}
                    {type} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista com Rolagem das Baias em Ordem Crescente */}
          <div ref={listRef} className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
            {displayedOptions.length > 0 ? (
              displayedOptions.map((k, index) => {
                const isSelected = value === k.id;
                const isFocused = focusedIndex === index;
                const badge = SECTOR_BADGES[k.type] || { bg: 'bg-slate-100', text: 'text-slate-700' };

                return (
                  <div
                    key={k.id}
                    onClick={() => handleSelect(k.id)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200'
                        : isFocused
                        ? 'bg-slate-100 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-teal-600' : 'bg-slate-300'}`} />
                      
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{k.name}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                            {k.type}
                          </span>
                          {k.isRecommended && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black px-1.5 py-0.2 rounded uppercase flex items-center gap-0.5 tracking-wider">
                              <Sparkles size={9} /> Recomendado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        {k.availableVacancies === 1 ? '1 vaga' : `${k.availableVacancies} vagas`}
                      </span>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center space-y-2">
                <AlertCircle size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">Nenhuma baia disponível encontrada</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {searchTerm
                    ? `Nenhum resultado para "${searchTerm}". Tente buscar por outro número ou setor.`
                    : 'Todas as baias com estas características encontram-se lotadas no momento.'}
                </p>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedSector('TODOS');
                    }}
                    className="mt-2 text-xs font-bold text-teal-600 hover:text-teal-700 underline"
                  >
                    Limpar pesquisa e filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Rodapé Informativo */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center font-medium">
            <span>
              {displayedOptions.length} de {availableOptions.length} {availableOptions.length === 1 ? 'baia disponível' : 'baias disponíveis'} (ordem crescente)
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
              SISBEM Acomodações
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
