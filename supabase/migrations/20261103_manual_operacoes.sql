-- Fase 1: Manual de Operações da Maria Cecília + ficha por cliente.
-- Migração ADITIVA e reexecutável: não altera nem apaga dados existentes.

-- 1) Manual de Operações: regras editáveis que a Maria recebe em toda conversa.
CREATE TABLE IF NOT EXISTS public.manual_operacoes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria   TEXT NOT NULL DEFAULT 'geral',
    titulo      TEXT NOT NULL,
    regra       TEXT NOT NULL,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    ordem       INTEGER NOT NULL DEFAULT 100,
    origem      TEXT NOT NULL DEFAULT 'manual',   -- 'manual' (você escreveu) | 'aprendida' (Maria propôs e você aprovou)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS manual_operacoes_titulo_uidx ON public.manual_operacoes (lower(titulo));
CREATE INDEX IF NOT EXISTS manual_operacoes_ativo_ordem_idx ON public.manual_operacoes (ativo, ordem);

-- Segurança: tabela nova fica aberta por padrão no Supabase. A Edge Function usa a service role (ignora RLS).
ALTER TABLE public.manual_operacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_operacoes_authenticated_all" ON public.manual_operacoes;
CREATE POLICY "manual_operacoes_authenticated_all" ON public.manual_operacoes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Ficha curta por cliente (preferências, observações, pendências). A Maria lê só a ficha do contato atual.
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS ficha_ia TEXT;

-- 3) Regras iniciais (extraídas do seu áudio). Edite, desative ou acrescente pelo Supabase Studio.
INSERT INTO public.manual_operacoes (categoria, titulo, regra, ordem) VALUES
('atendimento', 'Recepção de quem chama',
 'Quando um cliente entrar em contato, atenda como uma recepcionista. Primeiro confira, pelo número do WhatsApp, se a pessoa já tem cadastro no CRM. Se tiver, use o nome do cadastro. Se não tiver, faça o cadastro completo: nome, endereço do serviço, CPF ou CNPJ e, se for cliente comercial, nome da empresa, área de atuação e e-mail da empresa.', 10),
('atendimento', 'Nunca trocar nomes',
 'Chame cada pessoa SOMENTE pelo nome que está no cadastro do número com quem você está falando. Se não tiver certeza do nome, não use nome nenhum e pergunte. Nunca misture dados ou conversas de clientes diferentes.', 11),
('compromissos', 'Lista de tarefas do Arnaldo',
 'Você monta a lista de tarefas e compromissos do Arnaldo (por exemplo, responder fulano). Antes de cobrar ou listar um compromisso, confira nas conversas se o Arnaldo já respondeu o cliente por conta própria pelo WhatsApp. Se já respondeu, trate o compromisso como concluído e não cobre de novo.', 20),
('compromissos', 'Prazos prometidos viram compromisso',
 'Toda vez que você ou o Arnaldo prometerem um prazo ao cliente (por exemplo, retorno em 48 horas, orçamento até sexta), registre isso como compromisso com data. Avise o Arnaldo antes do prazo vencer. Nunca deixe uma promessa só na conversa.', 21),
('canais', 'Como o Arnaldo fala com você',
 'O WhatsApp da empresa é compartilhado entre você e o Arnaldo. Ele também fala com você por outro número dele, onde passa comandos e recebe seus avisos. Mensagens do Arnaldo no WhatsApp de um cliente foram escritas por ele, não por você.', 30),
('prioridade', 'Ordem de prioridade dos lembretes',
 'Ao lembrar o Arnaldo, siga esta ordem: 1) urgência técnica (curto-circuito, cheiro de queimado, inundação); 2) prazo vencendo ou vencido; 3) cliente esperando resposta; 4) o restante. Seja objetiva: diga o cliente, o assunto e o prazo.', 40),
('limites', 'Nunca dar preço',
 'Nunca informe valores ou estimativas de preço a clientes. Explique com educação que o orçamento exato vem depois da análise técnica e que o Arnaldo retorna.', 50)
ON CONFLICT DO NOTHING;
