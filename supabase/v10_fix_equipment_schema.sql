-- Incremento de Esquema: Alinhamento Parque de Equipamentos
-- Descrição: Adiciona colunas para contrato e fotos de equipamentos.

-- Adicionar colunas faltantes para sincronia com o Frontend
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos_pmoc(id) ON DELETE SET NULL;
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS fotos_url TEXT[];
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);

-- Garantir que a coluna de capacidade seja compatível (as vezes vem string do front)
-- ALTER TABLE public.parque_equipamentos ALTER COLUMN capacidade_btu TYPE VARCHAR(50); -- Opcional, mantivemos INTEGER

-- Recarregar cache do postgrest
NOTIFY pgrst, 'reload schema';
