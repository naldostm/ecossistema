-- Memória de longo prazo da Maria: resumo do histórico de cada contato.
-- As mensagens completas continuam em agent_memory (nada é apagado). Aqui fica só o resumo.
-- Migração ADITIVA e reexecutável.

CREATE TABLE IF NOT EXISTS public.resumos_conversa (
    chave           TEXT PRIMARY KEY,                       -- últimos 8 dígitos do telefone (mesma regra usada pelo resto do sistema)
    telefone        TEXT,
    cliente_id      UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    resumo          TEXT NOT NULL DEFAULT '',
    ultima_msg_em   TIMESTAMPTZ,                            -- até onde as mensagens já foram resumidas
    msgs_resumidas  INTEGER NOT NULL DEFAULT 0,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resumos_conversa_cliente_idx ON public.resumos_conversa (cliente_id);

-- Segurança: a Edge Function usa a service role (ignora RLS). O CRM web exige usuário logado.
ALTER TABLE public.resumos_conversa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resumos_conversa_authenticated_all" ON public.resumos_conversa;
CREATE POLICY "resumos_conversa_authenticated_all" ON public.resumos_conversa
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
