--- 🛠️ RESOLUÇÃO V5 FINAL: PERMISSÕES DE EXCLUSÃO (RLS) & MODERNIZAÇÃO
--- Aplique este Script no SQL Editor para liberar a exclusão para os gestores.

--- 1. Ampliar a política de exclusão de OS (Case-insensitive)
DROP POLICY IF EXISTS "Delecao de OS restrita" ON ordens_servico;
CREATE POLICY "Delecao de OS restrita"
ON ordens_servico FOR DELETE TO authenticated
USING (
  LOWER((SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1)) 
  IN ('admin', 'diretor', 'financeiro', 'administrador', 'gerente', 'ceo', 'engenheiro', 'dono', 'mestre')
);

--- 2. Garantir CASCADE em tabelas de suporte que podem bloquear a deleção
DO $$
BEGIN
    BEGIN
        ALTER TABLE os_servicos_executados DROP CONSTRAINT IF EXISTS os_servicos_executados_os_id_fkey;
        ALTER TABLE os_servicos_executados 
        ADD CONSTRAINT os_servicos_executados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Skipping os_servicos_executados cascade check';
    END;

    BEGIN
        ALTER TABLE os_materiais_utilizados DROP CONSTRAINT IF EXISTS os_materiais_utilizados_os_id_fkey;
        ALTER TABLE os_materiais_utilizados 
        ADD CONSTRAINT os_materiais_utilizados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipping os_materiais_utilizados cascade check';
    END;
END $$;

COMMENT ON POLICY "Delecao de OS restrita" ON ordens_servico IS 'Liberada para cargos de gestão e administração (Case-insensitive)';
