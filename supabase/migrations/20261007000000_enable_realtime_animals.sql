-- ==============================================================================
-- SISBEM - Sistema Integrado de Saúde e Bem-Estar Animal
-- MIGRATION: Habilitar Realtime para public.animals
-- Versão: 20261007000000_enable_realtime_animals.sql
-- ==============================================================================

-- Adiciona a tabela public.animals à publicação supabase_realtime caso ainda não esteja presente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'animals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.animals;
  END IF;
END $$;
