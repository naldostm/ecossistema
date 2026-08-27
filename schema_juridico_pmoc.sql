-- ==============================================================================
-- SCHEMA PMOC E JURÍDICO (FASE 5) - ECOSSISTEMA ARNALDO TRENTIN
-- Execute este script no "SQL Editor" do seu Supabase.
-- ==============================================================================

-- 1. Criação da Tabela Mestra de Contratos e PMOC
CREATE TABLE IF NOT EXISTS contratos_pmoc (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL, -- Caso o PMOC pertença direto a um prédio inteiro em construção
    tipo_contrato VARCHAR(50) CHECK (tipo_contrato IN ('PMOC_Mensal', 'PMOC_Trimestral', 'Avulso', 'Obra_Completa')),
    status_contrato VARCHAR(50) DEFAULT 'Ativo', -- Ativo, Suspenso, Finalizado
    valor_contrato NUMERIC(10,2) DEFAULT 0.00,
    data_assinatura DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_meses INTEGER DEFAULT 12,
    clausulas_especiais TEXT,
    anexo_contrato_pdf TEXT, -- URL pro Bucket de Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Inventário de Máquinas (Parque de Equipamentos do Cliente)
-- Imprescindível para o Laudo Anvisa/PMOC. A Júlia vai precisar ler isso aqui.
CREATE TABLE IF NOT EXISTS pmoc_equipamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    contrato_id UUID REFERENCES public.contratos_pmoc(id) ON DELETE SET NULL,
    ambiente_instalado VARCHAR(100), -- Ex: Sala de Reunião 1, Quarto Casal, Galpão
    tipo_equipamento VARCHAR(100), -- Ex: Ar Split High Wall, Cassete, VRF, Chiller
    marca_modelo VARCHAR(150),
    capacidade_btus INTEGER,
    numero_serie VARCHAR(100),
    data_instalacao DATE,
    tecnico_responsavel UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    status_maquina VARCHAR(50) DEFAULT 'Em Operação', -- Em Operação, Em Manutenção, Condenado
    qr_code_tag VARCHAR(100), -- ID único de etiqueta física colada na máquina
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Laudos Oficiais e Auditorias
-- Histórico eterno das aprovações da Júlia Sakamoto validando as limpezas no PMOC
CREATE TABLE IF NOT EXISTS pmoc_laudos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipamento_id UUID REFERENCES public.pmoc_equipamentos(id) ON DELETE CASCADE,
    os_referencia_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE SET NULL,
    data_auditoria DATE NOT NULL DEFAULT CURRENT_DATE,
    analista_ia VARCHAR(100) DEFAULT 'Júlia Sakamoto',
    status_laudo VARCHAR(50) DEFAULT 'Aprovado (Conforme Anvisa)', -- Aprovado, Reprovado Com Ressalvas
    anotacoes_juridicas TEXT,
    pdf_laudo_oficial TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 4. POLÍTICAS DE SEGURANÇA (Row Level Security)
-- ==============================================================================

ALTER TABLE contratos_pmoc ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmoc_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmoc_laudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Libera Contratos" ON contratos_pmoc FOR ALL USING (true);
CREATE POLICY "Libera Equipamentos" ON pmoc_equipamentos FOR ALL USING (true);
CREATE POLICY "Libera Laudos" ON pmoc_laudos FOR ALL USING (true);

-- *DICA DE ENGENHARIA FUTURA:* 
-- Para a geração automática de OS, criaremos uma [Edge Function no Supabase] que todo dia 1° bate na tabela "contratos_pmoc", olha a vigência, e insere uma OS gigante no Kanban para a equipe já saber quais PMOCs limpar naquele mês.
