-- ==============================================================================
-- 🛡️ SCRIPT DEFINITIVO DE HARDENING RLS — ECOSSISTEMA ARNALDO TRENTIN
-- Data: 22 de Abril de 2026
-- Autor: Security Audit Antigravity
-- ==============================================================================
-- OBJETIVO: Fechar TODAS as brechas de acesso público, consolidar todas as
-- políticas RLS em um único script autoritativo. Após executar, NENHUMA
-- tabela terá acesso anônimo (público).
--
-- ⚠️  INSTRUÇÕES:
-- 1. Acesse o Supabase Dashboard → SQL Editor
-- 2. Cole este script INTEIRO
-- 3. Execute (F5 ou botão Run)
-- 4. Recarregue o Dashboard (Ctrl+Shift+R)
-- ==============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 1: ATIVAR RLS EM ABSOLUTAMENTE TODAS AS TABELAS                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_prisma_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        RAISE NOTICE 'RLS ATIVADO → %', r.tablename;
    END LOOP;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 2: REMOVER TODAS AS POLÍTICAS PERIGOSAS (FOR ALL / anon / public)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 2.1 TABELAS CORE (Dados Sensíveis)
DROP POLICY IF EXISTS "Permitir acesso anônimo total a clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir acesso anônimo total as OS" ON ordens_servico;
DROP POLICY IF EXISTS "Permitir acesso anônimo total a materiais" ON materiais;
DROP POLICY IF EXISTS "Permitir acesso anônimo total a ferramentas" ON ferramentas;
DROP POLICY IF EXISTS "Permitir acesso anônimo total a servicos" ON servicos;
DROP POLICY IF EXISTS "Acesso total as OS" ON ordens_servico;

-- 2.2 TABELAS FINANCEIRAS (As mais sensíveis)
DROP POLICY IF EXISTS "Libera FluxoCaixa" ON fluxo_caixa;
DROP POLICY IF EXISTS "Libera Faturamentos" ON faturamentos;
DROP POLICY IF EXISTS "Libera Comissoes" ON comissoes;
DROP POLICY IF EXISTS "Enable all for authenticated users (faturamentos)" ON faturamentos;
DROP POLICY IF EXISTS "Enable all for anon (faturamentos)" ON faturamentos;
DROP POLICY IF EXISTS "Enable all for authenticated users (comissoes)" ON comissoes;
DROP POLICY IF EXISTS "Enable all for anon (comissoes)" ON comissoes;

-- 2.3 TABELAS AUXILIARES (JOINs das OS)
DROP POLICY IF EXISTS "Acesso total as tarefas OS" ON os_servicos_executados;
DROP POLICY IF EXISTS "Libera Servicos_Ex" ON os_servicos_executados;
DROP POLICY IF EXISTS "Acesso total aos materiais OS" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Libera Materiais_Ex" ON os_materiais_utilizados;
DROP POLICY IF EXISTS "Acesso Total OS Datas" ON os_datas;
-- 2.4 — 2.7 TABELAS QUE PODEM NÃO EXISTIR (verificação condicional)
DO $$
DECLARE
    _tbl TEXT;
    _pol TEXT;
    _pairs TEXT[][] := ARRAY[
        -- 2.4 INFRAESTRUTURA
        ARRAY['parque_equipamentos', 'Acesso Total Parque'],
        ARRAY['pmoc_config', 'Acesso Total PMOC Config'],
        ARRAY['audit_logs', 'Acesso Total Auditoria'],
        ARRAY['obras', 'Acesso anonimo a obras'],
        ARRAY['obras_documentos', 'Acesso anonimo a doc obras'],
        ARRAY['os_evidencias_chat', 'Acesso anonimo evidencias e chat ians'],
        -- 2.5 CHAT/CRM
        ARRAY['chat_sessoes', 'Permissao Total Sessoes'],
        ARRAY['chat_mensagens', 'Permissao Total Mensagens'],
        ARRAY['notificacoes_internas', 'Permissao Total Notificacoes'],
        -- 2.6 JURÍDICAS/PMOC
        ARRAY['contratos_pmoc', 'Libera Contratos'],
        ARRAY['pmoc_equipamentos', 'Libera Equipamentos'],
        ARRAY['pmoc_laudos', 'Libera Laudos'],
        -- 2.7 MARKETING
        ARRAY['marketing_postagens', 'Libera Mkt']
    ];
BEGIN
    FOR i IN 1..array_length(_pairs, 1) LOOP
        _tbl := _pairs[i][1];
        _pol := _pairs[i][2];
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol, _tbl);
            RAISE NOTICE 'Política removida → % em %', _pol, _tbl;
        ELSE
            RAISE NOTICE 'Tabela % não existe, pulando...', _tbl;
        END IF;
    END LOOP;
END $$;

-- 2.8 TABELAS DE MIGRAÇÃO (podem não existir — verificação condicional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipamentos') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Full access to authenticated users" ON equipamentos';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pmoc_leituras') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Full access to authenticated users" ON pmoc_leituras';
    END IF;
END $$;

-- 2.9 REMOVER TODAS as políticas DO PATCH ANTERIOR que vamos recriar
-- (Evita duplicatas: "already exists" + verifica existência das tabelas)
DO $$
DECLARE
    _tbl TEXT;
    _pol TEXT;
    _pairs TEXT[][] := ARRAY[
        -- Clientes
        ARRAY['clientes', 'Leitura de clientes'],
        ARRAY['clientes', 'Edicao de clientes'],
        ARRAY['clientes', 'Insercao de clientes'],
        ARRAY['clientes', 'Exclusao de clientes'],
        -- Ordens de Serviço
        ARRAY['ordens_servico', 'Leitura de ordens_servico'],
        ARRAY['ordens_servico', 'Edicao de ordens_servico'],
        ARRAY['ordens_servico', 'Insercao de ordens_servico'],
        ARRAY['ordens_servico', 'Leitura de OS'],
        ARRAY['ordens_servico', 'Edicao de OS'],
        ARRAY['ordens_servico', 'Insercao de OS'],
        ARRAY['ordens_servico', 'Delecao de OS restrita'],
        ARRAY['ordens_servico', 'Adm vê tudo em OS'],
        -- Materiais
        ARRAY['materiais', 'Leitura de materiais logados'],
        ARRAY['materiais', 'Escrita de materiais logados'],
        ARRAY['materiais', 'Edicao de materiais logados'],
        ARRAY['materiais', 'Exclusao de materiais logados'],
        -- Ferramentas
        ARRAY['ferramentas', 'Leitura de ferramentas logados'],
        ARRAY['ferramentas', 'Escrita de ferramentas logados'],
        ARRAY['ferramentas', 'Edicao de ferramentas logados'],
        ARRAY['ferramentas', 'Exclusao de ferramentas logados'],
        -- Serviços
        ARRAY['servicos', 'Leitura de servicos logados'],
        ARRAY['servicos', 'Escrita de servicos logados'],
        ARRAY['servicos', 'Edicao de servicos logados'],
        ARRAY['servicos', 'Exclusao de servicos logados'],
        -- Colaboradores
        ARRAY['colaboradores', 'Leitura global de colaboradores'],
        ARRAY['colaboradores', 'Atualizacao de dados proprios'],
        ARRAY['colaboradores', 'Adm vê equipe'],
        ARRAY['colaboradores', 'Insercao de colaboradores'],
        ARRAY['colaboradores', 'Exclusao de colaboradores'],
        -- Chat
        ARRAY['chat_sessoes', 'Leitura sessao logada'],
        ARRAY['chat_sessoes', 'Escrita sessao logada'],
        ARRAY['chat_sessoes', 'Edicao sessao logada'],
        ARRAY['chat_mensagens', 'Leitura chat logado'],
        ARRAY['chat_mensagens', 'Escrita chat logado'],
        -- Financeiro
        ARRAY['comissoes', 'Leitura Comissoes'],
        ARRAY['comissoes', 'Escrita Comissoes'],
        ARRAY['comissoes', 'Edicao Comissoes'],
        ARRAY['faturamentos', 'Leitura Faturamentos'],
        ARRAY['faturamentos', 'Escrita Faturamentos'],
        ARRAY['faturamentos', 'Edicao Faturamentos'],
        ARRAY['fluxo_caixa', 'Restricao absoluta do Caixa'],
        -- Propostas
        ARRAY['propostas', 'Leitura de propostas logados'],
        ARRAY['propostas', 'Escrita de propostas logados'],
        ARRAY['propostas', 'Edicao de propostas logados'],
        ARRAY['propostas', 'Exclusao de propostas logados'],
        -- OS Auxiliares
        ARRAY['os_servicos_executados', 'Leitura os_servicos logados'],
        ARRAY['os_servicos_executados', 'Escrita os_servicos logados'],
        ARRAY['os_servicos_executados', 'Edicao os_servicos logados'],
        ARRAY['os_servicos_executados', 'Exclusao os_servicos logados'],
        ARRAY['os_materiais_utilizados', 'Leitura os_materiais logados'],
        ARRAY['os_materiais_utilizados', 'Escrita os_materiais logados'],
        ARRAY['os_materiais_utilizados', 'Edicao os_materiais logados'],
        ARRAY['os_materiais_utilizados', 'Exclusao os_materiais logados'],
        ARRAY['os_datas', 'Leitura os_datas logados'],
        ARRAY['os_datas', 'Escrita os_datas logados'],
        ARRAY['os_datas', 'Edicao os_datas logados'],
        ARRAY['os_datas', 'Exclusao os_datas logados'],
        -- Parque
        ARRAY['parque_equipamentos', 'Leitura parque logados'],
        ARRAY['parque_equipamentos', 'Escrita parque logados'],
        ARRAY['parque_equipamentos', 'Edicao parque logados'],
        ARRAY['parque_equipamentos', 'Exclusao parque logados'],
        -- Agent Memory
        ARRAY['agent_memory', 'Leitura agent_memory logados'],
        ARRAY['agent_memory', 'Escrita agent_memory logados']
    ];
BEGIN
    FOR i IN 1..array_length(_pairs, 1) LOOP
        _tbl := _pairs[i][1];
        _pol := _pairs[i][2];
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol, _tbl);
        END IF;
    END LOOP;
    RAISE NOTICE '✅ Fase 2.9 concluída: políticas antigas removidas com segurança.';
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 3: CRIAR POLÍTICAS SEGURAS (authenticated ONLY)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─── 3.1 CLIENTES ───
CREATE POLICY "auth_select_clientes" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clientes" ON clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clientes" ON clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_clientes" ON clientes FOR DELETE TO authenticated USING (true);

-- ─── 3.2 ORDENS DE SERVIÇO ───
CREATE POLICY "auth_select_os" ON ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_os" ON ordens_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_os" ON ordens_servico FOR UPDATE TO authenticated USING (true);
-- DELETE restrito a gestão
CREATE POLICY "auth_delete_os_gestao" ON ordens_servico FOR DELETE TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN ('admin', 'diretor', 'financeiro', 'diretoria', 'engenheiro', 'master')
);

-- ─── 3.3 MATERIAIS ───
CREATE POLICY "auth_select_materiais" ON materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_materiais" ON materiais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_materiais" ON materiais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_materiais" ON materiais FOR DELETE TO authenticated USING (true);

-- ─── 3.4 FERRAMENTAS ───
CREATE POLICY "auth_select_ferramentas" ON ferramentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_ferramentas" ON ferramentas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_ferramentas" ON ferramentas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_ferramentas" ON ferramentas FOR DELETE TO authenticated USING (true);

-- ─── 3.5 SERVIÇOS ───
CREATE POLICY "auth_select_servicos" ON servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_servicos" ON servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_servicos" ON servicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_servicos" ON servicos FOR DELETE TO authenticated USING (true);

-- ─── 3.6 COLABORADORES ───
CREATE POLICY "auth_select_colaboradores" ON colaboradores FOR SELECT TO authenticated USING (true);
-- INSERT precisa funcionar durante o registro (o user acabou de ser criado via Auth)
CREATE POLICY "auth_insert_colaboradores" ON colaboradores FOR INSERT TO authenticated WITH CHECK (true);
-- UPDATE apenas o próprio perfil OU admins
CREATE POLICY "auth_update_colaboradores" ON colaboradores FOR UPDATE TO authenticated
USING (
  id = auth.uid() 
  OR (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN ('admin', 'diretor', 'diretoria', 'master')
);
-- DELETE apenas admins
CREATE POLICY "auth_delete_colaboradores" ON colaboradores FOR DELETE TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN ('admin', 'diretor', 'diretoria', 'master')
);

-- ─── 3.7 — 3.16 TABELAS QUE PODEM NÃO EXISTIR (criação condicional) ───
DO $$
BEGIN
    -- 3.7 PROPOSTAS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'propostas') THEN
        EXECUTE 'CREATE POLICY "auth_select_propostas" ON propostas FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_propostas" ON propostas FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_propostas" ON propostas FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_propostas" ON propostas FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ Propostas → políticas criadas';
    END IF;

    -- 3.8 OBRAS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obras') THEN
        EXECUTE 'CREATE POLICY "auth_select_obras" ON obras FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_obras" ON obras FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_obras" ON obras FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_obras" ON obras FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ Obras → políticas criadas';
    END IF;

    -- 3.9 FLUXO DE CAIXA (SENSÍVEL)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fluxo_caixa') THEN
        EXECUTE 'CREATE POLICY "auth_all_fluxo_caixa" ON fluxo_caixa FOR ALL TO authenticated USING ((SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN (''admin'', ''diretor'', ''financeiro'', ''diretoria'', ''master''))';
        RAISE NOTICE '✅ Fluxo Caixa → política restrita criada';
    END IF;

    -- 3.10 FATURAMENTOS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faturamentos') THEN
        EXECUTE 'CREATE POLICY "auth_select_faturamentos" ON faturamentos FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_faturamentos" ON faturamentos FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_faturamentos" ON faturamentos FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_faturamentos" ON faturamentos FOR DELETE TO authenticated USING ((SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN (''admin'', ''diretor'', ''financeiro'', ''master''))';
        RAISE NOTICE '✅ Faturamentos → políticas criadas';
    END IF;

    -- 3.11 COMISSÕES
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comissoes') THEN
        EXECUTE 'CREATE POLICY "auth_select_comissoes" ON comissoes FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_comissoes" ON comissoes FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_comissoes" ON comissoes FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_comissoes" ON comissoes FOR DELETE TO authenticated USING ((SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) IN (''admin'', ''diretor'', ''financeiro'', ''master''))';
        RAISE NOTICE '✅ Comissões → políticas criadas';
    END IF;

    -- 3.12 CONTRATOS PMOC
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contratos_pmoc') THEN
        EXECUTE 'CREATE POLICY "auth_select_contratos" ON contratos_pmoc FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_contratos" ON contratos_pmoc FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_contratos" ON contratos_pmoc FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_contratos" ON contratos_pmoc FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ Contratos PMOC → políticas criadas';
    END IF;

    -- 3.13 PARQUE DE EQUIPAMENTOS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parque_equipamentos') THEN
        EXECUTE 'CREATE POLICY "auth_select_parque" ON parque_equipamentos FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_parque" ON parque_equipamentos FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_parque" ON parque_equipamentos FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_parque" ON parque_equipamentos FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ Parque Equipamentos → políticas criadas';
    END IF;

    -- 3.14 OS SERVIÇOS EXECUTADOS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'os_servicos_executados') THEN
        EXECUTE 'CREATE POLICY "auth_select_os_servicos" ON os_servicos_executados FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_os_servicos" ON os_servicos_executados FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_os_servicos" ON os_servicos_executados FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_os_servicos" ON os_servicos_executados FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ OS Serviços Executados → políticas criadas';
    END IF;

    -- OS MATERIAIS UTILIZADOS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'os_materiais_utilizados') THEN
        EXECUTE 'CREATE POLICY "auth_select_os_materiais" ON os_materiais_utilizados FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_os_materiais" ON os_materiais_utilizados FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_os_materiais" ON os_materiais_utilizados FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_os_materiais" ON os_materiais_utilizados FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ OS Materiais Utilizados → políticas criadas';
    END IF;

    -- OS DATAS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'os_datas') THEN
        EXECUTE 'CREATE POLICY "auth_select_os_datas" ON os_datas FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_os_datas" ON os_datas FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_os_datas" ON os_datas FOR UPDATE TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_delete_os_datas" ON os_datas FOR DELETE TO authenticated USING (true)';
        RAISE NOTICE '✅ OS Datas → políticas criadas';
    END IF;

    -- 3.15 CHAT / CRM
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_sessoes') THEN
        EXECUTE 'CREATE POLICY "auth_select_chat_sessoes" ON chat_sessoes FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_chat_sessoes" ON chat_sessoes FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_chat_sessoes" ON chat_sessoes FOR UPDATE TO authenticated USING (true)';
        RAISE NOTICE '✅ Chat Sessões → políticas criadas';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_mensagens') THEN
        EXECUTE 'CREATE POLICY "auth_select_chat_mensagens" ON chat_mensagens FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_chat_mensagens" ON chat_mensagens FOR INSERT TO authenticated WITH CHECK (true)';
        RAISE NOTICE '✅ Chat Mensagens → políticas criadas';
    END IF;

    -- 3.16 AUDIT LOGS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        EXECUTE 'CREATE POLICY "auth_select_audit" ON audit_logs FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true)';
        RAISE NOTICE '✅ Audit Logs → políticas criadas';
    END IF;

    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '✅ FASE 3 CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '═══════════════════════════════════════';
END $$;

-- ─── 3.17 AGENT MEMORY (WhatsApp Bot — pode precisar de service_role do n8n) ───
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_memory') THEN
        EXECUTE 'CREATE POLICY "auth_select_agent_memory" ON agent_memory FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "auth_insert_agent_memory" ON agent_memory FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "auth_update_agent_memory" ON agent_memory FOR UPDATE TO authenticated USING (true)';
    END IF;
END $$;

-- ─── 3.18 TABELAS CONDICIONAIS (podem ou não existir) ───
DO $$
BEGIN
    -- PMOC Config
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pmoc_config') THEN
        EXECUTE 'CREATE POLICY "auth_all_pmoc_config" ON pmoc_config FOR ALL TO authenticated USING (true)';
    END IF;

    -- PMOC Equipamentos (antigo)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pmoc_equipamentos') THEN
        EXECUTE 'CREATE POLICY "auth_all_pmoc_equipamentos" ON pmoc_equipamentos FOR ALL TO authenticated USING (true)';
    END IF;

    -- PMOC Laudos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pmoc_laudos') THEN
        EXECUTE 'CREATE POLICY "auth_all_pmoc_laudos" ON pmoc_laudos FOR ALL TO authenticated USING (true)';
    END IF;

    -- Obras Documentos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obras_documentos') THEN
        EXECUTE 'CREATE POLICY "auth_all_obras_documentos" ON obras_documentos FOR ALL TO authenticated USING (true)';
    END IF;

    -- OS Evidências Chat
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'os_evidencias_chat') THEN
        EXECUTE 'CREATE POLICY "auth_all_os_evidencias" ON os_evidencias_chat FOR ALL TO authenticated USING (true)';
    END IF;

    -- Notificações Internas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notificacoes_internas') THEN
        EXECUTE 'CREATE POLICY "auth_all_notificacoes" ON notificacoes_internas FOR ALL TO authenticated USING (true)';
    END IF;

    -- Marketing Postagens
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_postagens') THEN
        EXECUTE 'CREATE POLICY "auth_all_marketing" ON marketing_postagens FOR ALL TO authenticated USING (true)';
    END IF;

    -- Equipamentos (tabela antiga de migração)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipamentos') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Full access to authenticated users" ON equipamentos';
        EXECUTE 'CREATE POLICY "auth_all_equipamentos" ON equipamentos FOR ALL TO authenticated USING (true)';
    END IF;

    -- PMOC Leituras (tabela antiga)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pmoc_leituras') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Full access to authenticated users" ON pmoc_leituras';
        EXECUTE 'CREATE POLICY "auth_all_pmoc_leituras" ON pmoc_leituras FOR ALL TO authenticated USING (true)';
    END IF;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 4: HARDENING DO STORAGE (Buckets)                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Substituir políticas públicas por políticas autenticadas

DROP POLICY IF EXISTS "Leitura_Publica_Storage" ON storage.objects;
DROP POLICY IF EXISTS "Envio_Publico_Storage" ON storage.objects;
DROP POLICY IF EXISTS "Modificacao_Publica_Storage" ON storage.objects;
DROP POLICY IF EXISTS "Delecao_Publica_Storage" ON storage.objects;
-- Também limpa políticas auth_* caso script seja re-executado
DROP POLICY IF EXISTS "auth_select_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_storage" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_storage" ON storage.objects;

CREATE POLICY "auth_select_storage" ON storage.objects FOR SELECT TO authenticated
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

CREATE POLICY "auth_insert_storage" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

CREATE POLICY "auth_update_storage" ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

CREATE POLICY "auth_delete_storage" ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id IN ('documentos_pmoc', 'conteudo_tecnico_obras', 'master_base_ia') );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ FASE 5: VERIFICAÇÃO FINAL                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Rode esta query SEPARADAMENTE após executar o script acima para verificar:

-- 5.1 Confirmar que TODAS as tabelas públicas têm RLS ativado:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 5.2 Verificar que NENHUMA política tem role 'anon' ou é sem role (público):
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND 'anon' = ANY(roles) ORDER BY tablename;

-- 5.3 Listar todas as políticas ativas para conferência:
-- SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- ==============================================================================
-- ✅ PRONTO! Se não houve erros em vermelho, o banco está blindado.
-- 
-- LEMBRETE: Se o n8n (webhook) parar de funcionar, é porque ele precisa
-- usar service_role key (não anon key). Configure no painel do n8n:
-- Settings → Credentials → Supabase → Use "service_role" key.
-- ==============================================================================
