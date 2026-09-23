import { useState, useEffect } from 'react';

/**
 * Hook para atrasar a atualização de um valor (debounce)
 * Evita consultas ou re-renderizações excessivas durante a digitação
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
