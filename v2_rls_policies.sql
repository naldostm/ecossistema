-- =========================================================
-- ERP HVAC V2 - Políticas de Segurança Row Level Security (RLS)
-- =========================================================
-- Este script blinda o banco de dados contra vazamento de dados, 
-- garantindo que apenas profissionais autorizados (via token JWT)
-- acessem os dados sensíveis como Finanças e Permissões.
-- =========================================================

-- Ativar RLS nas tabelas principais (Se não estiver ativo)
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;

-- 1. TABELA COLABORADORES
-- Todos logados podem ler (para popular a lista de técnicos).
-- Apenas a própria pessoa (uid) pode dar UPDATE (ou Admins, conforme regra base).
DROP POLICY IF EXISTS "Leitura global de colaboradores" ON colaboradores;
CREATE POLICY "Leitura global de colaboradores" 
ON colaboradores FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Atualizacao de dados proprios" ON colaboradores;
CREATE POLICY "Atualizacao de dados proprios"
ON colaboradores FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- 2. TABELA ORDENS DE SERVIÇO (OS)
-- Leitura, Edição e Inserção liberadas para a operação (pois o Kanban é vivo).
-- EXCLUSÃO: APENAS ADMINS E GESTORES
DROP POLICY IF EXISTS "Leitura de OS" ON ordens_servico;
CREATE POLICY "Leitura de OS" ON ordens_servico FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Edicao de OS" ON ordens_servico;
CREATE POLICY "Edicao de OS" ON ordens_servico FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Insercao de OS" ON ordens_servico;
CREATE POLICY "Insercao de OS" ON ordens_servico FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Delecao de OS restrita" ON ordens_servico;
CREATE POLICY "Delecao de OS restrita"
ON ordens_servico FOR DELETE TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN ('admin', 'diretor', 'financeiro')
);

-- 3. TABELA FLUXO_CAIXA (O MAIS SENSÍVEL)
-- Somente Gestão e Financeiro podem Ver, Gravar, Mudar ou Apagar.
DROP POLICY IF EXISTS "Restricao absoluta do Caixa" ON fluxo_caixa;
CREATE POLICY "Restricao absoluta do Caixa"
ON fluxo_caixa FOR ALL TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN ('admin', 'diretor', 'financeiro')
);
