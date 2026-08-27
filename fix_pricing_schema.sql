-- ==============================================================================
-- 📊 FIX: PRICING SCHEMA (AUTO-CALCULATION) - ECOSSISTEMA ARNALDO TRENTIN
-- ==============================================================================

-- 1. ORDENS DE SERVIÇO: Consolidado para exibir no Kanban e calcular Obra
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS valor_total NUMERIC(15,2) DEFAULT 0.00;

-- 2. OBRAS: Composição de Orçamento a partir das OSs vinculadas
-- Se orcamento não existir, cria. Se existir, apenas garantimos os extras.
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS valor_base_os NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS acrescimo NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS orcamento NUMERIC(15,2) DEFAULT 0.00;

-- Nota: orcamento será o VALOR FINAL: base + acrescimo - desconto.
