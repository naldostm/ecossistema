-- ==============================================================================
-- UPDATE SCHEMA V2 (FASE 5 EXTENDED) - ECOSSISTEMA ARNALDO TRENTIN
-- ==============================================================================

-- 1. Atualização do Check Constraint de tipos de contrato
-- Removemos a anterior (se possível, ou simplesmente ignoramos e criamos uma nova)
-- Nota: No Supabase/Postgres, é melhor DROPPAR a constraint e ADICIONAR a nova.

ALTER TABLE contratos_pmoc DROP CONSTRAINT IF EXISTS contratos_pmoc_tipo_contrato_check;

ALTER TABLE contratos_pmoc ADD CONSTRAINT contratos_pmoc_tipo_contrato_check 
CHECK (tipo_contrato IN (
    'PMOC_Mensal', 
    'PMOC_Trimestral', 
    'Avulso', 
    'Obra_Completa', 
    'Instalacao_Eletrica', 
    'Manutencao_Eletrica', 
    'Hidraulica_PEX',
    'Preventiva_Geral'
));

-- 2. Criação da Tabela de Biblioteca de Materiais (Se não existir)
CREATE TABLE IF NOT EXISTS materiais_biblioteva (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_item VARCHAR(255) NOT NULL,
    categoria VARCHAR(100), -- Electric, Hidráulica, Ar Condicionado
    unidade_medida VARCHAR(20) DEFAULT 'un', -- m, un, kg, par
    valor_referencia NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Seed de Materiais Sugeridos
INSERT INTO materiais_biblioteva (nome_item, categoria, unidade_medida, valor_referencia) VALUES
-- ELÉTRICA
('Cabo Flexível 2.5mm² (Preto)', 'Elétrica', 'm', 3.50),
('Cabo Flexível 4.0mm² (Azul)', 'Elétrica', 'm', 5.80),
('Disjuntor DIN Monopolar 20A', 'Elétrica', 'un', 18.00),
('Canaleta Sistema X 20x20mm', 'Elétrica', 'm', 12.00),
('Fita Isolante 20m Premium', 'Elétrica', 'un', 9.50),
('Quadro de Distribuição 12/16 Disjuntores', 'Elétrica', 'un', 85.00),

-- HIDRÁULICA / PEX
('Tubo PEX Multicamada 16mm (Gás/Água)', 'Hidráulica', 'm', 14.00),
('Conector Fêmea PEX 16mm x 1/2', 'Hidráulica', 'un', 22.00),
('Joelho PEX 16mm x 16mm', 'Hidráulica', 'un', 19.50),
('Válvula de Esfera p/ Gás 1/2', 'Hidráulica', 'un', 45.00),
('Tesoura corta-tubo PEX', 'Hidráulica', 'un', 65.00),

-- AR CONDICIONADO / HVAC
('Tubo Cobre Flexível 1/4 (Parede 0.79)', 'Ar Condicionado', 'm', 28.00),
('Tubo Cobre Flexível 3/8 (Parede 0.79)', 'Ar Condicionado', 'm', 42.00),
('Fluido Refrigerante R410A (Botija 11.3kg)', 'Ar Condicionado', 'kg', 95.00),
('Suporte Condensadora 400mm (Par)', 'Ar Condicionado', 'par', 55.00),
('Cabo PP 4x1.5mm / 4x2.5mm', 'Ar Condicionado', 'm', 7.50),
('Bomba de Dreno 10L/h Slim', 'Ar Condicionado', 'un', 280.00);

-- Habilitar RLS
ALTER TABLE materiais_biblioteva ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura Pública Materiais" ON materiais_biblioteva;
CREATE POLICY "Leitura Pública Materiais" ON materiais_biblioteva FOR SELECT USING (true);

-- ==============================================================================
-- 4. ALINHAMENTO DE SCHEMA (ERROS DE PERSISTÊNCIA REPORTADOS)
-- ==============================================================================

-- Adiciona colunas extras no Estoque para bater com o Dashboard v5
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS preco_compra NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS campo_uso VARCHAR(100) DEFAULT 'Geral';

-- Adiciona colunas extras no Catálogo de Serviços
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100) DEFAULT 'Geral';
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS descritivo_json JSONB DEFAULT '{}';

-- Adiciona campo de fotos no Parque de Máquinas (PMOC)
ALTER TABLE public.pmoc_equipamentos ADD COLUMN IF NOT EXISTS fotos_json JSONB DEFAULT '[]';
