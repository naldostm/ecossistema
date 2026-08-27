-- 🏗️ MÓDULO PMOC: UNIFICAÇÃO DE TIPAGEM E REPARAÇÃO (V11 - FINAL - UUID)
-- Corrige a tipagem para UUID (conforme banco original) e garante colunas técnicas.

BEGIN;

-- A. [DEPENDÊNCIAS] - Remover temporariamente a view que bloqueia alterações
DROP VIEW IF EXISTS public.vencimentos_preventiva;

-- B. [REPARAÇÃO DE COLUNAS] - Garantir que todos os campos existam na parque_equipamentos
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS tipo_equipamento VARCHAR(100) DEFAULT 'Ar Condicionado Split';
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS capacidade_btu INTEGER;
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS fotos_url JSONB DEFAULT '[]';
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS data_instalacao DATE;
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS data_ultima_preventiva DATE;
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS qr_code_id UUID DEFAULT gen_random_uuid();

-- C. [SINCRO DE TIPAGEM] - Garantir UUID para Clientes e Contratos
-- Remove as FKs atuais para permitir a alteração
ALTER TABLE public.parque_equipamentos DROP CONSTRAINT IF EXISTS parque_equipamentos_cliente_id_fkey;
ALTER TABLE public.parque_equipamentos DROP CONSTRAINT IF EXISTS parque_equipamentos_contrato_id_fkey;

-- Força a conversão para UUID (Limpando dados inválidos se necessário)
ALTER TABLE public.parque_equipamentos 
    ALTER COLUMN cliente_id TYPE UUID USING (cliente_id::text::uuid),
    ALTER COLUMN contrato_id TYPE UUID USING (contrato_id::text::uuid);

-- Recria as FKs apontando para os IDs UUID corretos
ALTER TABLE public.parque_equipamentos 
    ADD CONSTRAINT parque_equipamentos_cliente_id_fkey 
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.parque_equipamentos 
    ADD CONSTRAINT parque_equipamentos_contrato_id_fkey 
    FOREIGN KEY (contrato_id) REFERENCES public.contratos_pmoc(id) ON DELETE SET NULL;

-- D. [PMOC CONFIG] - Ajustar Chave de Cliente no Config
ALTER TABLE public.pmoc_config DROP CONSTRAINT IF EXISTS pmoc_config_cliente_id_fkey;
ALTER TABLE public.pmoc_config 
    ALTER COLUMN cliente_id TYPE UUID USING (cliente_id::text::uuid);

ALTER TABLE public.pmoc_config 
    ADD CONSTRAINT pmoc_config_cliente_id_fkey 
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

-- E. [RECRIAR VIEW] - Restaurar a lógica de vencimentos
CREATE OR REPLACE VIEW public.vencimentos_preventiva AS
SELECT 
    eqp.id,
    eqp.tag_identificacao,
    eqp.localizacao_interna,
    eqp.cliente_id,
    cli.nome_cliente,
    ct.identificacao AS nome_contrato,
    eqp.data_ultima_preventiva,
    CURRENT_DATE - COALESCE(eqp.data_ultima_preventiva, eqp.data_instalacao, '2000-01-01'::DATE) AS dias_desde_ultima,
    CASE 
        WHEN (CURRENT_DATE - COALESCE(eqp.data_ultima_preventiva, eqp.data_instalacao, '2000-01-01'::DATE)) > 90 THEN 'Atrasado'
        WHEN (CURRENT_DATE - COALESCE(eqp.data_ultima_preventiva, eqp.data_instalacao, '2000-01-01'::DATE)) > 75 THEN 'Próximo'
        ELSE 'Em Dia'
    END AS status_pmoc
FROM 
    public.parque_equipamentos eqp
JOIN 
    public.clientes cli ON eqp.cliente_id = cli.id
LEFT JOIN 
    public.contratos_pmoc ct ON eqp.contrato_id = ct.id
WHERE 
    eqp.status_equipamento = 'Operacional';

-- F. [PERMISSÕES E CACHE]
GRANT SELECT ON public.vencimentos_preventiva TO anon, authenticated, service_role;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
