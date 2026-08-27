-- Migration to create conversational memory for the AI agent

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index to query history by phone faster
CREATE INDEX IF NOT EXISTS idx_agent_memory_phone ON public.agent_memory(phone);

-- Secure it with RLS (if needed, default open for service role)
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- Allow service role access (already bypasses RLS by default, but creating a policy for safety)
CREATE POLICY "Allow Service Role full access" ON public.agent_memory
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
