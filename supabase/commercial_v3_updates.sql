-- 💾 EVOLUÇÃO COMERCIAL V3: ORÇAMENTISTA DINÂMICO
-- Suporte para lista de itens e ajustes manuais (descontos/acréscimos)

-- 1. Expansão para Itens Dinâmicos
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS itens_json JSONB DEFAULT '[]';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS valor_ajuste DECIMAL(12,2) DEFAULT 0;

-- 2. Comentários para documentação
COMMENT ON COLUMN propostas.itens_json IS 'Lista estruturada de serviços e materiais selecionados [ {id, nome, qtd, preco_unit, subtotal} ]';
COMMENT ON COLUMN propostas.valor_ajuste IS 'Valor manual de desconto (negativo) ou acréscimo (positivo) aplicado ao subtotal';
