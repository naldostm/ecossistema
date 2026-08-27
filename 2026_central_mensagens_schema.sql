-- ==============================================================================
-- 📱 CENTRAL DE MENSAGENS — MARIA CECÍLIA OUTBOUND
-- Tabela de log para campanhas de mensagens via WhatsApp
-- Data: 22 de Abril de 2026
-- ==============================================================================

CREATE TABLE IF NOT EXISTS campanhas_mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,                              -- 'atendimento', 'orcamento', 'confirmacao', 'pos_venda', 'cobranca'
  briefing TEXT,                                   -- Instrução livre do Arnaldo
  cliente_id UUID REFERENCES clientes(id),
  cliente_nome TEXT,
  cliente_whatsapp TEXT,
  mensagem_gerada TEXT,                            -- O que a IA gerou e enviou
  status TEXT DEFAULT 'enviado',                   -- 'enviado', 'erro', 'pendente'
  enviado_por UUID,                                -- auth.uid() de quem disparou
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campanhas_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_campanhas" ON campanhas_mensagens FOR ALL TO authenticated USING (true);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_campanhas_tipo ON campanhas_mensagens(tipo);
CREATE INDEX IF NOT EXISTS idx_campanhas_created ON campanhas_mensagens(created_at DESC);
