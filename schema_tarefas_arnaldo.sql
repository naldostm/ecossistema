-- =========================================================================
-- SCHEMA: TAREFAS E SOLICITAÇÕES DO ARNALDO (CAPTURADAS PELA MARIA CECÍLIA)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.tarefas_arnaldo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT NOT NULL,
    tipo_solicitacao TEXT NOT NULL DEFAULT 'ORCAMENTO', -- 'ORCAMENTO', 'LIGACAO_RETORNO', 'VISITA_TECNICA', 'DUVIDA_NEGOCIACAO', 'OUTRO'
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    prioridade TEXT DEFAULT 'alta', -- 'alta', 'media', 'baixa'
    status TEXT DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluido', 'cancelado'
    resposta_ia TEXT, -- Mensagem acolhedora que a Maria enviou ao cliente ao captar a solicitação
    observacoes_arnaldo TEXT,
    concluido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para buscas rápidas e ordenação
CREATE INDEX IF NOT EXISTS idx_tarefas_arnaldo_status ON public.tarefas_arnaldo(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_arnaldo_created_at ON public.tarefas_arnaldo(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_arnaldo_tipo ON public.tarefas_arnaldo(tipo_solicitacao);
CREATE INDEX IF NOT EXISTS idx_tarefas_arnaldo_telefone ON public.tarefas_arnaldo(cliente_telefone);

-- RLS: Habilitar e liberar acesso para anon, authenticated e service_role
ALTER TABLE public.tarefas_arnaldo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to tarefas_arnaldo" ON public.tarefas_arnaldo;
CREATE POLICY "Allow all access to tarefas_arnaldo" ON public.tarefas_arnaldo
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
