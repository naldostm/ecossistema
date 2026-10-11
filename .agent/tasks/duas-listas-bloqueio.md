# Plano de Implementação: Separação em Duas Listas de Bloqueio da IA (Permanente vs Temporária)

## 🎯 Objetivo
Separar de forma clara, visual e lógica no CRM e no Supabase:
1. **Bloqueio Permanente (Amigos, Colegas, Família e Prestadores):** Números protegidos que a Maria Cecília **NUNCA** atende comercialmente e que **jamais expiram** ou são removidos acidentalmente.
2. **Pausa Temporária de 45 Minutos (Clientes em Atendimento Humano):** Silêncio temporário da Maria Cecília enquanto o Arnaldo está em negociação manual com um cliente, com retorno automático após 45 minutos ou reativação imediata pelo CRM.

---

## 🛠️ Arquitetura e Estrutura de Dados

### 1. Estados em `agent_memory`
- **Bloqueio Permanente:** `content = 'AMIGO_PERMANENTE'` (compatível retroativamente com `BOT_IGNORAR`, `AMIGO_IGNORAR`, `LISTA_NEGRA`).
  - Imune a expiração por tempo.
  - Imune a mensagens manuais do Arnaldo (não vira `BOT_PAUSADO`).
- **Pausa Temporária:** `content = 'BOT_PAUSADO'`.
  - Validade estrita: **45 minutos** a partir de `created_at`.
  - Após 45 min, expira e o contato volta a ser atendido pela IA automaticamente.
- **Reativação Explícita:** `content = 'BOT_ATIVO'`.

### 2. Edge Function `assistant-router` (Deno / Supabase)
- **Passo 4 (Verificação de Status):**
  - Se encontrar `AMIGO_PERMANENTE` ou `BOT_IGNORAR` ou `LISTA_NEGRA`: silêncio absoluto e permanente.
  - Se encontrar `BOT_PAUSADO`: calcula `(Date.now() - pauseTime) < 45 * 60 * 1000`. Se menor, silêncio. Se maior ou igual, prossegue o atendimento normalmente.
- **Interceptador `fromMe` (Mensagem do Arnaldo):**
  - Se o contato for `AMIGO_PERMANENTE`, NÃO insere `BOT_PAUSADO`. Preserva o status permanente.
  - Se for cliente comum, insere `BOT_PAUSADO` com novo timestamp para dar 45 minutos de janela manual.

### 3. Frontend CRM (`index.html` e `app.js`)
- **Abas da Central de Mensagens:**
  - `Conversas ao Vivo`
  - `Pausas Temporárias (XX)` (Nova aba dedicada com contador e tabela de clientes em pausa, tempo restante e botão para reativar)
  - `Amigos & Colegas - Permanente (XX)` (Aba dedicada para amigos e contatos pessoais blindados)
  - `Campanhas & Prospecção`
  - `Agenda da Maria`
- **Header do Chat ao Vivo:**
  - Se Amigo Permanente: Badge `🛡️ Amigo / Colega (Permanente)` e botão `[ Remover de Amigos ]`.
  - Se Cliente em Pausa: Badge `⏸️ Pausa Temporária (XX min restantes)` e botão `[ ▶️ Reativar IA ]`.
  - Se Cliente Ativo: Badge `🟢 Maria Cecília Ativa` e botão `[ ⏸️ Pausar IA (45m) ]` + `[ 🛡️ Mover p/ Amigos ]`.

---

## 📋 Fases de Execução

### Fase 1: Atualização da Edge Function `assistant-router`
1. Adicionar suporte formal ao status `AMIGO_PERMANENTE`.
2. Blindar o interceptador de mensagens do Arnaldo (`fromMe`) para nunca sobrescrever `AMIGO_PERMANENTE` com `BOT_PAUSADO`.
3. Garantir o cálculo de 45 minutos no Passo 4 e Passo 8.
4. Fazer deploy da Edge Function atualizada no Supabase.

### Fase 2: Atualização do HTML (`frontend/index.html`)
1. Atualizar a barra de abas em `mensagens-nav-tabs` com as duas abas (`Pausas Temporárias` e `Amigos & Colegas - Permanente`).
2. Criar o subpane `pane-mensagens-pausas` com tabela de clientes pausados, relógio de tempo restante e botão de reativação imediata.
3. Reformular o subpane de Amigos para deixar claro que é permanente e não afeta clientes normais.

### Fase 3: Lógica no Frontend (`frontend/js/app.js`)
1. Implementar `window.loadPausasTemporariasTable()` para listar quem está com pausa ativa (< 45 min) e calcular minutos restantes.
2. Atualizar `switchMensagensTab` para gerenciar a nova aba `pausas`.
3. Ajustar `window.selectLiveConversation` e o header do chat para exibir os badges corretos e ações contextualizadas.
4. Funções:
   - `window.toggleCurrentChatPause()`: ativa/desativa pausa de 45m para clientes.
   - `window.toggleCurrentChatPermanent()`: move para lista de Amigos Permanentes ou remove dela.

### Fase 4: Testes e Validação
1. Testar marcação de amigo permanente e verificar que o bot nunca atende.
2. Testar pausa temporária de cliente e verificar contagem de minutos e expiração em 45 min.
3. Validar no navegador e realizar commit/push no repositório.
