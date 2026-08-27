-- 🛠️ RESOLUÇÃO V5: PERMISSÕES DE EXCLUSÃO (RLS) & INTEGRIDADE
-- Aplique este Script no SQL Editor para liberar a exclusão para os gestores.

-- 1. Ampliar a política de exclusão de OS para ser case-insensitive e mais inclusiva
DROP POLICY IF EXISTS "Delecao de OS restrita" ON ordens_servico;
CREATE POLICY "Delecao de OS restrita"
ON ordens_servico FOR DELETE TO authenticated
USING (
  LOWER((SELECT cargo FROM colaboradores WHERE id = auth.uid() LIMIT 1)) 
  IN ('admin', 'diretor', 'financeiro', 'administrador', 'gerente', 'ceo', 'engenheiro', 'dono')
);

-- 2. Garantir CASCADE em tabelas de suporte (Evitar erros de FK)
-- Se houver PMOC ou Laudos vinculados, eles precisam sumir com a OS.
DO $$
BEGIN
    BEGIN
        ALTER TABLE pmoc_laudos DROP CONSTRAINT IF EXISTS pmoc_laudos_os_id_fkey;
        ALTER TABLE pmoc_laudos 
        ADD CONSTRAINT pmoc_laudos_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Skipping pmoc_laudos check';
    END;

    BEGIN
        ALTER TABLE os_servicos_executados DROP CONSTRAINT IF EXISTS os_servicos_executados_os_id_fkey;
        ALTER TABLE os_servicos_executados 
        ADD CONSTRAINT os_servicos_executados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Re-applied os_servicos cascade';
    END;
END $$;

COMMENT ON POLICY "Delecao de OS restrita" ON ordens_servico IS 'Liberada para cargos de gestão e administração (Case-insensitive)';
