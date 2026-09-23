import { supabase } from './supabase';

export const ANIMAL_PHOTOS_BUCKET = 'animal-photos';

/**
 * Converte base64 dataURL para Blob
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/jpeg';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Compacta e redimensiona uma imagem para WebP/JPEG antes de salvar
 */
export async function compressImage(fileOrBase64: File | string, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Falha ao instanciar canvas 2D'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Erro ao converter imagem compactada'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = (e) => reject(e);

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrBase64);
    }
  });
}

/**
 * Faz upload de foto de animal para o Supabase Storage.
 * Retorna a URL pública ou caminho do Storage.
 * Se o bucket de Storage não estiver disponível no Supabase, retorna fallback seguro.
 */
export async function uploadAnimalPhoto(
  animalId: string,
  fileOrBase64: File | string
): Promise<string> {
  try {
    // 1. Compacta imagem para WebP de tamanho controlado (<150KB)
    const compressedBlob = await compressImage(fileOrBase64, 1200, 0.82);
    const fileName = `${animalId}_${Date.now()}.webp`;
    const filePath = `animals/${fileName}`;

    // 2. Faz o upload para o bucket 'animal-photos' no Supabase Storage
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .upload(filePath, compressedBlob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadErr) {
      console.warn('Supabase Storage upload warning:', uploadErr.message);
      // Se der erro de permissão ou bucket inexistente, retorna base64 compactado como fallback
      if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image/')) {
        return fileOrBase64;
      }
      return '';
    }

    // 3. Obtém a URL pública do arquivo no CDN do Supabase
    const { data: publicUrlData } = supabase.storage
      .from(ANIMAL_PHOTOS_BUCKET)
      .getPublicUrl(uploadData?.path || filePath);

    return publicUrlData?.publicUrl || filePath;
  } catch (err) {
    console.warn('Erro ao enviar imagem para o Storage:', err);
    if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image/')) {
      return fileOrBase64;
    }
    return '';
  }
}

/**
 * Verifica se a string é uma imagem Base64
 */
export function isBase64Image(str?: string | null): boolean {
  if (!str) return false;
  return str.startsWith('data:image/');
}

/**
 * Retorna URL de thumbnail otimizada
 */
export function getThumbnailUrl(photo?: string | null): string {
  if (!photo) return '';
  // Se for URL do Supabase Storage, podemos usar parâmetros de transformação de imagem do CDN
  if (photo.startsWith('http') && photo.includes('supabase.co/storage/v1/object/public/')) {
    return `${photo}?width=120&height=120&resize=cover`;
  }
  return photo;
}

/**
 * Estratégia de migração segura de fotos antigas (Base64 -> Supabase Storage):
 * - Varre registros locais/remotos com foto em Base64
 * - Faz upload de cada uma para o bucket
 * - Atualiza a coluna foto com a nova URL
 * - Mantém a foto original caso ocorra qualquer erro
 */
export async function migrateLegacyPhotosToStorage(
  animals: Array<{ id: string; foto?: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<{ migrated: number; skipped: number; errors: string[] }> {
  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const targets = animals.filter(a => isBase64Image(a.foto));
  const total = targets.length;

  for (let i = 0; i < targets.length; i++) {
    const animal = targets[i];
    if (!animal.foto) {
      skipped++;
      continue;
    }

    try {
      const publicUrl = await uploadAnimalPhoto(animal.id, animal.foto);
      if (publicUrl && !publicUrl.startsWith('data:image/')) {
        // Atualiza no Supabase sem retornar linhas (.select() não é chamado)
        const { error: updateErr } = await supabase
          .from('animals')
          .update({ foto: publicUrl })
          .eq('id', animal.id);

        if (updateErr) {
          errors.push(`Animal ${animal.id}: ${updateErr.message}`);
        } else {
          migrated++;
        }
      } else {
        skipped++;
      }
    } catch (e: any) {
      errors.push(`Animal ${animal.id}: ${e.message}`);
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { migrated, skipped, errors };
}
