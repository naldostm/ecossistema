# Plano de Implementação: Organização Eficiente de Categorias e Subcategorias com Abas Duplas

## 🎯 Objetivo
Resolver a divergência entre o menu pop-up de cadastro e as barras de categorias nas telas de **Serviços** e **Materiais (Estoque)**, implementando o sistema de **Abas Duplas Visuais**:
1. **Linha 1:** Categorias Principais (dinâmicas, geradas da `window.catalogoTree`).
2. **Linha 2:** Subcategorias em chips deslizantes da Categoria Ativa (dinâmicas e clicáveis).
3. **Sincronização Total com os Popups:** Os selects de Categoria Principal e Subcategoria nos formulários (`#modal-material`, `#modal-servico`) respeitam rigorosamente a mesma árvore e reagem instantaneamente.
4. **Persistência Confiável:** Gravação no Supabase (`sistema_configuracoes` com chave `catalogo_arvore`) e `localStorage`.

---

## 📐 Decisões do Usuário (Socratic Gate)
- **A1:** Abas Duplas Visuais: uma linha superior para Categorias Principais e uma linha de chips logo abaixo com as Subcategorias da categoria ativa.
- **A2:** O usuário revisa e edita os nomes das categorias e subcategorias diretamente na janela de configuração da Árvore de Categorias.

---

## 🛠️ Arquitetura Técnica

### 1. HTML (`frontend/index.html`)
- **Em Materiais (`#view-materiais`):**
  - Substituir os botões e selects estáticos pela estrutura de Abas Duplas:
    - `#materiais-cat-master`: container das categorias principais.
    - `#materiais-cat-sub`: container das subcategorias da categoria ativa.
- **Em Serviços (`#view-servicos`):**
  - Substituir as pílulas estáticas pela estrutura de Abas Duplas:
    - `#servicos-cat-master`: container das categorias principais.
    - `#servicos-cat-sub`: container das subcategorias da categoria ativa.
- **Nos Modais de Cadastro (`#modal-material` e `#modal-servico`):**
  - Selects dinâmicos de Categoria Principal e Subcategoria.

### 2. CSS (`frontend/css/styles.css`)
- Componentes das Abas Duplas:
  - `.cat-nav-container`: container com visual dark glassmorphism.
  - `.cat-master-tabs`: linha superior com abas elegantes de categorias principais.
  - `.cat-master-btn`: botão com estado `.active` (borda e cor de destaque âmbar/esmeralda).
  - `.cat-sub-chips`: linha inferior com chips deslizantes de subcategorias.
  - `.cat-sub-chip`: chip compacto com estado `.active`.
  - Conformidade com o **Purple Ban** (cores esmeralda, âmbar, ciano, ardósia).

### 3. JavaScript (`frontend/js/app.js`)
- `window.renderCategoryNavBars()`: renderiza as Abas Duplas em Materiais e Serviços.
- `window.selectMasterCategory(context, catName)`: seleciona categoria principal, atualiza os chips de subcategoria e filtra a listagem.
- `window.selectSubCategory(context, subcatName)`: seleciona subcategoria e filtra a listagem.
- `window.populateCategorySelects()`: popula selects dos popups e dispara atualização de subcategorias.
- `window.syncCategorySystem()`: sincroniza barras de navegação, popups e filtros.
- `window.saveConfigCategorias()`: persiste no Supabase e aciona `syncCategorySystem()`.

---

## 🚀 Fases de Execução
1. [x] Atualizar estrutura HTML das barras de filtro em `frontend/index.html`.
2. [x] Adicionar estilos para as Abas Duplas em `frontend/css/styles.css`.
3. [x] Implementar motor dinâmico de Abas Duplas e sincronização em `frontend/js/app.js`.
4. [x] Validar filtros em `renderMateriais` e `renderServicos`.
5. [x] Testes automatizados e verificação de build.

## ✅ Status Final
- **Concluído:** Abas Duplas Dinâmicas ativas em Materiais e Serviços.
- **Sincronização:** Selects de popups, modal de configuração da árvore e barras de filtro 100% integrados.
- **Testes & Build:** `npm run build` aprovado e teste em browser com `browser_subagent` validado com sucesso.
