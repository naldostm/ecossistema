-- ==============================================================================
-- SCHEMA SUPABASE: FINANCEIRO, ACERVO DE CUSTOS E MARKETING (MÁRCIA RIBEIRO)
-- ==============================================================================

-- 1. COMPOSIÇÃO DE ORÇAMENTO DA ORDEM DE SERVIÇO
-- 1.A. Serviços Prestados
CREATE TABLE IF NOT EXISTS os_servicos_executados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE RESTRICT,
    quantidade NUMERIC(10,2) DEFAULT 1.00,
    desconto NUMERIC(10,2) DEFAULT 0.00,
    subtotal_cobrado NUMERIC(10,2) NOT NULL, -- qtde * valor_base_servico - desconto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.B. Materiais Utilizados (Baixa de Estoque e Custo)
CREATE TABLE IF NOT EXISTS os_materiais_utilizados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materiais(id) ON DELETE RESTRICT,
    quantidade_usada NUMERIC(10,2) NOT NULL,
    valor_unitario_cobrado NUMERIC(10,2) NOT NULL,
    subtotal_material NUMERIC(10,2) NOT NULL, -- qtde * valor_unitario
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. FATURAMENTO CONSOLIDADO
-- Espelho fiscal da Ordem de Serviço
CREATE TABLE IF NOT EXISTS faturamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE UNIQUE,
    total_servicos NUMERIC(10,2) DEFAULT 0.00,
    total_materiais NUMERIC(10,2) DEFAULT 0.00,
    impostos_taxas NUMERIC(10,2) DEFAULT 0.00,
    desconto_global NUMERIC(10,2) DEFAULT 0.00,
    total_geral NUMERIC(10,2) NOT NULL,
    status_faturamento VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Faturado, Pago, Cancelado
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. COMISSÕES DA EQUIPE
-- Destaca a parte do Vendedor/Técnico
CREATE TABLE IF NOT EXISTS comissoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    faturamento_id UUID REFERENCES public.faturamentos(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    percentual_acordado NUMERIC(5,2) DEFAULT 10.00,
    valor_comissao NUMERIC(10,2) NOT NULL,
    status_pagamento VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Repassado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. O COFRE CENTRAL: FLUXO DE CAIXA
-- A principal tabela para os Widgets do Dashboard Front-end e Fechamento Mês
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_movimento VARCHAR(20) CHECK (tipo_movimento IN ('Entrada', 'Saida')),
    categoria VARCHAR(50) NOT NULL, -- Ex: Recebimento OS, Compra Estoque, Pagamento Comissão, Fixo
    valor NUMERIC(10,2) NOT NULL,
    descricao TEXT,
    data_ocorrencia DATE NOT NULL DEFAULT CURRENT_DATE,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE SET NULL, -- Opcional, se houver vinculo
    responsavel_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL, -- Quem lançou
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CÉREBRO DE MARKETING (Márcia Ribeiro)
-- Analisada e preenchida pela IA de MKT
CREATE TABLE IF NOT EXISTS marketing_postagens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE,
    foto_url_escolhida TEXT NOT NULL,
    texto_persuasivo_gerado TEXT, -- A legenda criada pela IA
    status_postagem VARCHAR(50) DEFAULT 'Aguardando Avaliação', -- Aguardando Avaliação, Postado, Descartado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 6. SEGURANÇA BÁSICA (RLS PARA INTEGRAÇÃO COM IA EXTERNA)
-- ==============================================================================
ALTER TABLE os_servicos_executados ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_materiais_utilizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_postagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Libera Servicos_Ex" ON os_servicos_executados FOR ALL USING (true);
CREATE POLICY "Libera Materiais_Ex" ON os_materiais_utilizados FOR ALL USING (true);
CREATE POLICY "Libera Faturamentos" ON faturamentos FOR ALL USING (true);
CREATE POLICY "Libera Comissoes" ON comissoes FOR ALL USING (true);
CREATE POLICY "Libera FluxoCaixa" ON fluxo_caixa FOR ALL USING (true);
CREATE POLICY "Libera Mkt" ON marketing_postagens FOR ALL USING (true);
