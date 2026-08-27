-- ==============================================================================
-- MODERNIZAÇÃO V2: AGENDA & AUDITORIA
-- ==============================================================================

-- 1. Adicionar campo de agendamento na tabela de OS
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS data_agendamento DATE DEFAULT CURRENT_DATE;

-- 2. Criar tabela de Auditoria (Logs de Alteração)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tabela_alvo TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    acao TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    dados_antigos JSONB,
    dados_novos JSONB,
    usuario_info TEXT, -- Nome do colaborador ou role
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar RLS na auditoria (apenas para leitura/escrita pelo sistema)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total à auditoria (anônimo para MVP)" 
ON audit_logs FOR ALL USING (true);

-- Comentários de referência
COMMENT ON COLUMN ordens_servico.data_agendamento IS 'Data para exibição no Painel de Agenda/Timeline';
COMMENT ON TABLE audit_logs IS 'Histórico universal de alterações do ecossistema Arnaldo Trentin';
