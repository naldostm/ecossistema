-- 📝 COMO CRIAR UM ADMINISTRADOR NO SUPABASE (PASSO-A-PASSO)
-- Siga estes 3 passos para ganhar acesso total ao ecossistema Arnaldo Trentin.

-- ==============================================================================
-- PASSO 1: Crie o usuário no Painel do Supabase
-- 1. Vá em "Authentication" -> "Users".
-- 2. Clique em "Add User" -> "Create new user".
-- 3. Crie E-mail e Senha (ex: adm@empresa.com).
-- 4. Copie o "User UID" (um código longo tipo 'abc-123-...') que o Supabase gerou.
-- ==============================================================================

-- ==============================================================================
-- PASSO 2: Rode este SQL abaixo substituindo o seu UUID
-- Substitua 'SEU-USER-ID-AQUI' pelo UID que você copiou do passo anterior.
-- ==============================================================================

INSERT INTO public.colaboradores (id, nome_completo, cargo, status_ativo)
VALUES (
  'SEU-USER-ID-AQUI', -- <--- COLE O UID AQUI
  'Administrador Geral', 
  'admin', 
  true
)
ON CONFLICT (id) DO UPDATE 
SET cargo = 'admin', nome_completo = 'Administrador Geral';

-- ==============================================================================
-- PASSO 3: Garanta que o RBAC (Segurança por Cargo) funcione
-- Este script limpa políticas antigas e libera o acesso para o ADM.
-- ==============================================================================

-- Política para que o Administrador veja TODOS os pedidos
DROP POLICY IF EXISTS "Adm vê tudo em OS" ON ordens_servico;
CREATE POLICY "Adm vê tudo em OS" ON ordens_servico 
FOR ALL TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Política para que o Administrador veja TODOS os colaboradores (RH)
DROP POLICY IF EXISTS "Adm vê equipe" ON colaboradores;
CREATE POLICY "Adm vê equipe" ON colaboradores 
FOR ALL TO authenticated
USING (
  (SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- ==============================================================================
-- DICA: Se as tabelas estiverem vazias, o dashboard exibirá "Erro na Conexão".
-- Tente inserir um cliente e uma OS de teste para validar o carregamento.
-- ==============================================================================
