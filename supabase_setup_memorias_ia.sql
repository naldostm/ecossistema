-- =========================================================
-- ERP HVAC V2 - Tabela de Memória das IAs (n8n LangChain)
-- =========================================================
-- Rode este script no SQL Editor do Supabase para criar 
-- o "cérebro" de longo prazo das IAs (Maria, Ian, Márcia).
-- =========================================================

CREATE TABLE IF NOT EXISTS n8n_chat_messages (
    id SERIAL PRIMARY KEY,
    "sessionId" VARCHAR(255) NOT NULL,
    "message" JSONB NOT NULL
);

-- Index crucial para que a IA busque o histórico do WhatsApp (telefone) rapidamente
CREATE INDEX IF NOT EXISTS "idx_n8n_chat_messages_sessionId" ON n8n_chat_messages ("sessionId");

-- Políticas RLS (Opcional, mas recomendado para a Anon Key do n8n)
ALTER TABLE n8n_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Libera leitura para IAs via n8n"
ON n8n_chat_messages FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Libera escrita para IAs via n8n"
ON n8n_chat_messages FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Libera update para IAs via n8n"
ON n8n_chat_messages FOR UPDATE TO authenticated, anon USING (true);
