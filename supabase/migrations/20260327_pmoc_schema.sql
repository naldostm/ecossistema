-- ============================================
-- SQL: PMOC & PARQUE DE EQUIPAMENTOS
-- Arnaldo Trentin Serviços v9.5
-- ============================================

-- 1. Tabela de Equipamentos (Parque de Máquinas)
CREATE TABLE IF NOT EXISTS public.equipamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
    ambiente TEXT NOT NULL,          -- Ex: Sala 102, Diretoria
    tipo TEXT NOT NULL,              -- Split, Cassete, VRF, Chiller
    marca_modelo TEXT,               -- Ex: LG Dual Inverter S4-Q12
    capacidade_btus INTEGER,         -- Ex: 12000, 60000
    numero_serie TEXT,               -- SN-XXXXX
    tag_id TEXT UNIQUE,              -- QR Code / Tag Control
    data_instalacao DATE,
    status TEXT DEFAULT 'Em Operação', -- Em Operação, Em Manutenção, Condenado
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Leituras e Manutenções (Logs do PMOC)
CREATE TABLE IF NOT EXISTS public.pmoc_leituras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    tecnico_id UUID REFERENCES public.perfil_usuarios(id),
    data_leitura TIMESTAMPTZ DEFAULT now(),
    limpeza_filtros BOOLEAN DEFAULT FALSE,
    limpeza_serpentina BOOLEAN DEFAULT FALSE,
    verificacao_dreno BOOLEAN DEFAULT FALSE,
    carga_termica_ok BOOLEAN DEFAULT FALSE,
    ruido_vibracao_ok BOOLEAN DEFAULT FALSE,
    pressao_gas_psi DECIMAL(10,2),
    tensao_eletrica_v DECIMAL(10,2),
    observacoes TEXT,
    fotos_brutas TEXT[],             -- Array de URLs do Storage
    assinatura_digital TEXT          -- Hash ou URL da imagem
);

-- Enable RLS
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmoc_leituras ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Admin/Finance access)
CREATE POLICY "Full access to authenticated users" ON public.equipamentos FOR ALL TO authenticated USING (true);
CREATE POLICY "Full access to authenticated users" ON public.pmoc_leituras FOR ALL TO authenticated USING (true);
