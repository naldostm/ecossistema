# Plano de Implementação: Auto-Save Universal de Popups e Interceptação do Botão Voltar (Mobile)

## 🎯 Objetivo
Evitar a perda de dados ao preencher formulários em popups/modais no celular ou desktop:
1. **Auto-Save Universal (`localStorage`):** Salva em segundo plano qualquer digitação/seleção em todos os 26 popups/modais do sistema.
2. **Confirmação ao Reabrir (Opção B):** Ao reabrir um popup com rascunho pendente, exibe banner moderno perguntando se o usuário deseja *"Continuar Rascunho"* ou *"Iniciar Novo"*.
3. **Interceptação do Botão Voltar do Celular (`History API`):** Ao fazer o gesto de voltar ou tocar no botão Voltar do celular/navegador com um popup aberto, o sistema fecha apenas o popup suavemente, mantendo o usuário na página do CRM sem descarregar a aplicação nem perder dados.
4. **Proteção de Saída Acidental (`beforeunload`):** Alerta do navegador caso tente fechar a aba/aplicativo com formulário aberto e preenchido.

## 🛠️ Arquitetura Técnica

### 1. Interceptador de Histórico Mobile (`popstate`)
- Modais usam `history.pushState({ crmModalId: id, timestamp: Date.now() }, '')` ao abrir em `window.openModal`.
- Pilha `window._modalHistoryStack` rastreia a ordem LIFO de abertura dos modais (inclusive modais aninhados).
- Contador `window._ignoringPopstateCount` para evitar que `closeModal` disparando `history.back()` feche acidentalmente modais pais.
- Listener global de `popstate`: detecta quando o usuário pressionou "Voltar" no celular e fecha o modal ativo sem sair da página.

### 2. Módulo `window.crmAutoSave`
- **Escaneamento Universal:** Varre todos os campos (`input`, `textarea`, `select`, `checkbox`, `radio`) do formulário dentro do modal.
- **Suporte Especial a Modais Complexos:**
  - `modal-proposta`: serializa e restaura `window.currentPropItems` (itens de materiais/serviços e recálculo da tabela via `window.renderPropItemsTable()`).
  - `modal-super-os`: serializa e restaura cronograma de serviços (`#cronograma-body`), materiais (`#materiais-body`) e custos extras (`#extras-body`).
- **Debounce:** Salva a cada 400ms após digitação ou alteração via event delegation global (`input`, `change`).
- **Proteção do Rascunho:** Impede que o rascunho seja sobrescrito enquanto o banner estiver aguardando decisão do usuário (`_pendingBanners`).
- **Limpeza no Sucesso:** Ao submeter com sucesso (`submit`), limpa o rascunho daquele modal.

### 3. Interface Visual do Rascunho (Opção B)
- Banner estilizado no topo do modal (`.crm-draft-banner`):
  - Ícone de histórico + Data/hora do rascunho salvo.
  - Botão *"Continuar Rascunho"* (restaura todos os valores, dispara eventos e recalcula somas).
  - Botão *"Iniciar Novo"* (descarta rascunho do storage e limpa os campos).
- Paleta em conformidade com as regras (sem tons de roxo/violeta, usando estética escura / âmbar / glassmorphism).

## 🚀 Status da Execução: CONCLUÍDO COM SUCESSO (100%)
- [x] Adicionar estilização do banner `.crm-draft-banner` em `frontend/css/styles.css`.
- [x] Implementar `window.crmAutoSave` e a interceptação de `popstate` em `frontend/js/app.js`.
- [x] Integrar `modal-edit-colab`, `modal-maria-task-report` e `modal-nova-tarefa` ao ciclo `openModal`/`closeModal`.
- [x] Prevenir sobrescrita de rascunhos pendentes e isolar ID de edição vs novo cadastro.
- [x] Testes unitários automatizados cobrindo os 7 cenários em `scratch/test_autosave_logic.cjs` (100% de sucesso).
- [x] Build de produção do Vite validado com sucesso (483ms, 0 erros).
