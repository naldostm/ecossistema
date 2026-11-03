-- Cadastro de clientes: nome, telefone, endereço e CPF/CNPJ continuam em "clientes".
-- Se for cliente COMERCIAL, o cliente se liga a uma empresa (nome, área de atuação, e-mail).
-- Várias pessoas da mesma empresa compartilham a mesma linha em "empresas",
-- então o histórico pode ser agrupado pela empresa.
-- Migração ADITIVA: não altera nem apaga dados existentes.

CREATE TABLE IF NOT EXISTS public.empresas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL,
    area_atuacao  TEXT,
    email         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS empresas_nome_lower_idx ON public.empresas (lower(nome));

-- empresa_id preenchido = cliente comercial (histórico agrupado pela empresa).
-- empresa_id vazio      = pessoa física (histórico da própria pessoa).
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clientes_empresa_id_idx ON public.clientes (empresa_id);

-- Segurança: tabelas novas ficam abertas por padrão no Supabase.
-- A Edge Function usa a service role (ignora RLS). O CRM web exige usuário logado.
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_authenticated_all" ON public.empresas;
CREATE POLICY "empresas_authenticated_all" ON public.empresas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
