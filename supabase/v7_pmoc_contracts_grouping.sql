-- 🏗️ MÓDULO PMOC: REORGANIZAÇÃO POR CONTRATO (V7)
-- Adiciona suporte para identificar contratos e vincular equipamentos a eles.

-- 1. [CONTRATOS] - Adicionar campo de identificação/apelido
ALTER TABLE public.contratos_pmoc ADD COLUMN IF NOT EXISTS identificacao TEXT;
COMMENT ON COLUMN public.contratos_pmoc.identificacao IS 'Apelido do contrato (Ex: Contrato Alameda 2205)';

-- 2. [PARQUE DE EQUIPAMENTOS] - Vincular ao Contrato
ALTER TABLE public.parque_equipamentos ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES public.contratos_pmoc(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.parque_equipamentos.contrato_id IS 'Vínculo do equipamento com um contrato PMOC específico.';

-- 3. [AJUSTE NA VIEW DE VENCIMENTOS]
-- Atualizar a view para incluir o nome do contrato se disponível
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

-- 4. [PERMISSÕES]
GRANT SELECT ON public.vencimentos_preventiva TO anon, authenticated, service_role;
