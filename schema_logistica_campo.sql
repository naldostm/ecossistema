-- ==============================================================================
-- SCHEMA SUPABASE: CAMPO, LOGÍSTICA E OBRAS (IAN GILLAN)
-- Execute este script no seu banco do Supabase.
-- ==============================================================================

-- 1. TABELA DE OBRAS (O Guarda-Chuva das OSs)
-- Permite que um Cliente tenha várias Obras ativas, e cada Obra possua várias OSs pontuais.
CREATE TABLE IF NOT EXISTS obras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    nome_obra VARCHAR(255) NOT NULL,
    endereco_operacional TEXT,
    status_obra VARCHAR(50) DEFAULT 'Em Andamento', -- Em Andamento, Paralisada, Concluída
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ACERVAMENTO NA TABELA DE ORDENS DE SERVIÇO (CONEXÃO DA OS)
-- Conecta a OS existente à Obra recém criada e aos pareceres de qualidade.
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS relatorio_tecnico_final TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS parecer_supervisor TEXT;

-- 3. ACERVO TÉCNICO DE OBRAS (PDFs e Manuais p/ Suporte de Campo via RAG IA)
-- Alimentará a base de dados em profundidade de cada Obra.
CREATE TABLE IF NOT EXISTS obras_documentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(100), -- Ex: Projeto Elétrico, Manual Split, Termo, AVCB
    nome_arquivo VARCHAR(255),
    url_arquivo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. DIÁRIO DE CAMPO E SUPORTE DO TÉCNICO (Evidências e Tira-Dúvidas com o Ian)
-- Unifica a central de Atendimento do campo aos Arquivos Visualizados (Antes, Durante, Depois).
CREATE TABLE IF NOT EXISTS os_evidencias_chat (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id BIGINT REFERENCES public.ordens_servico(id_os) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL, -- Qual Técnico está mandando a foto/duvida?
    remetente VARCHAR(50) CHECK (remetente IN ('Técnico', 'Ian Gillan', 'Sistema')),
    tipo_midia VARCHAR(50) DEFAULT 'Texto', -- Opções: Texto, Audio, Foto_Antes, Foto_Durante, Foto_Depois, Video
    mensagem TEXT, -- Duvida do técnico, bronca de IA ou texto falado.
    url_arquivo TEXT, -- Link da foto
    avaliacao_qualidade VARCHAR(50), -- Aprovado, Reprovado (Apenas preenchido pelo Ian)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. POLÍTICAS DE SUPABASE E RLS BÁSICAS PARA INTEGRAÇÃO EXTERNA (N8N / ZAPIER / IA)
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_evidencias_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso anonimo a obras" ON obras FOR ALL USING (true);
CREATE POLICY "Acesso anonimo a doc obras" ON obras_documentos FOR ALL USING (true);
CREATE POLICY "Acesso anonimo evidencias e chat ians" ON os_evidencias_chat FOR ALL USING (true);
