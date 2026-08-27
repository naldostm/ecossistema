# Plano de Implementação: Frontend do Ecossistema

## Objetivo
Criar uma interface moderna, responsiva e premium (com estética Dark Mode e Glassmorphism) para o Dashboard do Ecossistema Arnaldo Trentin, cumprindo estritamente as diretrizes visuais do Master Prompt. 

Como o `Node.js/npx` não está instalado na máquina, desenvolveremos uma aplicação robusta em **Vanilla HTML, CSS e JavaScript**, garantindo que o sistema rode perfeitamente no navegador sem necessidade de setup de servidor complexo.

## User Review Required
> [!IMPORTANT]
> Aprovação do Design e Stack Tecnológica: O sistema será construído em HTML/CSS/JS puro devido à ausência do Node.js/npx ambiente, o que na verdade facilita o uso imediato clicando no arquivo `.html`. O visual será Premium, focado num Dashboard de alta performance usando cores sólidas e micro-animações.

## Proposed Changes

### Estrutura do Frontend
O código será alocado dentro de uma nova pasta `frontend` em sua área de trabalho.

#### [NEW] [index.html](file:///c:/Users/naldo/OneDrive/%C3%81rea%20de%20Trabalho/ecossistema%20arnaldo%20trentin/frontend/index.html)
- Estrutura semântica principal.
- Layout em Grid/Flexbox definindo os 4 quadrantes citados no seu Master Prompt.

#### [NEW] [styles.css](file:///c:/Users/naldo/OneDrive/%C3%81rea%20de%20Trabalho/ecossistema%20arnaldo%20trentin/frontend/css/styles.css)
- Variáveis CSS para o tema escuro (Dark Mode).
- Efeito Glassmorphism (vidro fosco) nos widgets ('Finanças' e 'Performance').
- Animações de Hover e transições suaves.

#### [NEW] [app.js](file:///c:/Users/naldo/OneDrive/%C3%81rea%20de%20Trabalho/ecossistema%20arnaldo%20trentin/frontend/js/app.js)
- Lógica de ativação e animação do Popup de Finanças (Canto Superior Esquerdo).
- Simulação de gráficos ou contadores dinâmicos no Widget de Performance (Canto Superior Direito).
- Implementação inicial da API HTML5 de Drag & Drop para a Agenda (Centro).
- Lógica de Piscar/Atualizar da barra inferior "Auto-Save Ativo".

## Arquitetura Front-End (Dashboard Atualizado)

A interface passou por uma revolução na **Fase 4**. Passamos do conceito de pequenos "modais" para uma experiência baseada em painéis completos de navegação fluida, culminando na construção da "Super Ficha Mestra de OS".

### Abas Principais (Implementadas)
1. **Listagem e Busca (CRM - Cecília)**: View de clientes.
2. **Ordens de Serviço (Kanban)**: Drag and drop dinâmico e botões disparadores da "Super Ficha".
3. **Estoque e Ferramentas**: Gerenciamento das tabelas operacionais.
4. **Obras (Projetos - Ian Gillan)**: Tabelas que mapeiam múltiplas OS para um centro de custos único.
5. **Livro Caixa (Finanças - Márcia Ribeiro)**: Entradas, saídas e categorização financeira.

### A "Super OS"
Uma grande view em formato "Super Modal" que salva em múltiplas tabelas simultâneas (Transação Virtual): Gravando no banco os serviços atrelados (via array), o operador, as datas (cronograma) e os materiais consumidos (baixa em estoque), tudo numa cartada só.

## Próximos Passos Priorizados (Fase 5 - PMOC e Júlia)
- Iniciar a infraestrutura de **Plano de Manutenção Operação e Controle (PMOC)**.
- Mapeamento do "Parque de Equipamentos" por cliente com rastreio de QR Codes/Serial.
- Arquitetura da **Júlia Sakamoto (IA Jurídica)**.

## Phase 7.5: Antigravity Audit Fixes (Orchestrator Management)
> [!TIP]
> Resolvendo falhas detectadas pelos scripts de auditoria do AG Kit para garantir performance e SEO premium.

- **SEO**: Unificar `<h1>`, adicionar tags Open Graph e Meta Robots.
- **UX**: Corrigir hierarquia de headings (h1->h2->h3), simplificar menu lateral (Hick's Law) e aumentar área de clique (Fitts' Law).
- **Performance**: Migrar animações de `top/left/margin` para `transform: translate/scale` para reduzir reflows de GPU.

## Verification Plan
1. Rodar `py .agent/scripts/checklist.py .` e verificar se UX e SEO passam para verde.
2. Validar visualmente as animações no Chrome.
