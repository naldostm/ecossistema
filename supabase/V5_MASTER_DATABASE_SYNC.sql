-- 🛠️ ECOSSISTEMA ARNALDO TRENTIN: MASTER SYNCHRONIZATION V5.1 (REVISÃO TOTAL)
-- Execute este script no SQL Editor do Supabase para garantir que TODAS as tabelas batam com o app.js.

-- 1. [AUDITORIA] - Padronização V5
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Total Auditoria" ON audit_logs FOR ALL USING (true);

-- 2. [PROPOSTAS] - Acréscimo de Campos de Orçamento Industrial
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS itens_json JSONB DEFAULT '[]';
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS valor_ajuste DECIMAL(15,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS servico_tipo TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS prazo_estimado TEXT;

-- 3. [CATÁLOGO] - Categorização para UX (OptGroups)
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100) DEFAULT 'Geral';
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS campo_uso VARCHAR(100) DEFAULT 'Estoque Geral';

-- 4. [JURÍDICO] - Ajuste Contratos PMOC
ALTER TABLE contratos_pmoc ADD COLUMN IF NOT EXISTS data_inicio DATE DEFAULT CURRENT_DATE;

-- 5. [FINANCEIRO] - Garantia de Tabela Fluxo de Caixa (Caso falte)
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_movimento VARCHAR(20) CHECK (tipo_movimento IN ('Entrada', 'Saida')),
    categoria VARCHAR(50) NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    descricao TEXT,
    data_ocorrencia DATE NOT NULL DEFAULT CURRENT_DATE,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE SET NULL,
    responsavel_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Libera FluxoCaixa" ON fluxo_caixa;
CREATE POLICY "Libera FluxoCaixa" ON fluxo_caixa FOR ALL USING (true);

-- 6. [SEGURANÇA] - Cascata de Deleção (Evita erro de foreign key)
DO $$
BEGIN
    BEGIN
        ALTER TABLE os_servicos_executados DROP CONSTRAINT IF EXISTS os_servicos_executados_os_id_fkey;
        ALTER TABLE os_servicos_executados ADD CONSTRAINT os_servicos_executados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Cascade servicos skip'; END;

    BEGIN
        ALTER TABLE os_materiais_utilizados DROP CONSTRAINT IF EXISTS os_materiais_utilizados_os_id_fkey;
        ALTER TABLE os_materiais_utilizados ADD CONSTRAINT os_materiais_utilizados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Cascade materiais skip'; END;
END $$;

COMMENT ON TABLE audit_logs IS 'Sincronizado com V5 do app.js';
