-- 🏗️ MÓDULO PMOC: INTELIGÊNCIA DE AGENDAMENTO E VENCIMENTOS
-- Este script cria views para facilitar o monitoramento de preventivas atrasadas.

-- 1. [VIEW: EQUIPAMENTOS VENCIDOS]
-- Calcula quais máquinas estão há mais de 90 dias sem preventiva
CREATE OR REPLACE VIEW public.vencimentos_preventiva AS
SELECT 
    eqp.id,
    eqp.tag_identificacao,
    eqp.localizacao_interna,
    eqp.cliente_id,
    cli.nome_cliente,
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
WHERE 
    eqp.status_equipamento = 'Operacional';

-- 2. [PERMISSÕES RLS]
ALTER VIEW public.vencimentos_preventiva OWNER TO postgres;
GRANT SELECT ON public.vencimentos_preventiva TO anon, authenticated, service_role;

COMMENT ON VIEW vencimentos_preventiva IS 'Monitor das máquinas do Ecossistema Arnaldo Trentin para conformidade ANVISA.';
