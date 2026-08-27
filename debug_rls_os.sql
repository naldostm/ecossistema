-- ==============================================================================
-- 🚨 DEBUG: LIBERAÇÃO TOTAL DE RLS PARA ORDENS DE SERVIÇO
-- Execute este script caso o salvamento de OS esteja retornando erro de "Permission Denied".
-- ==============================================================================

-- 1. GARANTE QUE AS TABELAS TÊM RLS ATIVADO MAS COM ACESSO TOTAL (MODO DEBUG)
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_servicos_executados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_materiais_utilizados ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICA PARA ORDENS_SERVICO
DROP POLICY IF EXISTS "Acesso total as OS" ON public.ordens_servico;
CREATE POLICY "Acesso total as OS" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);

-- 3. POLÍTICA PARA SERVIÇOS EXECUTADOS
DROP POLICY IF EXISTS "Acesso total as tarefas OS" ON public.os_servicos_executados;
CREATE POLICY "Acesso total as tarefas OS" ON public.os_servicos_executados FOR ALL USING (true) WITH CHECK (true);

-- 4. POLÍTICA PARA MATERIAIS UTILIZADOS
DROP POLICY IF EXISTS "Acesso total aos materiais OS" ON public.os_materiais_utilizados;
CREATE POLICY "Acesso total aos materiais OS" ON public.os_materiais_utilizados FOR ALL USING (true) WITH CHECK (true);

-- 5. NOTA TÉCNICA
COMMENT ON TABLE public.ordens_servico IS 'Mesa de controle de OS - Políticas liberadas para debug em 28/03/2026';
