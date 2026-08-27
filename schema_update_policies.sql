-- ==============================================================================
-- SCHEMA SUPABASE: ATUALIZAÇÃO DE POLÍTICAS DE INSERÇÃO
-- Execute este script no "SQL Editor" para permitir o Auto-Cadastro
-- ==============================================================================

-- 1. Permite que um usuário inserido (que acabou de se cadastrar na Home) crie sua própria linha na Tabela de Cargos
CREATE POLICY "Permitir auto-inserção de colaborador" 
ON colaboradores FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Permite ao admin alterar dados de outros colaboradores, se necessário no futuro
CREATE POLICY "Permitir atualizacao via admin" 
ON colaboradores FOR UPDATE 
USING ( (SELECT cargo FROM colaboradores WHERE id = auth.uid()) = 'admin' );
