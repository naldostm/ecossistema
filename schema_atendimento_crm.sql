-- ==============================================================================
-- SCHEMA SUPABASE: ATENDIMENTO / CRM (MARIA CECÍLIA)
-- Execute este script no "SQL Editor" do seu Supabase.
-- ==============================================================================

-- 1. ADICIONAR STATUS DE PAGAMENTO NA ORDEM DE SERVIÇO
-- Isso permite que a Maria Cecília faça pesquisas de OS pendentes.
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS status_pagamento VARCHAR(50) DEFAULT 'Pendente';

-- 2. TABELA DE SESSÕES DE CHAT (WHATSAPP)
-- Organiza a conversa histórica por cliente e número de celular.
CREATE TABLE IF NOT EXISTS chat_sessoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL, -- Se já for cliente conhecido
    whatsapp_origem VARCHAR(20) NOT NULL,
    status_sessao VARCHAR(50) DEFAULT 'Aberta', -- Aberta, Resolvida, Transferida
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE MENSAGENS DO CHAT (Memória estendida de 90 dias ou mais)
-- Guarda cada fala exata do cliente e da Inteligência Artificial.
CREATE TABLE IF NOT EXISTS chat_mensagens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sessao_id UUID REFERENCES public.chat_sessoes(id) ON DELETE CASCADE,
    remetente VARCHAR(50) CHECK (remetente IN ('Cliente', 'Maria Cecília', 'Arnaldo', 'Admins', 'Sistema')),
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE ALERTAS / NOTIFICAÇÕES GERAIS
-- Para a Maria Cecília notificar a Dashboard (Ex: Cliente disse "Curto-Circuito" ou "Urgente")
CREATE TABLE IF NOT EXISTS notificacoes_internas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_alerta VARCHAR(50) DEFAULT 'Aviso', -- Emergência, Aviso Comercial, Sistema
    titulo VARCHAR(150) NOT NULL,
    mensagem TEXT,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 5. SEGURANÇA BÁSICA (RLS PARA INTEGRAÇÃO COM IA - N8N, Dify, Flowise, etc)
-- ==============================================================================
ALTER TABLE chat_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissao Total Sessoes" ON chat_sessoes FOR ALL USING (true);
CREATE POLICY "Permissao Total Mensagens" ON chat_mensagens FOR ALL USING (true);
CREATE POLICY "Permissao Total Notificacoes" ON notificacoes_internas FOR ALL USING (true);
