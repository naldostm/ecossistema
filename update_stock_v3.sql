-- ==============================================================================
-- UPDATE STOCK V3.2 - CONSOLIDATED STOCK (FIXED FK)
-- OBRAMAX PRICING + 50% PROFIT
-- ==============================================================================

-- 1. Remover tabela de biblioteca de sugestões (obsoleto)
DROP TABLE IF EXISTS materiais_biblioteva;

-- 2. LIMPEZA DE SEGURANÇA (Evita erro de Chave Estrangeira)
-- Remove referências em ordens de serviço antes de apagar o material
DELETE FROM os_materiais_utilizados 
WHERE material_id IN (SELECT id FROM materiais WHERE campo_uso IN ('Hidráulica', 'Elétrica'));

-- 3. Limpar materiais antigos de Hidráulica e Elétrica para evitar duplicidade
DELETE FROM materiais WHERE campo_uso IN ('Hidráulica', 'Elétrica');

-- 4. Inserir Itens Consolidados no Estoque Local
INSERT INTO materiais (nome_material, quantidade, unidade_medida, preco_compra, valor_unitario, campo_uso) VALUES

-- 💧 HIDRÁULICA - TUBOS (ObraMax + 50% Lucro)
('Tubo CPVC Água Quente 22mm (3m) Amanco', 10, 'un', 45.00, 67.50, 'Hidráulica'),
('Tubo PEX Monocamada Gás/Água 16mm', 50, 'm', 12.00, 18.00, 'Hidráulica'),
('Tubo PEX Multicamada Gás/Água 16mm', 50, 'm', 16.50, 24.75, 'Hidráulica'),
('Tubo PPR Água Quente 20mm (3m) Tigre', 15, 'un', 28.00, 42.00, 'Hidráulica'),
('Tubo PVC Marrom Soldável 25mm (6m)', 20, 'un', 32.00, 48.00, 'Hidráulica'),

-- 🛠️ HIDRÁULICA - CONEXÕES (ObraMax + 50% Lucro)
('Joelho 90 CPVC 22mm Amanco', 40, 'un', 4.80, 7.20, 'Hidráulica'),
('Tê CPVC 22mm Amanco', 20, 'un', 8.50, 12.75, 'Hidráulica'),
('Luva CPVC 22mm Amanco', 30, 'un', 3.90, 5.85, 'Hidráulica'),
('Adaptador CPVC Misto 22mm x 1/2', 20, 'un', 7.20, 10.80, 'Hidráulica'),
('Joelho 90 PPR 20mm Amanco', 50, 'un', 3.20, 4.80, 'Hidráulica'),
('Tê PPR 20mm Amanco', 25, 'un', 5.50, 8.25, 'Hidráulica'),
('Luva PPR 20mm Amanco', 40, 'un', 2.80, 4.20, 'Hidráulica'),
('Adaptador PPR Macho 20mm x 1/2', 15, 'un', 14.50, 21.75, 'Hidráulica'),
('Joelho PEX Crimp 16mm x 16mm', 20, 'un', 22.00, 33.00, 'Hidráulica'),
('Tê PEX Crimp 16mm x 16mm x 16mm', 15, 'un', 35.00, 52.50, 'Hidráulica'),
('Conector PEX Multicamada 16mm x 1/2 (Fêmea)', 30, 'un', 18.00, 27.00, 'Hidráulica'),
('Anel de Crimpagem PEX 16mm', 100, 'un', 2.50, 3.75, 'Hidráulica'),
('Joelho 90 PVC Marrom 25mm Tigre', 60, 'un', 1.50, 2.25, 'Hidráulica'),
('Tê PVC Marrom 25mm Tigre', 30, 'un', 2.80, 4.20, 'Hidráulica'),
('Luva PVC Marrom 25mm Tigre', 50, 'un', 1.20, 1.80, 'Hidráulica'),
('Adaptador PVC Soldável com Flange 25mm x 3/4', 10, 'un', 18.50, 27.75, 'Hidráulica'),

-- ⚡ ELÉTRICA - CABOS (ObraMax + 50% Lucro)
('Cabo Flexível 1.5mm² (Preto/Azul/Verde)', 200, 'm', 2.20, 3.30, 'Elétrica'),
('Cabo Flexível 2.5mm² (Preto/Azul/Verde)', 300, 'm', 3.80, 5.70, 'Elétrica'),
('Cabo Flexível 4.0mm² (Preto/Azul)', 150, 'm', 6.20, 9.30, 'Elétrica'),
('Cabo Flexível 6.0mm² (Preto/Azul)', 100, 'm', 9.80, 14.70, 'Elétrica'),
('Cabo Flexível 10.0mm² (Preto)', 50, 'm', 16.50, 24.75, 'Elétrica'),
('Cabo PP 3 x 2.5mm²', 100, 'm', 11.50, 17.25, 'Elétrica'),
('Cabo PP 4 x 1.5mm²', 100, 'm', 9.50, 14.25, 'Elétrica');
