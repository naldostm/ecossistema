-- 🏗️ MÓDULO PMOC: UPLOAD DE FOTOS (V8)
-- Adiciona suporte para galeria de imagens para cada equipamento.

-- 1. [PARQUE DE EQUIPAMENTOS] - Adicionar fotos_url (array de strings)
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS fotos_url TEXT[] DEFAULT '{}';
COMMENT ON COLUMN public.parque_equipamentos.fotos_url IS 'URLs das imagens hospedadas no Supabase Storage.';

-- 2. [STORAGE] - Garantir permissões de acesso ao bucket documentos_pmoc
-- (Assume-se que o bucket documentos_pmoc já foi criado pelo script schema_storage_buckets.sql)
DO $$
BEGIN
    -- Permitir que qualquer usuário autenticado insira e leia fotos no PMOC
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso_Total_Equipamentos_Storage') THEN
        CREATE POLICY "Acesso_Total_Equipamentos_Storage" 
        ON storage.objects FOR ALL 
        USING ( bucket_id = 'documentos_pmoc' );
    END IF;
END $$;
