-- ==============================================================================
-- SCHEMA SUPABASE: NOVAS TABELAS (ESTOQUE E GESTÃO)
-- Execute este script no "SQL Editor" do seu Supabase para expandir o ecossistema.
-- ==============================================================================

-- 1. Construção da Tabela de MATERIAIS (Estoque)
CREATE TABLE IF NOT EXISTS materiais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_material VARCHAR(255) NOT NULL,
    quantidade DECIMAL DEFAULT 0,
    unidade_medida VARCHAR(50) DEFAULT 'un', -- ex: un, metro, rolo, caixa
    valor_unitario DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Construção da Tabela de FERRAMENTAS
CREATE TABLE IF NOT EXISTS ferramentas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_ferramenta VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Disponível', -- Disponível, Em Uso, Manutenção
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Construção da Tabela de SERVIÇOS (Tabela de Preços e Catálogo)
CREATE TABLE IF NOT EXISTS servicos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_servico VARCHAR(255) NOT NULL,
    descricao TEXT,
    valor_base DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 4. POLÍTICAS DE SEGURANÇA GLOBAIS
-- ==============================================================================
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso anônimo total a materiais" ON materiais FOR ALL USING (true);
CREATE POLICY "Permitir acesso anônimo total a ferramentas" ON ferramentas FOR ALL USING (true);
CREATE POLICY "Permitir acesso anônimo total a servicos" ON servicos FOR ALL USING (true);
