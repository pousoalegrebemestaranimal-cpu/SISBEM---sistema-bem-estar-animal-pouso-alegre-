/**
 * safeStorage.ts - Gerenciador Seguro de Cache Local do SISBEM
 * 
 * Regras Estritas:
 * 1. O Supabase é a fonte oficial dos dados. O localStorage é apenas cache offline leve.
 * 2. NUNCA armazena fotos em Base64 no localStorage. Armazena apenas URLs públicas / CDN.
 * 3. Limite estrito de registros no localStorage (máx 40 animais mais recentes).
 * 4. Tratamento resiliente de QuotaExceededError: NUNCA quebra o fluxo nem impede gravação no Supabase.
 * 5. Limpeza automática e segura de caches pesados na inicialização e em caso de saturação.
 */

import { Animal } from '../../types';

export const MAX_LOCAL_ANIMALS = 40;

/**
 * Detecta se uma string representa uma foto ou anexo em Base64 Data URI.
 * Critério baseado no formato 'data:image/' (ou 'data:'),
 * preservando integralmente URLs do Supabase Storage, caminhos de arquivos e
 * quaisquer referências válidas de imagem independentemente da extensão ou tamanho da string.
 */
export function isBase64Photo(foto: unknown): boolean {
  if (typeof foto !== 'string' || !foto) return false;
  const trimmed = foto.trim();
  // Identificação pelo formato Data URI
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:')) {
    return true;
  }
  return false;
}

/**
 * Sanitiza um animal para persistência no localStorage:
 * Remove fotos Base64 (preservando URLs de CDN) e campos pesados desnecessários
 */
export function sanitizeAnimalForLocal(animal: Partial<Animal>): Animal {
  const sanitized = { ...animal } as Animal;
  
  // Se contiver Base64, remove do cache local (a foto continuará segura no Supabase/Storage)
  if (isBase64Photo(sanitized.foto)) {
    sanitized.foto = '';
  }

  // Remove campos aninhados gigantescos caso tenham sido incluídos por engano
  delete (sanitized as any).historico;
  delete (sanitized as any).statusLogs;
  delete (sanitized as any).currentOccupation;
  delete (sanitized as any).solicitante;
  delete (sanitized as any).tutor;
  delete (sanitized as any).usuarioResponsavel;

  return sanitized;
}

/**
 * Tenta executar localStorage.setItem com tratamento avançado para QuotaExceededError
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError = 
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014 ||
      (typeof error?.message === 'string' && error.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[SISBEM safeStorage] QuotaExceededError ao gravar '${key}'. Executando saneamento de cache local...`);
      recoverFromQuotaExceeded(key);

      // Tenta novamente com os caches liberados
      try {
        localStorage.setItem(key, value);
        console.info(`[SISBEM safeStorage] Gravação de '${key}' bem-sucedida após saneamento.`);
        return true;
      } catch (retryError) {
        console.warn(`[SISBEM safeStorage] Falha persistente ao salvar '${key}' no localStorage. Os dados permanecem seguros na nuvem/memória.`, retryError);
        return false;
      }
    }

    console.warn(`[SISBEM safeStorage] Erro ao gravar chave '${key}':`, error);
    return false;
  }
}

/**
 * Salva a lista de animais no localStorage de forma limpa:
 * - Sem Base64
 * - Limitada aos MAX_LOCAL_ANIMALS mais recentes
 */
export function safeSetLocalAnimals(animals: Animal[]): boolean {
  try {
    const sanitized = animals
      .map(sanitizeAnimalForLocal)
      .slice(0, MAX_LOCAL_ANIMALS);

    return safeSetItem('sisbem_animals', JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[SISBEM safeStorage] Erro ao salvar sisbem_animals seguro:', err);
    return false;
  }
}

/**
 * Libera espaço no localStorage removendo caches pesados, fotos Base64 legadas e histórico antigo
 */
export function recoverFromQuotaExceeded(triggerKey?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  console.info('[SISBEM safeStorage] Iniciando recuperação de cota:');

  // 1. Limpa fotos Base64 em sisbem_animals e reduz para 20 itens mais recentes
  try {
    const rawAnimals = localStorage.getItem('sisbem_animals');
    if (rawAnimals) {
      const parsed: Animal[] = JSON.parse(rawAnimals);
      const reduced = parsed
        .map(sanitizeAnimalForLocal)
        .slice(0, 20);
      localStorage.setItem('sisbem_animals', JSON.stringify(reduced));
      console.info(`[SISBEM safeStorage] Cache 'sisbem_animals' reduzido de ${parsed.length} para ${reduced.length} itens sem Base64.`);
    }
  } catch (e) {
    try {
      localStorage.removeItem('sisbem_animals');
      console.info('[SISBEM safeStorage] Cache sisbem_animals resetado temporariamente.');
    } catch {}
  }

  // 2. Limpa documentos pesados de tutores (como cadúnico em Base64 antigo)
  try {
    const rawTutores = localStorage.getItem('sisbem_tutores');
    if (rawTutores) {
      const parsed = JSON.parse(rawTutores);
      let modified = false;
      const cleaned = parsed.map((t: any) => {
        if (t.documentoCadUnico && isBase64Photo(t.documentoCadUnico)) {
          modified = true;
          return { ...t, documentoCadUnico: '' };
        }
        return t;
      });
      if (modified) {
        localStorage.setItem('sisbem_tutores', JSON.stringify(cleaned));
        console.info('[SISBEM safeStorage] Documentos pesados em Base64 removidos de sisbem_tutores.');
      }
    }
  } catch (e) {}

  // 3. Reduz logs de status antigos e prontuários volumosos
  try {
    const rawLogs = localStorage.getItem('sisbem_status_logs');
    if (rawLogs) {
      const logs = JSON.parse(rawLogs);
      if (logs.length > 20) {
        localStorage.setItem('sisbem_status_logs', JSON.stringify(logs.slice(-20)));
        console.info('[SISBEM safeStorage] sisbem_status_logs reduzido para os 20 mais recentes.');
      }
    }
  } catch (e) {}

  // 4. Remove chaves temporárias obsoletas
  try {
    const keysToRemove = ['sisbem_temp_draft', 'sisbem_cached_query', 'sisbem_large_payload'];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {}
}

/**
 * Sanitização proativa executada ao iniciar a aplicação:
 * Remove quaisquer fotos em Base64 que estejam atualmente ocupando a quota do navegador
 */
export function sanitizeExistingLocalStorage(): { base64PurgedCount: number; currentAnimalsCount: number } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { base64PurgedCount: 0, currentAnimalsCount: 0 };
  }

  let base64PurgedCount = 0;
  let currentAnimalsCount = 0;

  try {
    const rawAnimals = localStorage.getItem('sisbem_animals');
    if (rawAnimals) {
      const parsed: Animal[] = JSON.parse(rawAnimals);
      currentAnimalsCount = parsed.length;

      let hasBase64 = false;
      const cleaned = parsed.map(animal => {
        if (isBase64Photo(animal.foto)) {
          hasBase64 = true;
          base64PurgedCount++;
          return { ...animal, foto: '' };
        }
        return animal;
      });

      // Se houver fotos em base64 ou mais de MAX_LOCAL_ANIMALS, salva versão saneada
      if (hasBase64 || parsed.length > MAX_LOCAL_ANIMALS) {
        const pruned = cleaned.slice(0, MAX_LOCAL_ANIMALS);
        safeSetItem('sisbem_animals', JSON.stringify(pruned));
        console.info(`[SISBEM safeStorage] Saneamento proativo concluído: ${base64PurgedCount} foto(s) em Base64 removidas do cache local. Total mantido: ${pruned.length} animais.`);
      }
    }

    // Saneia tutores com documentoCadUnico em Base64
    const rawTutores = localStorage.getItem('sisbem_tutores');
    if (rawTutores) {
      const parsed = JSON.parse(rawTutores);
      let tutorCleaned = false;
      const cleanedTutores = parsed.map((t: any) => {
        if (t.documentoCadUnico && isBase64Photo(t.documentoCadUnico)) {
          tutorCleaned = true;
          return { ...t, documentoCadUnico: '' };
        }
        return t;
      });
      if (tutorCleaned) {
        safeSetItem('sisbem_tutores', JSON.stringify(cleanedTutores));
        console.info('[SISBEM safeStorage] Documentos em Base64 removidos de sisbem_tutores no cache local.');
      }
    }
  } catch (e) {
    console.warn('[SISBEM safeStorage] Erro durante saneamento proativo:', e);
  }

  return { base64PurgedCount, currentAnimalsCount };
}

// Executa saneamento imediato ao importar o módulo
if (typeof window !== 'undefined') {
  try {
    sanitizeExistingLocalStorage();
  } catch {}
}
