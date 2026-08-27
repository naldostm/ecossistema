-- ❄️ MÓDULO PMOC: INVENTÁRIO TÉCNICO E CRONOGRAMA DE MANUTENÇÃO
-- Este script cria as tabelas necessárias para o Parque de Equipamentos e o controle do PMOC.

-- 1. [PARQUE DE EQUIPAMENTOS] - Cadastro detalhado de máquinas
CREATE TABLE IF NOT EXISTS public.parque_equipamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    tag_identificacao VARCHAR(50) UNIQUE, -- Ex: AC-01, FAN-02
    localizacao_interna TEXT, -- Ex: Sala de Reunião, CPD, Recepção
    tipo_equipamento VARCHAR(100) DEFAULT 'Ar Condicionado Split',
    marca VARCHAR(100),
    modelo VARCHAR(100),
    capacidade_btu INTEGER,
    fluido_refrigerante VARCHAR(50) DEFAULT 'R-410A',
    tensao_eletrica VARCHAR(20) DEFAULT '220V',
    serial_condensadora VARCHAR(100),
    serial_evaporadora VARCHAR(100),
    data_instalacao DATE,
    data_ultima_preventiva DATE,
    status_equipamento VARCHAR(50) DEFAULT 'Operacional', -- Operacional, Manutenção, Inativo
    qr_code_id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas existam caso a tabela já tenha sido criada antes (Fase 2 -> Fase 3)
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS data_instalacao DATE;
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS data_ultima_preventiva DATE;

-- 2. [CONTROLE DE PREVENTIVAS] - Histórico e Planejamento
-- Relaciona uma OS específica a um equipamento do parque
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES public.parque_equipamentos(id) ON DELETE SET NULL;

-- 3. [CONFIGURAÇÃO GLOBAL PMOC] - Metas e Alertas
CREATE TABLE IF NOT EXISTS public.pmoc_config (
    id SERIAL PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    intervalo_dias INTEGER DEFAULT 90, -- Padrão 90 dias (Trimestral)
    proxima_visita_geral DATE,
    responsavel_tecnico TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. [POLÍTICAS DE SEGURANÇA (RLS)]
ALTER TABLE public.parque_equipamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Parque" ON public.parque_equipamentos;
CREATE POLICY "Acesso Total Parque" ON public.parque_equipamentos FOR ALL USING (true);

ALTER TABLE public.pmoc_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total PMOC Config" ON public.pmoc_config;
CREATE POLICY "Acesso Total PMOC Config" ON public.pmoc_config FOR ALL USING (true);

-- 5. [TRIGGERS] - Atualizar data da última preventiva automaticamente ao finalizar OS
CREATE OR REPLACE FUNCTION update_last_preventive_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_ia = 'Finalizado' AND NEW.servico_tipo ILIKE '%Preventiva%' AND NEW.equipamento_id IS NOT NULL THEN
        UPDATE public.parque_equipamentos
        SET data_ultima_preventiva = CURRENT_DATE,
            status_equipamento = 'Operacional'
        WHERE id = NEW.equipamento_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ultima_preventiva ON public.ordens_servico;
CREATE TRIGGER tr_ultima_preventiva
AFTER UPDATE ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION update_last_preventive_date();

COMMENT ON TABLE parque_equipamentos IS 'Inventário de máquinas para PMOC e Rastreabilidade';
