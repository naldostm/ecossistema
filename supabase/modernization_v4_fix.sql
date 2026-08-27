-- 🛠️ CORREÇÃO E ATUALIZAÇÃO V4: SINCRONIA DE CALENDÁRIO & LIMPEZA DE OS
-- Aplique este Script no SQL Editor para corrigir as falhas reportadas.

-- 1. Adicionar campo de data individual nos serviços da OS (Obrigatório para o Calendário)
ALTER TABLE os_servicos_executados 
ADD COLUMN IF NOT EXISTS data_execucao DATE DEFAULT CURRENT_DATE;

-- 2. Garantir que as chaves estrangeiras tenham CASCADE no DELETE
-- Isso garante que ao deletar a OS Mestra, todos os itens (serviços/materiais) sumam automaticamente.
DO $$
BEGIN
    -- Remove restrições antigas se existirem e recria com CASCADE
    BEGIN 
        ALTER TABLE os_servicos_executados DROP CONSTRAINT IF EXISTS os_servicos_executados_os_id_fkey;
        ALTER TABLE os_servicos_executados 
        ADD CONSTRAINT os_servicos_executados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao migrar constraints de servicos';
    END;

    BEGIN
        ALTER TABLE os_materiais_utilizados DROP CONSTRAINT IF EXISTS os_materiais_utilizados_os_id_fkey;
        ALTER TABLE os_materiais_utilizados 
        ADD CONSTRAINT os_materiais_utilizados_os_id_fkey 
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id_os) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao migrar constraints de materiais';
    END;
END $$;

COMMENT ON COLUMN os_servicos_executados.data_execucao IS 'Data em que este serviço específico será realizado (Usado no Chronos)';
