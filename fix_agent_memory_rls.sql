-- =========================================================================
-- FIX RLS E SCHEMA COMPLETO DE AGENT_MEMORY (CENTRAL LIVE CRM & MARIA CECÍLIA)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_agent_memory_phone ON public.agent_memory(phone);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON public.agent_memory(created_at);

-- RLS: Liberar para leitura e escrita do painel web (anon) e Edge Functions (service_role)
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to agent_memory" ON public.agent_memory;
DROP POLICY IF EXISTS "Allow all for agent_memory" ON public.agent_memory;
DROP POLICY IF EXISTS "Allow Service Role full access" ON public.agent_memory;

CREATE POLICY "Allow all access to agent_memory" ON public.agent_memory
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
