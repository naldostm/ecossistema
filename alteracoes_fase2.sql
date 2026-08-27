-- 1. ADICIONA OBRIGATORIEDADE DE WHATSAPP NOS COLABORADORES
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS telefone_whatsapp text;

-- 2. EVOLUÇÃO DO ESTOQUE (MÚLTIPLOS PREÇOS E USOS)
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS preco_compra numeric DEFAULT 0;
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS campo_uso text DEFAULT 'Uso Geral';

-- 3. RASTREABILIDADE DE FERRAMENTAS 
ALTER TABLE public.ferramentas ADD COLUMN IF NOT EXISTS local_atual text DEFAULT 'Depósito Central';
ALTER TABLE public.ferramentas ADD COLUMN IF NOT EXISTS estado_conservacao text DEFAULT 'Manutenção em Dia';

-- 4. ARQUITETURA AVANÇADA DE SERVIÇOS (SUPORTE JSON)
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Sem Categoria';
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS descritivo_json jsonb DEFAULT '{}'::jsonb;
