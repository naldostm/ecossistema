-- ==============================================================================
-- SCHEMA SUPABASE STORAGE (FASE 6 - INTEGRAÇÃO DE ARQUIVOS)
-- Execute este script no "SQL Editor" do seu Supabase.
-- ==============================================================================

-- 1. Criação Categórica das "Gavetas" (Buckets Públicos)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('documentos_pmoc', 'documentos_pmoc', true),
  ('conteudo_tecnico_obras', 'conteudo_tecnico_obras', true),
  ('master_base_ia', 'master_base_ia', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Concessão de Permissão (RLS) - Permite Visualização e Leitura pelo Sistema HTML e n8n
CREATE POLICY "Leitura_Publica_Storage" 
ON storage.objects FOR SELECT 
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

-- 3. Concessão de Permissão (RLS) - Permite Envio de Arquivos pelas IAs (Webhook) e Dashboard
CREATE POLICY "Envio_Publico_Storage" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

-- 4. Concessão de Permissão (RLS) - Permite Exclusão/Sobrescrita de dados (Arquivos Antigos)
CREATE POLICY "Modificacao_Publica_Storage" 
ON storage.objects FOR UPDATE 
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

CREATE POLICY "Delecao_Publica_Storage" 
ON storage.objects FOR DELETE 
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );
