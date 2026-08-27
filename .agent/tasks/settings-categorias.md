# Plano de Implementação: Gestão de Categorias e Subcategorias (Árvore)

## 🎯 Objetivo
Criar um painel de configurações (Engrenagem) acessível no Catálogo para permitir que o administrador gerencie de forma dinâmica as árvores de "Categoria Principal > Subcategorias" para **Serviços** e **Materiais**. Essa estrutura será refletida nos formulários de cadastro, funcionando no formato de funil (cascata).

## 🛠️ Arquitetura e Decisões
- **Interface:** Um ícone de engrenagem no cabeçalho do Catálogo.
- **Painel de Configuração:** Um modal elegante onde o usuário pode adicionar/remover Categorias e adicionar Subcategorias dentro delas (estilo sanfona/lista aninhada).
- **Armazenamento:** Salvar a árvore completa em formato JSON no banco de dados (tabela `sistema_configuracoes`) para garantir sincronia em tempo real para todos os usuários. Se a tabela não existir, eu a crio.
- **Formulários (UI):** 
  - Ao selecionar a "Categoria" no modal de Novo Serviço / Novo Material, o `select` de "Subcategoria" será preenchido dinamicamente apenas com as subcategorias filhas.

## 📋 Fases de Execução

### Fase 1: Estrutura do Banco de Dados (Supabase)
1. Verificar se existe uma tabela para configurações (ex: `sistema_configuracoes`). Se não, criá-la com as colunas `chave` (string) e `valor` (jsonb).
2. Definir a chave `catalogo_arvore` com a estrutura inicial (JSON vazio ou categorias padrão).

### Fase 2: Construção da UI (Engrenagem e Modal)
1. **HTML:** Adicionar o botão de Engrenagem (⚙️) no cabeçalho da aba "Catálogo".
2. **HTML/CSS:** Criar o novo modal `modal-config-categorias`.
3. **JS:** Criar a interface dinâmica dentro do modal que permita:
   - Adicionar uma "Nova Categoria Principal".
   - Adicionar "Nova Subcategoria" atrelada à categoria pai.
   - Deletar itens da árvore.
   - Botão para "Salvar Árvore".

### Fase 3: Lógica de Salvamento e Carregamento (JS)
1. **Fetch:** Criar a função `loadCatalogoConfig()` que busca a árvore do Supabase ao carregar o sistema.
2. **Save:** Criar a função `saveCatalogoConfig()` para gravar o JSON da árvore no banco.
3. Atualizar as variáveis globais (`window.catalogoTree`) para uso em todo o frontend.

### Fase 4: Integração com os Formulários de Cadastro (Cascata)
1. **HTML:** Alterar os formulários de `modal-servico` e `modal-material` para usarem os selects baseados na árvore, substituindo as opções fixas atuais.
2. **JS:** Adicionar o evento `onchange` no `<select>` de Categoria:
   - Limpar o `<select>` de Subcategoria.
   - Preencher com as opções correspondentes à Categoria selecionada.
3. Testes end-to-end do fluxo (Criar configuração -> Abrir modal de cadastro -> Validar cascata -> Salvar).

## 🛡️ Edge Cases Tratados
- **Fallback:** Se a configuração não carregar ou estiver vazia, o sistema exibirá uma lista "Geral" para não travar cadastros.
- **Retrocompatibilidade:** Se for editado um serviço antigo que possuía uma categoria deletada, o select exibirá a categoria velha de forma estática apenas para leitura, evitando perda de dados.
