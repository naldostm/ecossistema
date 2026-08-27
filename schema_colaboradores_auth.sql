-- ==============================================================================
-- SCHEMA SUPABASE: AUTENTICAÇÃO E CARGOS (RBAC)
-- Execute este script no "SQL Editor" para criar a tabela de colaboradores oficiais
-- ==============================================================================

-- 1. Criação da Tabela de Colaboradores vinculada ao "Authentication" nativo
CREATE TABLE IF NOT EXISTS colaboradores (
    id UUID REFERENCES auth.users(id) PRIMARY KEY, -- Esta PK casa perfeitamente com o Auth User gerado pelo Supabase
    nome_completo VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'tecnico' CHECK (cargo IN ('admin', 'atendimento', 'tecnico', 'financeiro')),
    status_ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Segurança e Regras de Permissão
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- Permitir que colaboradores vejam seus próprios dados ou Administradores vejam todos
CREATE POLICY "Leitura global de colaboradores apenas para autenticados" 
ON colaboradores FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================================
-- NOTA PARA O ADMINISTRADOR (VOCÊ):
-- 1. Vá na aba "Authentication" -> "Users" no seu Supabase e clique em "Add User".
-- 2. Crie E-mail e Senha (ex: arnaldo@empresa.com).
-- 3. Em seguida, pegue o "User UID" que o Supabase gerar lá e faça um INSERT 
--    nesta tabela "colaboradores" com o mesmo ID, definindo o seu cargo como 'admin'.
-- ==============================================================================
