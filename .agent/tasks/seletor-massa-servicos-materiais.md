# Plano de Implementação: Seletor Rápido em Massa de Serviços e Materiais (com Busca, Checkboxes e Quantidade)

## 🎯 Objetivo
Substituir o modelo atual de dropdowns gigantescos unitários por uma **Janela/Gaveta de Seleção Rápida moderna**, permitindo ao Arnaldo abrir o catálogo completo, filtrar por busca instantânea ou categorias, selecionar múltiplos serviços e materiais de uma só vez via checkboxes, ajustar as quantidades ali mesmo e adicionar tudo de forma consolidada à Proposta ou à Ordem de Serviço (Super OS).

---

## 📐 Decisões de Design e UX (Conforme Alinhamento com o Usuário)
1. **Locais Atendidos:**
   - **Propostas Comerciais** (`modal-proposta`): Injeção direta em `window.currentPropItems` com recálculo automático.
   - **Ordens de Serviço** (`modal-super-os`): Injeção no Cronograma de Serviços (`#cronograma-body`) e na Logística de Peças (`#materiais-body`).
2. **Interface Visual (Modal / Gaveta Seletora Rápida - `modal-seletor-itens`):**
   - **Barra de Pesquisa Instantânea:** Digitação rápida que filtra nome, categoria ou código sem latência.
   - **Abas de Tipo e Chips de Categorias:**
     - Toggle de Tipo: `[ Todos ]` `[ 🛠️ Serviços ]` `[ 📦 Materiais ]`.
     - Chips de Categorias deslizantes horizontalmente (ex: "Higienização", "Instalação", "Tubulações", "Gases", etc.).
   - **Linhas / Cards Selecionáveis:**
     - Checkbox touch-friendly (área de clique confortável para celular).
     - Nome do item em destaque + badge de categoria + valor unitário base.
     - **Controle de Quantidade na Própria Linha (Decisão A3 do Usuário):** Ao marcar o checkbox, ativa o input de quantidade com botões rápidos `[ - ]` `[ 1 ]` `[ + ]` para definir o volume na hora.
   - **Barra Inferior Fixa (Resumo & Confirmação):**
     - Exibe quantidade de itens marcados e valor total consolidado: *"X itens selecionados • R$ Y.YYY,00"*.
     - Botão primário *"Adicionar Itens Selecionados"*.
3. **Regras de Negócio e Casos de Borda:**
   - **Prevenção de Duplicatas:** Se o item já estiver na Proposta/OS, o seletor avisa com badge *"Já adicionado"* e permite apenas somar quantidade ou editar.
   - **Integração com Auto-Save Universal:** Imediatamente após a inserção dos itens em massa, dispara `crmAutoSave.triggerSave(...)` garantindo proteção contra saída acidental ou botão voltar do celular.
   - **Purple Ban:** Estética Dark Glassmorphism com paleta âmbar (#f59e0b), esmeralda (#10b981), ardósia (#0f172a / #1e293b) e azul técnico (#0284c7). Proibido qualquer tom roxo/violeta.

---

## 🛠️ Arquitetura Técnica

### 1. HTML (`frontend/index.html`)
- Inclusão do modal `#modal-seletor-itens`:
  - `modal-overlay` com backdrop blur.
  - Header com input de busca rápida (`#seletor-itens-busca`) e botão fechar.
  - Abas de alternância de tipo e container de chips de categorias (`#seletor-itens-categorias`).
  - Container rolável da lista de itens (`#seletor-itens-lista`).
  - Footer fixo com resumo e botão de confirmação (`#btn-confirmar-seletor-itens`).
- Adição dos botões de gatilho:
  - Em `modal-proposta`: botão de destaque *"⚡ Seleção em Massa do Catálogo"*.
  - Em `modal-super-os`: botões *"⚡ Catálogo de Serviços"* e *"⚡ Catálogo de Peças"*.

### 2. CSS (`frontend/css/styles.css`)
- Componentes do seletor:
  - `.crm-seletor-modal` com animação slide-up / fade-in.
  - `.seletor-search-box`, `.seletor-filter-chips`.
  - `.seletor-item-card` com estado `.selected` destacado em borda esmeralda/âmbar.
  - `.seletor-qty-control` com botões stepper para celular.
  - `.seletor-footer-summary`.

### 3. JavaScript (`frontend/js/app.js`)
- Módulo `window.crmItemSelector`:
  - `open(targetContext, options)`: onde `targetContext` é `'proposta'` ou `'super-os-servicos'` ou `'super-os-materiais'`.
  - `renderList(filterText, typeFilter, categoryFilter)`.
  - `toggleItem(itemId, itemType, isChecked, qty)`.
  - `confirmSelection()`: processa todos os itens selecionados e insere nas tabelas correspondentes.
  - Integração com `window.openModal` / `window.closeModal` (suporte automático a mobile back).

---

## 🚀 Fases de Execução: CONCLUÍDO COM SUCESSO (100%)
- [x] Criar estrutura HTML do modal `#modal-seletor-itens` e botões de gatilho em `frontend/index.html`.
- [x] Adicionar estilos visuais responsivos em `frontend/css/styles.css` (Dark Glassmorphism, Purple Ban).
- [x] Implementar a lógica do seletor no `frontend/js/app.js` (`window.crmItemSelector`).
- [x] Conectar a inserção de itens em massa nas Propostas e na Super OS com soma de duplicatas (Regra A1).
- [x] Validar com testes automatizados (`scratch/test_item_selector.cjs`) e compilação do Vite (`npm run build`).
