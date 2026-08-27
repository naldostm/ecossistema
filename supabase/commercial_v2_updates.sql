-- 💾 ATUALIZAÇÃO COMERCIAL V2
-- Adicionando colunas financeiras e prazos na tabela de propostas

-- 1. Expansão da Tabela de Propostas
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS valor_maos_obra DECIMAL(12,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS valor_estimado_materiais DECIMAL(12,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS fornecimento_materiais TEXT DEFAULT 'Cliente'; -- 'Cliente' ou 'Arnaldo Trentin'
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS prazo_inicio INTEGER DEFAULT 5; -- Dias para início

-- 2. Limpeza e Repopulação do Catálogo de Serviços
-- Categorias: Ar Condicionado, Hidráulica, Elétrica, Iluminação, Rede/Câmera

-- Primeiro, garantimos que a tabela existe (caso não esteja no script inicial)
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_servico VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    descricao TEXT,
    valor_base DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRUNCATE TABLE servicos; -- Descomentar se quiser limpar o catálogo atual

INSERT INTO servicos (nome_servico, categoria, valor_base, descricao) VALUES
-- AR CONDICIONADO
('Instalação Hiwall 7 a 12k BTUs', 'Ar Condicionado', 750.00, 'Instalação simples de ar condicionado split hiwall'),
('Instalação Hiwall 18 a 22k BTUs', 'Ar Condicionado', 850.00, 'Instalação de ar condicionado split hiwall de médio porte'),
('Instalação Hiwall 24k+ BTUs', 'Ar Condicionado', 950.00, 'Instalação de ar condicionado split hiwall de grande porte'),
('Instalação Piso Teto 7 a 12k BTUs', 'Ar Condicionado', 1150.00, 'Instalação de sistema piso teto'),
('Instalação Piso Teto 18 a 24k BTUs', 'Ar Condicionado', 1250.00, 'Instalação de sistema piso teto médio/grande'),
('Higienização/Manut. Preventiva Hiwall', 'Ar Condicionado', 300.00, 'Limpeza completa e revisão técnica hiwall'),
('Higienização/Manut. Preventiva K7', 'Ar Condicionado', 400.00, 'Limpeza completa e revisão técnica cassete'),
('Higienização/Manut. Preventiva Piso Teto', 'Ar Condicionado', 400.00, 'Limpeza completa e revisão técnica piso teto'),

-- HIDRÁULICA
('Instalação de Monocomando', 'Hidráulica', 450.00, 'Instalação de torneira ou misturador monocomando'),
('Deslocamento Simples de Ponto', 'Hidráulica', 200.00, 'Mudança de posição de ponto de água ou esgoto'),
('Criação de Dreno', 'Hidráulica', 300.00, 'Infraestrutura para escoamento de condensado ou águas pluviais'),

-- ELÉTRICA / ILUMINAÇÃO (Exemplos para completar o catálogo conforme solicitado)
('Instalação de Pendente/Lustre', 'Iluminação', 150.00, 'Montagem e fixação de luminária decorativa'),
('Revisão Elétrica Preventiva (Quadro/Tomadas)', 'Elétrica', 500.00, 'Verificação de aperto de bornes, balanceamento de fases e testes de continuidade'),
('Instalação de Câmera IP/HDCVI', 'Rede/Câmera', 250.00, 'Configuração e fixação de câmera de segurança'),
('Ponto de Rede Estruturada', 'Rede/Câmera', 180.00, 'Passagem de cabo CAT6 e crimpagem de keystones')
ON CONFLICT DO NOTHING;

-- Garantir acesso anônimo para MVP
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso anônimo total aos serviços" 
ON servicos FOR ALL USING (true);
