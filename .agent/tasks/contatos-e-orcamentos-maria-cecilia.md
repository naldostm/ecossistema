# Plano de Implementação: Acesso a Contatos, Orçamentos e Notificações de Respostas (Maria Cecília)

## 🎯 Objetivo
Resolver três deficiências críticas na atuação da Maria Cecília como secretária executiva e assistente de atendimento:
1. **Acesso Total à Agenda de Clientes do CRM:** Maria Cecília deve ter acesso à lista completa de contatos salvos no CRM e disparar mensagens solicitadas pelo Arnaldo sem pedir o número.
2. **Acesso Aprofundado aos Orçamentos/Propostas:** Ter acesso aos orçamentos dos clientes com escopo, itens detalhados (`itens_json`), valores, materiais e condições, para entender o assunto com precisão ao falar com o Arnaldo ou com o cliente.
3. **Notificações em Tempo Real para o Arnaldo:** Avisar o Arnaldo no WhatsApp (`+1 825 336 9239`) imediatamente toda vez que um cliente responder a um pedido ou enviar mensagem.

## 🛠️ Arquitetura e Alterações
- **Arquivo Central:** `supabase/functions/assistant-router/index.ts`
- **Tabelas Envolvidas:** `tarefas_arnaldo`, `propostas`, `clientes`, `agent_memory`.

### Componente 1: Agenda de Contatos no Modo Gestor
- Consulta consolidada de contatos em `tarefas_arnaldo`, `clientes` e `agent_memory`.
- Injeção da seção `📱 AGENDA DE CONTATOS & CLIENTES DO CRM` no prompt executivo.
- Atualização da regra de resolução de contatos para orientar a Maria Cecília a usar os contatos da agenda diretamente.
- Expansão de `resolveClientContact` para buscar em `propostas`, `tarefas_arnaldo` e variações de nomes.

### Componente 2: Orçamentos Detalhados
- Enriquecer `propostasGestorTexto` com resumo de itens (`itens_json`), valores de materiais/mão de obra e telefone do cliente.
- Mecanismo de busca dinâmica de propostas quando o Arnaldo cita nomes ou termos de serviços.
- No atendimento a clientes (`!isArnaldoAdmin`), buscar orçamentos pelo telefone ou nome e injetar os itens detalhados no prompt.

### Componente 3: Notificação Proativa ao Gestor Arnaldo
- Após o envio da resposta ao cliente via UazAPI, verificar `!isArnaldoAdmin && !isSpamRobo`.
- Disparar mensagem de alerta formatada para o WhatsApp do Arnaldo (`18253369239`).
- Registrar o alerta em `agent_memory` para manter histórico unificado.

## 🚀 Passos de Validação
1. Validar sintaxe TypeScript/Deno de `index.ts`.
2. Testar parsing e build localmente.
3. Realizar deploy para Supabase Edge Functions (`supabase functions deploy assistant-router --no-verify-jwt`).
4. Testar funcionamento de busca de contatos e propostas com script de teste.
