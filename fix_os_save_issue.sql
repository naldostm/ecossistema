-- ==============================================================================
-- FIX: ALINHAMENTO DE SCHEMA ORDENS_SERVICO (ECOSSISTEMA ARNALDO TRENTIN)
-- Caso o salvamento de OS esteja falhando, execute este script no SQL Editor.
-- ==============================================================================

-- 1. ADICIONA COLUNAS FALTANTES
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tecnico_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS periodo_execucao VARCHAR(100); -- Manhã, Tarde, Noite

-- 2. GARANTE QUE OBRA_ID EXISTE (CASO O SCRIPT DE LOGÍSTICA NÃO TENHA RODADO)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;

-- 3. GARANTE QUE AS TABELAS ACESSÓRIAS TÊM RLS PERMISSIVO (INTEGRAÇÃO DASHBOARD)
ALTER TABLE public.os_servicos_executados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_materiais_utilizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total as tarefas OS" ON public.os_servicos_executados;
CREATE POLICY "Acesso total as tarefas OS" ON public.os_servicos_executados FOR ALL USING (true);

DROP POLICY IF EXISTS "Acesso total aos materiais OS" ON public.os_materiais_utilizados;
CREATE POLICY "Acesso total aos materiais OS" ON public.os_materiais_utilizados FOR ALL USING (true);

COMMENT ON COLUMN public.ordens_servico.periodo_execucao IS 'Armazena períodos de execução (Ex: Manhã, Tarde) separados por vírgula.';
COMMENT ON COLUMN public.ordens_servico.tecnico_id IS 'UUID do colaborador responsável técnico pela OS (Relacional).';
