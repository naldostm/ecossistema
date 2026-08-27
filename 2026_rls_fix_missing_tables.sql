-- ==============================================================================
-- PATCH COMPLEMENTAR: TABELAS QUE FALTARAM NO PATCH DE RLS ORIGINAL
-- Data: 13 de Abril de 2026
-- Problema: Os dropdowns de Propostas ficam vazios no Vercel porque
--           tabelas auxiliares (propostas, os_datas, os_servicos_executados, 
--           os_materiais_utilizados, parque_equipamentos, agent_memory) 
--           têm RLS ativado mas sem política para 'authenticated'.
--           A query de ordens_servico faz JOINs nessas tabelas auxiliares 
--           e falha silenciosamente, impedindo o carregamento dos caches.
-- ==============================================================================

-- 1. PROPOSTAS (A TABELA QUE NÃO EXISTE EM NENHUM PATCH RLS)
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura de propostas logados" ON propostas;
DROP POLICY IF EXISTS "Escrita de propostas logados" ON propostas;
DROP POLICY IF EXISTS "Edicao de propostas logados" ON propostas;
DROP POLICY IF EXISTS "Exclusao de propostas logados" ON propostas;

CREATE POLICY "Leitura de propostas logados" ON propostas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita de propostas logados" ON propostas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Edicao de propostas logados" ON propostas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exclusao de propostas logados" ON propostas FOR DELETE TO authenticated USING (true);

-- 2. OS_SERVICOS_EXECUTADOS (Tinha política FOR ALL, converter para authenticated)
ALTER TABLE os_servicos_executados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total as tarefas OS" ON os_servicos_executados;
DROP POLICY IF EXISTS "Leitura os_servicos logados" ON os_servicos_executados;
DROP POLICY IF EXISTS "Escrita os_servicos logados" ON os_servicos_executados;
DROP POLICY IF EXISTS "Edicao os_servicos logados" ON os_servicos_executados;
DROP POLICY IF EXISTS "Exclusao os_servicos logados" ON os_servicos_executados;

CREATE POLICY "Leitura os_servicos logados" ON os_servicos_executados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita os_servicos logados" ON os_servicos_executados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Edicao os_servicos logados" ON os_servicos_executados FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exclusao os_servicos logados" ON os_servicos_executados FOR DELETE TO authenticated USING (true);

-- 3. OS_MATERIAIS_UTILIZADOS (Tinha política FOR ALL, converter para authenticated)
ALTER TABLE os_materiais_utilizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total aos materiais OS" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Leitura os_materiais logados" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Escrita os_materiais logados" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Edicao os_materiais logados" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Exclusao os_materiais logados" ON os_materiais_utilizados;

CREATE POLICY "Leitura os_materiais logados" ON os_materiais_utilizados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita os_materiais logados" ON os_materiais_utilizados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Edicao os_materiais logados" ON os_materiais_utilizados FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exclusao os_materiais logados" ON os_materiais_utilizados FOR DELETE TO authenticated USING (true);

-- 4. OS_DATAS (Tinha política FOR ALL, converter para authenticated)
ALTER TABLE os_datas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total OS Datas" ON os_datas;
DROP POLICY IF EXISTS "Leitura os_datas logados" ON os_datas;
DROP POLICY IF EXISTS "Escrita os_datas logados" ON os_datas;
DROP POLICY IF EXISTS "Edicao os_datas logados" ON os_datas;
DROP POLICY IF EXISTS "Exclusao os_datas logados" ON os_datas;

CREATE POLICY "Leitura os_datas logados" ON os_datas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita os_datas logados" ON os_datas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Edicao os_datas logados" ON os_datas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exclusao os_datas logados" ON os_datas FOR DELETE TO authenticated USING (true);

-- 5. PARQUE_EQUIPAMENTOS (Tinha política FOR ALL, converter para authenticated)
ALTER TABLE parque_equipamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Parque" ON parque_equipamentos;
DROP POLICY IF EXISTS "Leitura parque logados" ON parque_equipamentos;
DROP POLICY IF EXISTS "Escrita parque logados" ON parque_equipamentos;
DROP POLICY IF EXISTS "Edicao parque logados" ON parque_equipamentos;
DROP POLICY IF EXISTS "Exclusao parque logados" ON parque_equipamentos;

CREATE POLICY "Leitura parque logados" ON parque_equipamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Escrita parque logados" ON parque_equipamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Edicao parque logados" ON parque_equipamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Exclusao parque logados" ON parque_equipamentos FOR DELETE TO authenticated USING (true);

-- 6. AGENT_MEMORY (Usada pelo bot de WhatsApp - precisa de acesso anon também)
-- NOTA: O agent_memory pode precisar de acesso anon se o n8n usa service_role.
-- Se não existir a tabela, ignorar.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_memory') THEN
        EXECUTE 'ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Leitura agent_memory logados" ON agent_memory';
        EXECUTE 'DROP POLICY IF EXISTS "Escrita agent_memory logados" ON agent_memory';
        EXECUTE 'CREATE POLICY "Leitura agent_memory logados" ON agent_memory FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "Escrita agent_memory logados" ON agent_memory FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
END $$;

-- 7. LIMPEZA: Remover políticas "FOR ALL USING (true)" de tabelas do patch anterior
-- Estas políticas do debug_rls_os.sql permitem acesso anon (público), contradizendo o hardening
DROP POLICY IF EXISTS "Acesso total as OS" ON ordens_servico;

-- ==============================================================================
-- VERIFICAÇÃO: Rode este SELECT para confirmar que TODAS as tabelas têm RLS ativo
-- ==============================================================================
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ==============================================================================
-- INSTRUÇÃO: Execute este script no Supabase SQL Editor.
-- Após executar, recarregue o dashboard no Vercel (Ctrl+Shift+R).
-- Os dropdowns de Cliente, Serviço e Material devem voltar a funcionar.
-- ==============================================================================
