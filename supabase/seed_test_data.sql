-- 💾 SCRIPT DE RESET E TESTE (AMB. TESTE)
-- Este script limpa os dados antigos e reseta o sistema com 10 clientes novos.

-- 1. Remoção forçada dos dados (Hierarchy aware)
BEGIN;
TRUNCATE TABLE os_servicos_executados CASCADE;
TRUNCATE TABLE os_materiais_utilizados CASCADE;
TRUNCATE TABLE ordens_servico CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE clientes CASCADE;

-- 2. Reset de Identidade (ID sequencial volta para 1)
-- ALTER SEQUENCE clientes_id_seq RESTART WITH 1;

-- 3. Inserção de 10 Clientes Fictícios (Realistas)
INSERT INTO clientes (nome_cliente, whatsapp, endereco_completo, documento_cpf_cnpj) VALUES
('Carlos Alberto Oliveira', '11988776655', 'Av. Paulista, 1000 - SP', '123.456.789-00'),
('Mariana Silva Ferraz', '21977665544', 'Rua das Flores, 45 - RJ', '987.654.321-11'),
('Roberto Santos Mecânica', '31966554433', 'Av. Contorno, 500 - BH', '12.345.678/0001-99'),
('Clínica Sorriso VIP', '41955443322', 'Rua XV de Novembro, 200 - Curitiba', '22.333.444/0001-55'),
('Condomínio Solar das Palmeiras', '51944332211', 'Av. Beira Mar, 10 - POA', '33.444.555/0001-66'),
('Padaria Pão de Mel', '11933221100', 'Rua Augusta, 1500 - SP', '44.555.666/0001-77'),
('Juliana Mendes Arquitetura', '11922110099', 'Alameda Santos, 80 - SP', '111.222.333-44'),
('Auto Posto Ipiranga Centro', '21911009988', 'Estrada do Galeão, 300 - RJ', '55.666.777/0001-88'),
('Ricardo Eletro Service', '31900998877', 'Rua da Bahia, 120 - BH', '66.777.888/0001-99'),
('Supermercado Estrela', '41999887766', 'Av. Batel, 400 - Curitiba', '77.888.999/0001-00');

COMMIT;
