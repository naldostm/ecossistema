-- ==============================================================================
-- SCHEMA UPDATE: Ferramentas (Trackeamento de Cautela e QR Code)
-- Execute este script no SQL Editor do Supabase.
-- ==============================================================================

-- 1. Coluna de relacionamento: Define qual colaborador (Técnico) tem a posse temporária
ALTER TABLE public.ferramentas 
ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL;

-- 2. Coluna para Etiquetagem Inteligente QR Code
ALTER TABLE public.ferramentas 
ADD COLUMN IF NOT EXISTS qr_code_id VARCHAR(50);
