-- Incremento de Esquema: Múltiplas Datas p/ OS (FIX: BIGINT FK)
-- Descrição: Permite que uma OS tenha um cronograma de execução com múltiplas datas.

-- Nota técnica: O id_os na tabela ordens_servico é BIGINT, não UUID.
CREATE TABLE IF NOT EXISTS public.os_datas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    os_id BIGINT NOT NULL REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE,
    data DATE NOT NULL,
    descricao TEXT DEFAULT 'Dia de Execução',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.os_datas ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Anon e Authenticated - Simplificado V2)
DROP POLICY IF EXISTS "Acesso Total OS Datas" ON public.os_datas;
CREATE POLICY "Acesso Total OS Datas" ON public.os_datas FOR ALL USING (true) WITH CHECK (true);

-- Notificar PostgREST para atualizar cache
NOTIFY pgrst, 'reload schema';
