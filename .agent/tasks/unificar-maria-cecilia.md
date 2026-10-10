# Plano de Implementação: Unificação da Memória e Inteligência da Maria Cecília (CRM + WhatsApp)

## 🎯 Objetivo
Eliminar a sensação e a realidade técnica de "duas IAs separadas" para a Maria Cecília. Garantir que:
1. O número de WhatsApp do Arnaldo (`+1 825 336 9239` / `18253369239`) seja formalmente registrado como Gestor Mestre em todas as rotas e memória da IA.
2. A Maria Cecília no WhatsApp do Arnaldo consiga consultar o histórico real de conversas mantidas com qualquer cliente no CRM / WhatsApp (`agent_memory`), acabando com contradições como "não fui eu que mandei".
3. A resolução de telefones em comandos como "manda mensagem para a Fabiana" nunca mais direcione para o número do próprio Arnaldo (`18253369239`) e consulte `tarefas_arnaldo`, `ordens_servico` e `clientes`.
4. O Chat Flutuante azul da Secretária Virtual no CRM seja migrado do webhook legado do n8n para a Edge Function do Supabase (`assistant-router`), unificando o canal.

## 🛠️ Arquitetura e Fluxo de Dados
- **Tabela `agent_memory`:** Canal unificado de histórico. Mensagens do Arnaldo ficam em `phone = '18253369239'`, mensagens de clientes em seus respectivos telefones (ex: `5511991980474`).
- **Edge Function `assistant-router` (Deno/Supabase):**
  - Reconhecimento automático do Gestor Arnaldo (`isArnaldoAdmin`).
  - Função de busca profunda de contatos (`findClientPhoneByName`) consultando `tarefas_arnaldo`, `ordens_servico`, `propostas` e `clientes`.
  - Injeção dinâmica do histórico do cliente quando o Arnaldo perguntar sobre um cliente específico no WhatsApp.
  - Blindagem anti-autoenvio: `targetPhone !== '18253369239' && !targetPhone.endsWith('3369239')`.
- **Frontend CRM (`frontend/js/app.js`):**
  - Atualização do `callAIWithTimeout` e do chat flutuante da secretária para usar `supabase.functions.invoke('assistant-router')` com o perfil do Arnaldo.

## 📋 Fases de Execução

### Fase 1: Cadastro e Identificação Formal do Gestor Arnaldo
1. Registrar a configuração do gestor em `sistema_configuracoes` com chave `gestor_master` contendo nome, WhatsApp (`18253369239`), cargo e diretrizes.
2. Limpar o registro órfão em `agent_memory` gerado com o número distorcido `5518253369239`.

### Fase 2: Blindagem e Resolução Inteligente de Clientes em `assistant-router`
1. Criar helper `resolveClientContact(searchName)` que varre:
   - `clientes` (`whatsapp`, `nome_cliente`)
   - `tarefas_arnaldo` (`cliente_telefone`, `cliente_nome`)
   - `ordens_servico` (`clientes.whatsapp`, `clientes.nome_cliente`)
   - `propostas`
2. Adicionar trava definitiva contra o número do Arnaldo: se o número resolvido pertencer ao Arnaldo ou ao bot, rejeitar e pedir o número explicitamente em vez de enviar para si mesmo com prefixo 55.

### Fase 3: Leitura de Contexto Cruzado de Clientes para o Modo Gestor
1. Se a mensagem do Arnaldo no WhatsApp citar um cliente ou solicitar histórico ("como está a conversa da Fabiana?", "o que você mandou para ela?", "me passa o histórico da Fabiana"):
   - Identificar o nome do cliente na mensagem.
   - Puxar as últimas 6 a 10 mensagens de `agent_memory` para o telefone do cliente.
   - Injetar no prompt como `<HISTORICO_CLIENTE_CONSULTADO>` para a Maria Cecília saber com exatidão tudo o que foi conversado pelo CRM ou WhatsApp.

### Fase 4: Migração do Chat Flutuante no CRM (`app.js`)
1. Substituir a chamada para `N8N_MASTER_WEBHOOK` no chat flutuante da secretária por chamada direta para `assistant-router` via Supabase SDK.
2. Conectar a sessão do chat flutuante do Arnaldo à persona da Maria Cecília Executiva.

### Fase 5: Verificação e Validação
1. Validar script de teste chamando a função com perguntas sobre a Fabiana Arquiteta.
2. Confirmar que a Maria agora responde sabendo exatamente o que foi enviado para a Fabiana.
