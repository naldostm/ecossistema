-- SCRIPT DE MEMORIA: Maria Cecília (n8n_chat_histories) 🧠
-- Este script cria a estrutura necessária para o n8n guardar o histórico das conversas no seu Supabase.

-- 1. Criação da Tabela de Histórico
-- Usamos JSONB para o n8n salvar o objeto completo da mensagem.
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    message JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índice para Busca Rápida
-- O n8n busca as mensagens pelo session_id, então o índice é essencial para carregar o histórico rápido.
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_id ON n8n_chat_histories(session_id);


-- 📝 CONFIGURAÇÃO NO N8N (No nó "PostgreSQL Chat Memory"):
-- • Host: seu_host_do_supabase
-- • Database: postgres
-- • Table Name: n8n_chat_histories
-- • Session ID Key: session_id
-- • Message Key: message
