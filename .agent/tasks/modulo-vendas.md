# Plano de Implementação: Planilha de Vendas de Produtos

## 🎯 Objetivo
Criar um módulo de **Planilha de Vendas** para controlar a saída de materiais/produtos do estoque. Quando uma venda for registrada, o sistema deve abater a quantidade do estoque automaticamente e lançar uma "Entrada" no Fluxo de Caixa Central, contabilizando o faturamento e o lucro.

## 🛠️ Arquitetura e Fluxo de Dados
- **Tabela `vendas_produtos` (Supabase):** Tabela para histórico detalhado (produto, quantidade, valor de compra, valor de venda, lucro, cliente/OS).
- **Integração de Estoque:** Ao salvar a venda, um trigger no Supabase ou uma função JS atualizará a tabela `materiais` diminuindo a `quantidade`.
- **Integração Financeira:** Uma inserção simultânea ocorrerá na tabela `fluxo_caixa` com `tipo_movimento = 'Entrada'` e categoria 'Venda de Produto'.

## 📋 Fases de Execução

### Fase 1: Estrutura do Banco de Dados (Supabase)
1. Criar tabela `vendas_produtos` com as colunas: `id`, `material_id`, `nome_material`, `quantidade_vendida`, `valor_unitario_venda`, `custo_unitario`, `lucro_total`, `cliente_nome`, `data_venda`.
2. Configurar RLS (Row Level Security) para acesso seguro.

### Fase 2: Interface da Planilha de Vendas (UI)
1. Adicionar um botão no header do "Estoque" chamado "💰 Registrar Venda".
2. (Opcional) Criar uma tabela (View) chamada `table-vendas` para visualizar o histórico de vendas de forma tabular (A "Planilha").
3. Criar o `modal-venda`:
   - Select de Produto (puxando da `materiais`).
   - Campo de Quantidade (com validação do estoque atual).
   - Campo de Valor de Venda (puxando o padrão do estoque, mas permitindo edição).
   - Campo de Cliente/Observação.
   - Resumo Automático: Custo, Faturamento e Lucro da Venda.

### Fase 3: Lógica de Negócio (JS)
1. No envio do formulário, disparar transação tripla:
   - Registrar na tabela `vendas_produtos`.
   - Dar UPDATE na tabela `materiais` (Estoque = Estoque - Quantidade).
   - Dar INSERT na tabela `fluxo_caixa` (Valor = Faturamento Total).
2. Atualizar o cache de memória da interface para refletir o novo saldo do caixa e do estoque em tempo real.

### Fase 4: Márcia Ribeiro (IA)
1. Garantir que a Márcia também leia o resumo das vendas na edge function. (Opcional, já que as entradas vão cair no Fluxo de Caixa automaticamente).
