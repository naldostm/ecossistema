--- 💰 MÓDULO FINANCEIRO: FATURAMENTO E COMISSÕES
--- Adicionamos tabelas específicas para a "Governança" do fluxo monetário

--- 1. Tabela de Faturamentos B2B
CREATE TABLE IF NOT EXISTS public.faturamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    os_id UUID REFERENCES public.ordens_servico(id_os) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_servicos DECIMAL(10, 2) DEFAULT 0,
    total_materiais DECIMAL(10, 2) DEFAULT 0,
    impostos DECIMAL(10, 2) DEFAULT 0,
    valor_geral DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Faturado, Pago, Cancelado
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--- 2. Tabela de Comissões e Pagamentos da Equipe
CREATE TABLE IF NOT EXISTS public.comissoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    faturamento_id UUID REFERENCES public.faturamentos(id) ON DELETE SET NULL,
    os_id UUID REFERENCES public.ordens_servico(id_os) ON DELETE SET NULL,
    percentual_acordado DECIMAL(5, 2) DEFAULT 0.00,
    valor_faturamento_ref DECIMAL(10, 2) DEFAULT 0.00,
    valor_pagar DECIMAL(10, 2) NOT NULL,
    status_pagamento VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Aprovado, Pago
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_pagamento TIMESTAMP WITH TIME ZONE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

--- Políticas de Segurança (RLS Básicas)
ALTER TABLE public.faturamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users (faturamentos)" ON public.faturamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon (faturamentos)" ON public.faturamentos FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users (comissoes)" ON public.comissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon (comissoes)" ON public.comissoes FOR ALL TO anon USING (true) WITH CHECK (true);
