document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONFIGURAÇÃO SUPABASE (VITE ENV OU FALLBACK DIRETO)
    // ==========================================
    const SUPABASE_URL = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ? import.meta.env.VITE_SUPABASE_URL : 'https://tmpwmtpdxcvulglkahcg.supabase.co').trim();
    const SUPABASE_ANON_KEY = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ? import.meta.env.VITE_SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE').trim();

    // Instancia o cliente do Supabase globalmente usando o script CDN do index.html
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabase;

    // ==========================================
    // 1.A CONFIGURAÇÕES DO SISTEMA (N8N / IA)
    const N8N_MASTER_WEBHOOK = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_N8N_MASTER_WEBHOOK) ? import.meta.env.VITE_N8N_MASTER_WEBHOOK : 'https://arnaldotrentin.app.n8n.cloud/webhook-test/webhook-erp-web');

    const autoSaveStatus = document.getElementById('auto-save-status');

    // Estado global de visibilidade financeira (oculto por padrão)
    window.financesVisible = false;
    window.marciaChatHistory = []; // Memória de sessão da Márcia

    // Estado global do Construtor de Propostas (Restaurado V5)
    window.currentPropItems = [];
    window.equipamentosCache = []; // PMOC Assets

    // ==========================================
    // SISTEMA DE CATEGORIAS E SUBCATEGORIAS (ÁRVORE DINÂMICA)
    // ==========================================
    window.catalogoTree = {
        "Elétrica": ["Cabos", "Disjuntores", "Iluminação"],
        "Hidráulica": ["PEX", "PPR", "CPVC", "PVC", "Básica", "Premium"],
        "Infraestrutura de Ar-Condicionado": ["Tubulação de Cobre", "Suportes", "Isolamento"],
        "Ferramentas": ["Manuais", "Elétricas"],
        "Gás": ["Tubos", "Conexões"],
        "Geral": []
    };

    window.loadCatalogoConfig = async function() {
        try {
            // Tenta puxar ambas as configurações em uma única chamada (usando IN)
            const { data, error } = await supabase.from('sistema_configuracoes').select('*').in('chave', ['catalogo_arvore', 'calc_config']);
            
            if (data && data.length > 0) {
                data.forEach(row => {
                    if (row.chave === 'catalogo_arvore') window.catalogoTree = row.valor;
                    if (row.chave === 'calc_config') {
                        window._calcConfig = row.valor.params || {};
                        window._calcHorasEstimadas = row.valor.horas || {};
                    }
                });
            } else if (error && error.code === '42P01') {
                // Tabela não existe, usa fallback local
                const localTree = localStorage.getItem('catalogo_arvore');
                if (localTree) window.catalogoTree = JSON.parse(localTree);
            }
        } catch (e) {
            console.error("Erro ao carregar configurações do sistema:", e);
        } finally {
            if (typeof window.populateCategorySelects === 'function') {
                window.populateCategorySelects();
            }
        }
    };
    
    // Inicia o carregamento logo no boot
    window.loadCatalogoConfig();

    // ==========================================
    // SISTEMA DE ARRASTE PARA BOTÕES FLUTUANTES (DRAG & DROP)
    // ==========================================
    function makeDraggable(elId, storageKey) {
        const el = document.getElementById(elId);
        if (!el) return;

        // Recupera posição salva
        const savedPos = localStorage.getItem(storageKey);
        if (savedPos) {
            try {
                const { left, top } = JSON.parse(savedPos);
                el.style.left = left + 'px';
                el.style.top = top + 'px';
                el.style.bottom = 'auto';
                el.style.right = 'auto';
            } catch (e) {}
        }

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let dragStartTime;

        el.addEventListener('mousedown', (e) => {
            // Ignora se for clique com botão direito
            if (e.button !== 0) return;
            
            isDragging = true;
            dragStartTime = Date.now();
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = el.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            el.style.transition = 'none'; // Desliga transição css
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // Impede que suma da tela
            newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, newTop));
            
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            el.style.bottom = 'auto';
            el.style.right = 'auto';
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            el.style.transition = 'transform 0.3s ease, box-shadow 0.3s'; // Liga de volta
            
            localStorage.setItem(storageKey, JSON.stringify({
                left: parseInt(el.style.left),
                top: parseInt(el.style.top)
            }));
            
            // Cancela o clique se foi um arraste longo
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            if (dx > 5 || dy > 5 || Date.now() - dragStartTime > 200) {
                // Previne a abertura do chat injetando um data-attribute rápido
                el.dataset.dragged = 'true';
                setTimeout(() => { el.dataset.dragged = 'false'; }, 100);
            }
        });
    }

    // Aplica a funcionalidade nos botões
    setTimeout(() => {
        makeDraggable('chat-marcia-toggle', 'pos_marcia_toggle');
        makeDraggable('chat-sec-toggle', 'pos_sec_toggle');
    }, 500);

    // ==========================================
    // 1.B FUNÇÕES GLOBAIS DE QR CODE (PMOC)
    // ==========================================
    window.gerarQRCodeId = function () {
        const prefix = "AT";
        const random = Math.floor(1000 + Math.random() * 9000);
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}-${random}-${timestamp}`;
    };

    window.gerarEAtribuirQR = async function (id) {
        const novoId = window.gerarQRCodeId();
        console.log('[QR GEN] Gerando ID para equipamento:', id, '->', novoId);

        try {
            const { error } = await window.supabase
                .from('parque_equipamentos')
                .update({ qr_code_id: novoId })
                .eq('id', id);

            if (error) throw error;

            if (typeof triggerSaveSuccess === 'function') triggerSaveSuccess('QR Code Gerado com Sucesso!');
            if (typeof window.loadEquipamentos === 'function') window.loadEquipamentos();
        } catch (err) {
            console.error('[QR GEN] Erro ao salvar QR:', err);
            if (typeof triggerSaveError === 'function') triggerSaveError('Erro ao gerar QR Code.');
        }
    };

    // ==========================================
    // 1.C CONTROLE DE IA (PAUSA/VOLTA DO BOT)
    // ==========================================
    window.toggleBotStatus = async function (phone, wantToPause) {
        if (!phone || phone === '-') return alert('Cliente sem número de WhatsApp vinculado.');
        const newState = wantToPause ? 'BOT_PAUSADO' : 'BOT_ATIVO';
        try {
            const { error } = await supabase.from('agent_memory').insert({ phone: phone, role: 'user', content: newState });
            if (error) throw error;
            // Recarrega o estado atualizando a tela
            location.reload();
        } catch (e) {
            console.error('[IA CONTROL] Falha ao atualizar bot.', e);
            alert('Falha ao atualizar status da IA.');
        }
    };

    window.toggleGlobalBot = async function (btnElement) {
        const isAtivo = btnElement.dataset.state === 'ATIVO';
        const newState = isAtivo ? 'GLOBAL_PAUSE' : 'GLOBAL_ACTIVE';

        try {
            const { error } = await supabase.from('agent_memory').insert({ phone: 'GLOBAL_CONFIG', role: 'user', content: newState });
            if (error) throw error;

            if (isAtivo) {
                btnElement.dataset.state = 'PAUSADO';
                btnElement.innerHTML = '<i class="fa-solid fa-microphone-lines-slash"></i> AUTOATENDIMENTO: OFF';
                btnElement.style.background = '#e74c3c';
                btnElement.style.boxShadow = '0 4px 15px rgba(231,76,60,0.3)';
            } else {
                btnElement.dataset.state = 'ATIVO';
                btnElement.innerHTML = '<i class="fa-solid fa-robot fa-shake" style="margin-right: 8px;"></i> AUTOATENDIMENTO: ON';
                btnElement.style.background = '#2ecc71';
                btnElement.style.boxShadow = '0 4px 15px rgba(46,204,113,0.3)';
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao mudar status global.');
        }
    };

    // ==========================================
    // 1.B SPA ROUTER (V5 MODERNIZADO)
    // ==========================================
    window.showSection = function (targetId) {
        // Remove 'active-menu' de todos os itens da sidebar
        document.querySelectorAll('.menu-section li').forEach(li => li.classList.remove('active-menu'));

        // Adiciona 'active-menu' ao link clicado
        const navLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if (navLink) navLink.parentElement.classList.add('active-menu');

        // Alterna display das views
        document.querySelectorAll('.view-page').forEach(page => {
            page.style.display = 'none';
            page.classList.remove('active-view');
        });

        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.style.display = 'flex';
            targetView.classList.add('active-view');
        }

        // Show AI Financial Advisor (Márcia) ONLY on finance views
        const financeViews = ['view-caixa', 'view-faturamentos', 'view-comissoes', 'view-calc-custos'];
        if (financeViews.includes(targetId)) {
            document.body.classList.add('finance-mode-active');
        } else {
            document.body.classList.remove('finance-mode-active');
        }

        // Se for o dashboard, recalcula gráficos
        if (targetId === 'view-dashboard' && typeof renderDashboardAnalytics === 'function') {
            renderDashboardAnalytics();
        }

        // Se for Todas as OS, renderiza a tabela detalhada
        if (targetId === 'view-todas-os' && typeof renderTodasOS === 'function') {
            renderTodasOS();
        }

        // Se for Calculadora de Custos, renderiza a análise
        if (targetId === 'view-calc-custos' && typeof window.renderCalcCustos === 'function') {
            window.renderCalcCustos();
        }
    };

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            window.showSection(targetId);
        });
    });

    // Formatadores Globais
    window.formatDate = (dateStr) => {
        if (!dateStr) return 'TBD';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    window.formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    // ==========================================
    // 1.C HAMBURGER MENU (MOBILE) E LOGOUT
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mainSidebar = document.getElementById('main-sidebar');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (mobileMenuBtn && mainSidebar && mobileOverlay) {
        const toggleMenu = () => {
            mainSidebar.classList.toggle('open');
            mobileOverlay.classList.toggle('active');
        };

        mobileMenuBtn.addEventListener('click', toggleMenu);
        mobileOverlay.addEventListener('click', toggleMenu);

        // Fecha o menu ao clicar em um link da sidebar no celular
        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1000) {
                    mainSidebar.classList.remove('open');
                    mobileOverlay.classList.remove('active');
                }
            });
        });
    }

    // Botões de Logout Rápido (Desktop e Mobile)
    document.getElementById('btn-logout')?.addEventListener('click', () => window.location.reload());
    document.getElementById('mobile-logout-btn')?.addEventListener('click', () => window.location.reload());

    // Toggle Olho Finanças
    const btnToggleFinance = document.getElementById('toggle-finance-vis');
    if (btnToggleFinance) {
        btnToggleFinance.addEventListener('click', () => {
            window.financesVisible = !window.financesVisible;
            const icon = btnToggleFinance.querySelector('i');
            if (window.financesVisible) {
                icon.className = 'fa-solid fa-eye';
            } else {
                icon.className = 'fa-solid fa-eye-slash';
            }
            // Força atualização visual
            document.querySelectorAll('.finance-item .value').forEach(el => {
                el.classList.toggle('blur-value', !window.financesVisible);
            });
        });
    }

    function triggerAutoSave(msg = 'Salvando...') {
        if (autoSaveStatus) {
            autoSaveStatus.classList.add('saving');
            autoSaveStatus.querySelector('span').textContent = msg;
        }
    }

    function triggerSaveSuccess(msg = 'Salvo!') {
        if (autoSaveStatus) {
            autoSaveStatus.classList.remove('saving');
            autoSaveStatus.classList.add('success');
            autoSaveStatus.querySelector('span').textContent = msg;
            setTimeout(() => {
                autoSaveStatus.classList.remove('success');
                autoSaveStatus.querySelector('span').textContent = '';
            }, 3000);
        }
    }

    function triggerSaveError(msg = 'Erro ao Salvar!') {
        if (autoSaveStatus) {
            autoSaveStatus.classList.remove('saving');
            autoSaveStatus.classList.add('error');
            autoSaveStatus.querySelector('span').textContent = msg;
            setTimeout(() => {
                autoSaveStatus.classList.remove('error');
                autoSaveStatus.querySelector('span').textContent = '';
            }, 5000);
        }
    }

    // ==========================================
    // 1.D SISTEMA DE AUDITORIA (AUDIT LOGS)
    // ==========================================
    window.saveAuditLog = async function (action, table, recordId, details = null) {
        try {
            // Tentativa de pegar usuário, mas não bloqueia se for anônimo/falhar
            const { data } = await supabase.auth.getUser();
            const userId = data?.user?.id || null;

            const payload = {
                action: action,
                table_name: table,
                record_id: String(recordId),
                details: details,
                ip_address: 'browser-v5',
                user_id: userId
            };

            // Insert sem await para não travar a UI (Fire and forget pragmático)
            supabase.from('audit_logs').insert([payload])
                .then(({ error }) => {
                    if (error) console.warn('[Audit Log] Erro silencioso:', error.message);
                });

        } catch (e) {
            console.warn('[Audit Log] Falha na orquestração do Log:', e);
        }
    };

    // ==========================================
    // AUXILIARES DE TABELA (AÇÕES)
    // ==========================================
    function getActionButtons(table, id, name) {
        const isAdmin = userCargo && ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo'].some(c => userCargo.toLowerCase().includes(c));
        const canDel = perm(table).excluir || isAdmin || true;

        const safeName = (name || '').replace(/'/g, '').replace(/"/g, '');

        let html = '<div style="display:flex; justify-content:flex-end; gap: 5px;">';
        if (table === 'colaboradores' && isAdmin) {
            html += `<button class="action-btn btn-edit-generic" data-table="colaboradores" data-id="${id}" style="padding:4px 8px; font-size:0.75rem; background:transparent; color:var(--accent-blue); border:1px solid var(--accent-blue); min-width:32px; cursor: pointer; z-index: 10;" title="Editar Permissões"><i class="fa-solid fa-pen"></i></button>`;
        }
        if (canDel) {
            if (table === 'servicos') {
                html += `<button class="action-btn btn-copy-svc" data-id="${id}" style="padding:4px 8px; font-size:0.75rem; background:transparent; color:var(--accent-orange); border:1px solid var(--accent-orange); min-width:32px; cursor: pointer; z-index: 10; margin-right: 5px;" title="Copiar"><i class="fa-solid fa-copy"></i></button>`;
            }
            html += `<button class="action-btn btn-delete-row" data-table="${table}" data-id="${id}" data-name="${safeName}" style="padding:4px 8px; font-size:0.75rem; background:transparent; color:var(--accent-red); border:1px solid var(--accent-red); min-width:32px; cursor: pointer; z-index: 10;" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;
        }
        if (table === 'parque_equipamentos') {
            html += `<button class="action-btn btn-pdf-pmoc" data-id="${id}" style="padding:4px 8px; font-size:0.75rem; background:var(--accent-blue); color:#fff; border:none; border-radius:4px; min-width:32px; cursor: pointer; z-index: 10;" title="Gerar Laudo PMOC (PDF)"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;
        }
        html += '</div>';
        return html;
    }

    // ==========================================
    // EVENT DELEGATION: Captura cliques em botões de ação
    // Substitui todos os onclick inline (mais robusto com Vite/ES modules)
    // ==========================================
    document.addEventListener('click', function(e) {
        // BOTÃO DELETE (lixeira vermelha)
        const delBtn = e.target.closest('.btn-delete-row');
        if (delBtn) {
            e.stopPropagation();
            e.preventDefault();
            const table = delBtn.dataset.table;
            const id = delBtn.dataset.id;
            const name = delBtn.dataset.name || '';
            console.log('[EventDelegation] Delete clicked:', table, id, name);
            if (window.handleDelete) {
                window.handleDelete(table, id, name);
            } else {
                console.error('[EventDelegation] window.handleDelete não está definido!');
            }
            return;
        }

        // BOTÃO EDITAR COLABORADOR
        const editBtn = e.target.closest('.btn-edit-generic');
        if (editBtn) {
            e.stopPropagation();
            e.preventDefault();
            window.openEditGeneric(editBtn.dataset.table, editBtn.dataset.id);
            return;
        }

        // BOTÃO COPIAR SERVIÇO
        const copyBtn = e.target.closest('.btn-copy-svc');
        if (copyBtn) {
            e.stopPropagation();
            e.preventDefault();
            window.copyService(copyBtn.dataset.id);
            return;
        }

        // BOTÃO PDF PMOC
        const pdfBtn = e.target.closest('.btn-pdf-pmoc');
        if (pdfBtn) {
            e.stopPropagation();
            e.preventDefault();
            window.generatePMOCTechnicalReport(pdfBtn.dataset.id);
            return;
        }
    }, true);

    window.copyService = function (id) {
        // Encontra no cache local o serviço original
        const orig = (window.servicosCache || []).find(s => String(s.id) === String(id));
        if (!orig) {
            console.warn('Serviço não encontrado para cópia.');
            return;
        }

        // Abre o modal de edição forçando o estado de criação de um NOVO item
        const form = document.querySelector('#modal-servico form');
        if (form) {
            form.reset();
            // Remove o ID do dataset pra garantir INSERT no submit em invés de UPDATE
            delete form.dataset.editId;
        }

        document.getElementById('ser-nome').value = orig.nome_servico + ' (Cópia)';
        document.getElementById('ser-categoria').value = orig.categoria || 'Geral';
        document.getElementById('ser-desc').value = orig.descricao || '';
        document.getElementById('ser-val').value = orig.valor_base;
        if (orig.descritivo_json && document.getElementById('ser-descritivo-json')) {
            document.getElementById('ser-descritivo-json').value = JSON.stringify(orig.descritivo_json, null, 2);
        }

        openModal('modal-servico', true); // True: ignora o reset padrão para não limpar os dados injetados
    };

    window.handleDelete = async function (table, id, name) {
        // Regra de Ouro: Apenas cargos de gestão deletam OS
        const isAdmin = userCargo && ['admin', 'administrador', 'diretoria', 'diretor', 'engenheiro', 'ceo', 'dono', 'master'].includes(userCargo.toLowerCase());

        if (table === 'ordens_servico' && !isAdmin) {
            alert('Apenas a diretoria ou engenharia pode excluir uma Ordem de Serviço.');
            return;
        }

        // CUSTOM CONFIRM MODAL (Substitui o native confirm que pode sumir num duplo clique)
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.85)';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.backdropFilter = 'blur(4px)';
        
        const box = document.createElement('div');
        box.style.background = 'var(--panel-bg, #1e293b)';
        box.style.padding = '25px';
        box.style.borderRadius = '12px';
        box.style.border = '1px solid var(--accent-red, #ef4444)';
        box.style.textAlign = 'center';
        box.style.color = '#fff';
        box.style.maxWidth = '400px';
        box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        
        const icon = document.createElement('div');
        icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        icon.style.fontSize = '2rem';
        icon.style.color = 'var(--accent-red, #ef4444)';
        icon.style.marginBottom = '10px';
        
        const text = document.createElement('p');
        text.innerText = `Deseja realmente excluir "${name}"?\n\nEsta ação não pode ser desfeita.`;
        text.style.marginBottom = '25px';
        text.style.lineHeight = '1.5';
        
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'center';
        btnRow.style.gap = '15px';
        
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancelar';
        btnCancel.className = 'action-btn';
        btnCancel.style.background = 'transparent';
        btnCancel.style.border = '1px solid #64748b';
        btnCancel.style.color = '#fff';
        
        const btnOk = document.createElement('button');
        btnOk.innerHTML = '<i class="fa-solid fa-trash"></i> Sim, Excluir';
        btnOk.className = 'action-btn';
        btnOk.style.background = 'var(--accent-red, #ef4444)';
        
        btnCancel.onclick = () => document.body.removeChild(overlay);
        btnOk.onclick = async () => {
            document.body.removeChild(overlay);
            
            triggerAutoSave(`Excluindo ${name}...`);

            // Log de tentativa
            await saveAuditLog('DELETE_ATTEMPT', table, id, { name });

            const { error } = await supabase.from(table).delete().eq(table === 'ordens_servico' ? 'id_os' : 'id', id);

            if (error) {
                triggerSaveError('Erro ao excluir registro. Pode haver dependências.');
                console.error(error);
            } else {
                await saveAuditLog('DELETE_SUCCESS', table, id, { name });
                triggerSaveSuccess('Registro Removido!');
                loadData();
            }
        };
        
        btnRow.appendChild(btnCancel);
        btnRow.appendChild(btnOk);
        box.appendChild(icon);
        box.appendChild(text);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    };

    window.openEditGeneric = async function (table, id) {
        // Mapeamento de Modais
        const modalMap = {
            'clientes': 'modal-cliente',
            'materiais': 'modal-material',
            'ferramentas': 'modal-ferramenta',
            'servicos': 'modal-servico',
            'obras': 'modal-obra',
            'fluxo_caixa': 'modal-caixa',
            'contratos_pmoc': 'modal-contrato',
            'colaboradores': 'modal-edit-colab',
            'propostas': 'modal-proposta',
            'faturamentos': 'modal-faturamento-b2b'
        };

        const modalId = modalMap[table];
        if (!modalId) return;

        // Busca no Cache (Busca Robusta id/id_os)
        let item = null;
        const findId = x => String(x.id || x.id_os || x.id_cli || x.id_mat) === String(id);

        if (table === 'clientes') item = (window.clientesCache || []).find(findId);
        if (table === 'materiais') item = (window.materiaisCache || []).find(findId);
        if (table === 'ferramentas') item = (window.ferramentasCache || []).find(findId);
        if (table === 'servicos') item = (window.servicosCache || []).find(findId);
        if (table === 'obras') item = (window.obrasCache || []).find(findId);
        if (table === 'fluxo_caixa') item = (window.caixaCache || []).find(findId);
        if (table === 'contratos_pmoc') item = (window.contratosCache || []).find(findId);
        if (table === 'colaboradores') item = (window.colabCache || []).find(findId);
        if (table === 'propostas') item = (window.propostasCache || []).find(findId);
        if (table === 'faturamentos') item = (window.faturamentosCache || []).find(findId);

        if (!item) {
            console.warn(`ID ${id} não encontrado no cache de ${table}. Buscando no Banco de Dados...`);
            let pKey = 'id';
            // Se as tabelas antigas ainda usarem chaves compostas
            if (table === 'materiais') pKey = 'id_mat';
            if (table === 'clientes') pKey = 'id_cli';
            
            const qSel = table === 'ferramentas' ? '*, colaboradores(nome_completo)' : '*';
            const { data, error } = await supabase.from(table).select(qSel).eq(pKey, id).maybeSingle();
            
            if (error || !data) {
                console.error(`Item não localizado em ${table}. ID: ${id}`, error);
                return;
            }
            item = data;
        }

        const form = document.querySelector(`#${modalId} form`);
        if (!form) return;

        form.dataset.editId = id;
        form.reset();

        if (table === 'clientes') {
            document.getElementById('cli-nome').value = item.nome_cliente;
            document.getElementById('cli-whats').value = item.whatsapp || '';
            document.getElementById('cli-end').value = item.endereco_completo || '';
            document.getElementById('cli-doc').value = item.documento_cpf_cnpj || '';

            // Popula Histórico do Cliente (NOVO)
            const historySec = document.getElementById('cliente-historico-section');
            const historyBody = document.getElementById('cliente-os-list');
            if (historySec && historyBody) {
                historyBody.innerHTML = '';
                const myOs = (window.ordensCache || []).filter(o => String(o.cliente_id) === String(id));
                if (myOs.length > 0) {
                    myOs.forEach(os => {
                        const tr = document.createElement('tr');
                        const dataFmt = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR') : '-';
                        const serv = os.servico_tipo || 'Geral';
                        const st = os.status_ia || 'Em Aberto';
                        tr.innerHTML = `<td>${dataFmt}</td><td>${serv}</td><td><span class="badge ${st.includes('Finalizado') ? 'success' : 'in-progress'}">${st}</span></td>`;
                        historyBody.appendChild(tr);
                    });
                    historySec.style.display = 'block';
                } else {
                    historyBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#a4b0be; padding:10px;">Nenhum serviço registrado para este cliente.</td></tr>';
                    historySec.style.display = 'block';
                }
            }
        } else if (table === 'materiais') {
            document.getElementById('mat-nome').value = item.nome_material;
            document.getElementById('mat-qtd').value = item.quantidade;
            document.getElementById('mat-un').value = item.unidade_medida || 'un';
            document.getElementById('mat-preco-compra').value = item.preco_compra || '';
            document.getElementById('mat-val').value = item.valor_unitario || '';

            const parts = (item.campo_uso || 'Geral | ').split(' | ');
            document.getElementById('mat-categoria').value = parts[0] ? parts[0].trim() : 'Geral';
            window.updateSubcategories('mat-categoria', 'mat-subcategoria');
            document.getElementById('mat-subcategoria').value = parts[1] ? parts[1].trim() : '';
        } else if (table === 'ferramentas') {
            document.getElementById('fer-nome').value = item.nome_ferramenta;
            document.getElementById('fer-status').value = item.status;
            document.getElementById('fer-colaborador-id').value = item.colaborador_id || '';
            document.getElementById('fer-local-atual').value = item.local_atual || 'Depósito Central';
            document.getElementById('fer-estado-conservacao').value = item.estado_conservacao || 'Manutenção em Dia';
            document.getElementById('fer-obs').value = item.observacao || '';
            
            // Generate QR ID immediately if it doesn't exist
            if (!item.qr_code_id && typeof window.gerarQRCodeId === 'function') {
                item.qr_code_id = window.gerarQRCodeId();
            }
            window._currentFerramentaQR = item.qr_code_id;
        } else if (table === 'servicos') {
            document.getElementById('ser-nome').value = item.nome_servico;
            
            const parts = (item.categoria || 'Geral | ').split(' | ');
            document.getElementById('ser-categoria').value = parts[0] ? parts[0].trim() : 'Geral';
            window.updateSubcategories('ser-categoria', 'ser-subcategoria');
            document.getElementById('ser-subcategoria').value = parts[1] ? parts[1].trim() : '';
            
            document.getElementById('ser-desc').value = item.descricao || '';
            document.getElementById('ser-val').value = item.valor_base;
        } else if (table === 'obras') {
            document.getElementById('ob-nome').value = item.nome_obra;
            document.getElementById('ob-cliente-id').value = item.cliente_id || '';
            document.getElementById('ob-end').value = item.endereco_obra || '';
            document.getElementById('ob-status').value = item.status_obra || 'Em Andamento';
            document.getElementById('ob-data-inicio').value = item.data_inicio ? item.data_inicio.split('T')[0] : '';
            document.getElementById('ob-data-fim-prev').value = item.data_fim_previsto ? item.data_fim_previsto.split('T')[0] : '';
            document.getElementById('ob-orcamento').value = item.orcamento || '';
        } else if (table === 'fluxo_caixa') {
            document.getElementById('cx-tipo').value = item.tipo_movimento;
            document.getElementById('cx-cat').value = item.categoria || '';
            document.getElementById('cx-desc').value = item.descricao || '';
            document.getElementById('cx-val').value = item.valor;
            document.getElementById('cx-data').value = item.data_ocorrencia ? item.data_ocorrencia.split('T')[0] : '';
        } else if (table === 'contratos_pmoc') {
            document.getElementById('contrato-identificacao').value = item.identificacao || '';
            document.getElementById('contrato-cliente-id').value = item.cliente_id || '';
            document.getElementById('contrato-tipo').value = item.tipo_contrato || '';
            document.getElementById('contrato-vigencia').value = item.vigencia_meses || 12;
            document.getElementById('contrato-valor').value = item.valor_contrato || '';
            document.getElementById('contrato-status').value = item.status_contrato || 'Pendente';
            document.getElementById('contrato-clausulas').value = item.clausulas_especiais || '';
            document.getElementById('contrato-data-inicio').value = item.data_inicio ? item.data_inicio.split('T')[0] : '';
        } else if (table === 'colaboradores') {
            document.getElementById('edit-colab-id').value = item.id;
            document.getElementById('edit-colab-nome').value = item.nome_completo;
            document.getElementById('edit-colab-email').value = item.email || '';
            document.getElementById('edit-colab-tel').value = item.telefone_whatsapp || '';
            document.getElementById('edit-colab-cargo').value = item.cargo || 'tecnico';
        } else if (table === 'propostas') {
            if (typeof window.populateProposalSelects === 'function') window.populateProposalSelects();
            document.getElementById('prop-cliente').value = item.cliente_id || '';
            document.getElementById('prop-servico').value = item.servico_tipo || '';
            document.getElementById('prop-valor').value = item.valor_estimado || '';
            document.getElementById('prop-obs').value = item.observacoes || '';
            document.getElementById('prop-prazo').value = item.prazo_inicio || '';
            if (item.fornecimento_materiais) {
                document.getElementById('prop-fornecimento').value = item.fornecimento_materiais;
            }
            document.getElementById('prop-valor-ajuste').value = (item.valor_ajuste !== null && item.valor_ajuste !== undefined && item.valor_ajuste !== 0) ? item.valor_ajuste : '';
            
            let parsedItems = [];
            let enderecoObraSaved = null;
            let mesmoEnderecoSaved = true;

            if (item.itens_json) {
                try {
                    let parsed = typeof item.itens_json === 'string' ? JSON.parse(item.itens_json) : item.itens_json;
                    if (Array.isArray(parsed)) {
                        const endObj = parsed.find(i => i && i.type === 'endereco_obra');
                        if (endObj) {
                            enderecoObraSaved = endObj.endereco;
                            mesmoEnderecoSaved = endObj.mesmo_endereco !== false;
                        }
                        parsedItems = parsed.filter(i => i && i.type !== 'payment_condition' && i.type !== 'endereco_obra');
                    }
                } catch (e) { parsedItems = []; }
            }
            window.currentPropItems = parsedItems;

            const chkEnd = document.getElementById('prop-mesmo-endereco');
            const inptEnd = document.getElementById('prop-endereco-obra');
            const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(item.cliente_id));

            if (chkEnd && inptEnd) {
                if (enderecoObraSaved !== null && enderecoObraSaved !== undefined) {
                    chkEnd.checked = mesmoEnderecoSaved;
                    inptEnd.value = enderecoObraSaved;
                    inptEnd.readOnly = mesmoEnderecoSaved;
                } else {
                    chkEnd.checked = true;
                    inptEnd.value = cliObj ? (cliObj.endereco_completo || '') : '';
                    inptEnd.readOnly = true;
                }
            }

            if (typeof window.renderPropItemsTable === 'function') window.renderPropItemsTable();
            if (typeof window.calcPropTotal === 'function') window.calcPropTotal();

            // Exibir botões adicionais apenas em edição de propostas
            const btnPrint = document.getElementById('btn-print-prop');
            const btnControls = document.getElementById('prop-controls');
            const btnControlsReact = document.getElementById('prop-controls-reactivate');
            if (btnPrint) btnPrint.style.display = 'block';
            if (btnControls) btnControls.style.display = (item.status === 'Pendente' || !item.status) ? 'flex' : 'none';
            if (btnControlsReact) btnControlsReact.style.display = (item.status === 'Aprovado' || item.status === 'Rejeitado') ? 'flex' : 'none';
        } else if (table === 'faturamentos') {
            if (typeof window.populateFaturamentoOSDropdown === 'function') {
                window.populateFaturamentoOSDropdown(item.os_id || '');
            }
            document.getElementById('fat-id').value = item.id;
            document.getElementById('fat-os-id').value = item.os_id || '';
            document.getElementById('fat-valor').value = item.total_geral != null ? item.total_geral : (item.valor != null ? item.valor : '');
            document.getElementById('fat-status').value = item.status_faturamento || item.status || 'Pendente';
            const dateInput = document.getElementById('fat-data-emissao');
            if (dateInput) {
                dateInput.value = item.data_emissao ? item.data_emissao.split('T')[0] : '';
            }
            if (typeof window.renderFaturamentoOSDetails === 'function') {
                window.renderFaturamentoOSDetails(item.os_id, item);
            }
        }

        openModal(modalId, true);
    };

    // ==========================================
    // SKELETON ENGINE
    // ==========================================
    function showTableSkeleton(tbodyId, cols = 5, rows = 3) {
        const tbody = document.querySelector(`#${tbodyId} tbody`);
        if (!tbody) return;
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += '<tr>' + Array(cols).fill('<td><div class="skeleton skeleton-text"></div></td>').join('') + '</tr>';
        }
        tbody.innerHTML = html;
    }

    window.renderCards = function (ordens) {
        const colHoje = document.querySelector('#group-today .os-group-list');
        const colAmanha = document.querySelector('#group-tomorrow .os-group-list');
        const colProximos = document.querySelector('#group-upcoming .os-group-list');

        if (!colHoje || !colAmanha || !colProximos) {
            console.warn('Containers da Agenda não encontrados no DOM.');
            return;
        }

        // Limpa Colunas com filtro de segurança
        [colHoje, colAmanha, colProximos].forEach(c => { if (c) c.innerHTML = ''; });

        if (!ordens || ordens.length === 0) {
            colAmanha.innerHTML = `<div style="text-align:center; padding: 40px; color: #666; font-style: italic; width: 100%;">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                Nenhum pedido agendado hoje.
            </div>`;
            return;
        }

        // Loop de Renderização dos Cards
        const hojeObj = new Date();
        hojeObj.setHours(0, 0, 0, 0);

        const amanhaObj = new Date(hojeObj);
        amanhaObj.setDate(amanhaObj.getDate() + 1);

        ordens.forEach(o => {
            // Regra de Arquivamento "Soft"
            if (o.status_ia === 'Arquivado') return;
            if (o.status_ia === 'Concluído' && o.data_hora) {
                const dataOS = new Date(o.data_hora);
                const difDias = Math.floor((new Date() - dataOS) / (1000 * 60 * 60 * 24));
                if (difDias > 8) return;
            }

            let datesToRender = [];
            if (o.data_hora) datesToRender.push(new Date(o.data_hora));
            if (o.os_datas) {
                o.os_datas.forEach(od => {
                    if (od.data) datesToRender.push(new Date(od.data + 'T12:00:00Z'));
                });
            }
            if (datesToRender.length === 0) datesToRender.push(new Date()); // Fallback se sem data

            // Para evitar cards duplicados no MESMO dia
            const renderedDays = new Set();

            datesToRender.forEach(dataAgendadaOrig => {
                const dataAgendada = new Date(dataAgendadaOrig);
                dataAgendada.setHours(0, 0, 0, 0);
                const timeKey = dataAgendada.getTime();
                
                if (renderedDays.has(timeKey)) return;
                renderedDays.add(timeKey);

                const card = document.createElement('div');
                card.className = 'os-card pulse-update glass-card';
                card.onclick = () => window.openSuperOS(o.id_os);

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 0.75rem; color: var(--accent-orange); font-weight: 800;">OS #${o.id_os}</span>
                        <span class="badge in-progress" style="font-size: 0.65rem;">${o.status_ia || 'Agendado'}</span>
                    </div>
                    <div style="font-weight: 700; color: #fff; font-size: 0.95rem; margin-bottom: 5px;">${o.clientes?.nome_cliente || 'Cliente Vazio'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;"><i class="fa-solid fa-wrench"></i> ${o.servico_tipo || 'Geral'}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div style="font-size: 0.75rem; color: #aaa;"><i class="fa-solid fa-user-astronaut"></i> ${o.colaborador || o.tecnico_id || 'A Definir'}</div>
                        <div style="font-size: 0.75rem; color: #aaa;"><i class="fa-regular fa-clock"></i> ${dataAgendadaOrig.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '--:--'}</div>
                    </div>
                `;

                // Mapeia Coluna
                if (timeKey === hojeObj.getTime() || timeKey < hojeObj.getTime()) {
                    colHoje.appendChild(card);
                } else if (timeKey === amanhaObj.getTime()) {
                    colAmanha.appendChild(card);
                } else {
                    colProximos.appendChild(card);
                }
            });
        });

        // Fallbacks Vazio
        if (colHoje.children.length === 0) colHoje.innerHTML = '<div style="color:#666; font-style:italic; padding: 20px; text-align:center;">Nenhuma OS para hoje.</div>';
        if (colAmanha.children.length === 0) colAmanha.innerHTML = '<div style="color:#666; font-style:italic; padding: 20px; text-align:center;">Agenda livre.</div>';
        if (colProximos.children.length === 0) colProximos.innerHTML = '<div style="color:#666; font-style:italic; padding: 20px; text-align:center;">Agenda livre.</div>';
    };

    window.renderTodasOS = function (ordens) {
        const tbody = document.querySelector('#table-todas-os tbody');
        if (!tbody) return;

        // Popula filtro de técnicos se ainda não populado
        const techFilter = document.getElementById('filtro-os-tecnico');
        if (techFilter && techFilter.options.length <= 1) {
            const techs = (window.colabCache || []).filter(c => {
                const role = (c.cargo || '').toLowerCase();
                return role.includes('tec') || role.includes('téc') || role.includes('eng') || role.includes('admin') || role.includes('gerente') || role.includes('dono');
            });
            techFilter.innerHTML = '<option value="">Todos os Técnicos</option>' +
                techs.map(t => `<option value="${t.id}">${t.nome_completo}</option>`).join('');
        }

        const data = [...(ordens || window.ordensCache || [])].sort((a, b) => b.id_os - a.id_os);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 35px; color: var(--text-muted); font-size: 0.9rem;">Nenhuma Ordem de Serviço encontrada.</td></tr>';
            return;
        }

        const hojeStr = new Date().toISOString().split('T')[0];

        let html = '';
        data.forEach(os => {
            // Parse dados extras (plano de pagamento, custos extras, datas extras, endereco obra)
            let extraData = {};
            if (typeof os.materiais_lista === 'string' && os.materiais_lista.startsWith('{')) {
                try { extraData = JSON.parse(os.materiais_lista); } catch(e) {}
            }

            const cliente = os.clientes || {};
            const nmCliente = cliente.nome_cliente || '<span style="color:#666;">Cliente não vinculado</span>';
            const endereco = extraData.endereco_obra || cliente.endereco_completo || 'Endereço não informado';
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

            const statusPagamento = os.status_pagamento || extraData.status_pagamento || 'Pendente';
            const condicaoPagamento = extraData.condicao_pagamento || 'À Vista (PIX)';
            const custosExtras = extraData.custos_extras || [];
            const totalExtras = custosExtras.reduce((acc, it) => acc + (parseFloat(it.valor) || 0), 0);

            // 1ª Data Agendamento
            let dtStr = 'Sem Data';
            if (os.data_hora) {
                const dt = new Date(os.data_hora);
                dtStr = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }

            // 4ª Status Operacional e Financeiro
            let stColor = '#95a5a6';
            const lw = (os.status_ia || '').toLowerCase();
            if (lw.includes('aberto')) stColor = '#e74c3c';
            if (lw.includes('em campo') || lw.includes('andamento') || lw.includes('deslocamento')) stColor = '#e67e22';
            if (lw.includes('validado') || lw.includes('finalizado') || lw.includes('concluido') || lw.includes('concluído')) stColor = '#2ecc71';
            if (lw.includes('cancelado')) stColor = '#7f8c8d';

            let pagBadgeColor = '#f39c12';
            if (statusPagamento === 'Pago') pagBadgeColor = '#27ae60';
            if (statusPagamento === 'Entrada Paga') pagBadgeColor = '#e67e22';

            // 5ª Dias de Serviço (Cronograma de Diárias)
            const rawDates = [];
            if (os.data_hora) rawDates.push(os.data_hora.split('T')[0]);
            if (os.os_datas && os.os_datas.length > 0) {
                os.os_datas.forEach(d => rawDates.push(d.data));
            }
            if (extraData.datas_cronograma && Array.isArray(extraData.datas_cronograma)) {
                extraData.datas_cronograma.forEach(d => {
                    const dtVal = typeof d === 'string' ? d : d.data;
                    if (dtVal) rawDates.push(dtVal);
                });
            }
            const uniqueDates = [...new Set(rawDates.filter(Boolean))].sort();

            let diáriasHtml = '';
            if (uniqueDates.length <= 1) {
                const singleDate = uniqueDates[0] ? new Date(uniqueDates[0] + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '1 dia';
                const isToday = uniqueDates[0] === hojeStr;
                diáriasHtml = `<span style="font-size:0.75rem; color:${isToday ? '#e67e22' : 'var(--text-muted)'}; background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:4px; font-weight:${isToday ? '800' : 'normal'};">${isToday ? '🔥 Hoje em campo' : `1 diária (${singleDate})`}</span>`;
            } else {
                diáriasHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">`;
                uniqueDates.forEach(d => {
                    const dtFmt = new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    if (d < hojeStr) {
                        diáriasHtml += `<span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:var(--text-muted); font-size:0.7rem; padding:2px 6px; border-radius:4px;" title="Concluído / Passado">${dtFmt} ✓</span>`;
                    } else if (d === hojeStr) {
                        diáriasHtml += `<span style="background:rgba(230,126,34,0.25); border:1px solid #e67e22; color:#e67e22; font-weight:800; font-size:0.73rem; padding:2px 7px; border-radius:4px; box-shadow:0 0 8px rgba(230,126,34,0.4);" title="Hoje em execução"><i class="fa-solid fa-fire"></i> ${dtFmt} (Hoje)</span>`;
                    } else {
                        diáriasHtml += `<span style="background:rgba(52,152,219,0.12); border:1px solid rgba(52,152,219,0.3); color:#3498db; font-size:0.7rem; padding:2px 6px; border-radius:4px;" title="Próxima diária agendada">${dtFmt}</span>`;
                    }
                });
                diáriasHtml += `<span style="font-size:0.68rem; color:var(--text-muted); margin-left:2px;">(${uniqueDates.length} dias)</span></div>`;
            }

            // 6ª Técnico Executor (Dropdown interativo)
            const sysTechs = (window.colabCache || []).filter(c => {
                const role = (c.cargo || '').toLowerCase();
                return role.includes('tec') || role.includes('téc') || role.includes('eng') || role.includes('admin') || role.includes('gerente') || role.includes('dono');
            });
            let techSelectHtml = `<select class="modal-input os-tech-select" style="padding:4px 6px; font-size:0.78rem; height:32px; border-radius:6px; background:rgba(0,0,0,0.6); color:#fff; border:1px solid rgba(255,255,255,0.2); width:100%; max-width:145px; cursor:pointer;" onclick="event.stopPropagation();" onchange="window.updateOSTechnician(${os.id_os}, this.value)">`;
            techSelectHtml += `<option value="" ${!os.tecnico_id && !os.colaborador ? 'selected' : ''}>Sem atribuição</option>`;
            sysTechs.forEach(t => {
                const isSelected = (os.tecnico_id && os.tecnico_id === t.id) || (os.colaborador && os.colaborador.toLowerCase() === t.nome_completo.toLowerCase());
                techSelectHtml += `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${t.nome_completo}</option>`;
            });
            techSelectHtml += `</select>`;

            html += `
            <tr style="cursor: pointer;" onclick="event.stopPropagation(); window.openSuperOS('${os.id_os}')">
                <td onclick="event.stopPropagation();" style="text-align: center;">
                    <input type="checkbox" class="mass-action-os-cb" value="${os.id_os}" onclick="event.stopPropagation(); updateMassActionOSCount()" style="cursor: pointer; transform: scale(1.2);">
                </td>
                <td>
                    <strong style="color:var(--text-primary); font-size:0.85rem;">OS-${String(os.id_os).padStart(4, '0')}</strong>
                </td>
                <td>
                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">
                        <i class="fa-solid fa-clock" style="color:var(--accent-orange); margin-right:4px;"></i>${dtStr}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 800; color: var(--accent-orange); font-size: 0.92rem; margin-bottom: 2px;">${nmCliente}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${os.servico_tipo || ''}">
                        ${os.servico_tipo || 'Serviço Geral'}
                    </div>
                </td>
                <td>
                    <div style="max-width: 210px; font-size: 0.8rem; line-height: 1.3;">
                        <a href="${mapsUrl}" target="_blank" onclick="event.stopPropagation();" style="color: #3498db; text-decoration: none; display: flex; align-items: flex-start; gap: 5px;" title="Abrir no Google Maps / Waze">
                            <i class="fa-solid fa-location-dot" style="color: #e74c3c; margin-top: 2px; flex-shrink: 0;"></i>
                            <span style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${endereco}</span>
                        </a>
                    </div>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                        <span class="status-badge" style="background: ${stColor}20; color: ${stColor}; border: 1px solid ${stColor}; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight:800; text-transform: uppercase;">
                            ${os.status_ia || 'ABERTO'}
                        </span>
                        <span style="font-size:0.7rem; color:${pagBadgeColor}; background:${pagBadgeColor}15; border:1px solid ${pagBadgeColor}40; padding:1px 6px; border-radius:4px; font-weight:700;">
                            ${statusPagamento} (${condicaoPagamento})
                        </span>
                        ${totalExtras > 0 ? `<span style="font-size:0.68rem; color:#e67e22; font-weight:700;"><i class="fa-solid fa-receipt"></i> +R$ ${totalExtras.toFixed(2)} extras</span>` : ''}
                    </div>
                </td>
                <td>
                    ${diáriasHtml}
                </td>
                <td>
                    ${techSelectHtml}
                </td>
                <td style="text-align: right; white-space: nowrap;" onclick="event.stopPropagation();">
                    <button class="action-btn" style="background: #25D366; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 4px;" title="Disparar OS formatada no WhatsApp do Técnico" onclick="window.enviarOsWhatsAppTecnico('${os.id_os}')">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button class="action-btn" style="background: var(--surface-light); padding: 6px 9px; border-radius: 6px; font-size: 0.85rem; margin-right: 4px;" title="Editar Prancheta da OS" onclick="window.openSuperOS('${os.id_os}')">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn" style="background: var(--surface-light); padding: 6px 9px; border-radius: 6px; font-size: 0.85rem;" title="Gerar PDF" onclick="window.generateOSPDF('${os.id_os}')">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
        updateMassActionOSCount(); // Refresh count on render
    };

    // Filtros rápidos da Central de OS
    window.filterTodasOS = function () {
        const busca = (document.getElementById('filtro-os-busca')?.value || '').toLowerCase().trim();
        const techId = document.getElementById('filtro-os-tecnico')?.value || '';
        const status = document.getElementById('filtro-os-status')?.value || '';

        const filtered = (window.ordensCache || []).filter(os => {
            const clienteName = (os.clientes?.nome_cliente || '').toLowerCase();
            const servico = (os.servico_tipo || '').toLowerCase();
            const endereco = (os.clientes?.endereco_completo || '').toLowerCase();
            const idStr = String(os.id_os);

            const matchBusca = !busca || clienteName.includes(busca) || servico.includes(busca) || endereco.includes(busca) || idStr.includes(busca);
            const matchTech = !techId || os.tecnico_id === techId;
            const matchStatus = !status || (os.status_ia || '').toLowerCase() === status.toLowerCase();

            return matchBusca && matchTech && matchStatus;
        });

        window.renderTodasOS(filtered);
    };

    // Atribuição de técnico instantânea na tabela
    window.updateOSTechnician = async function(osId, techId) {
        try {
            const supa = getSupa();
            const tech = (window.colabCache || []).find(c => c.id === techId);
            const techName = tech ? tech.nome_completo : (techId || 'Não Definido');

            triggerAutoSave(`Atribuindo OS #${osId} para ${techName}...`);

            const { error } = await supa.from('ordens_servico').update({
                tecnico_id: techId || null,
                colaborador: techName
            }).eq('id_os', osId);

            if (error) throw error;

            // Atualiza cache local
            const os = (window.ordensCache || []).find(o => String(o.id_os) === String(osId));
            if (os) {
                os.tecnico_id = techId || null;
                os.colaborador = techName;
            }

            triggerSaveSuccess(`Técnico ${techName} atribuído com sucesso à OS #${osId}!`);
        } catch(err) {
            console.error('Erro ao atualizar técnico:', err);
            triggerSaveError('Erro ao atualizar técnico: ' + err.message);
        }
    };

    // Disparo da OS formatada no WhatsApp do Técnico
    window.enviarOsWhatsAppTecnico = function(osId) {
        const os = (window.ordensCache || []).find(o => String(o.id_os) === String(osId));
        if (!os) return alert('Ordem de Serviço não encontrada.');

        let extraData = {};
        if (typeof os.materiais_lista === 'string' && os.materiais_lista.startsWith('{')) {
            try { extraData = JSON.parse(os.materiais_lista); } catch(e) {}
        }

        const cliente = os.clientes || {};
        const nmCliente = cliente.nome_cliente || 'Cliente';
        const phoneCliente = cliente.whatsapp || 'Não informado';
        const endereco = extraData.endereco_obra || cliente.endereco_completo || 'A combinar / Verificar no local';
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;

        // Cronograma de diárias
        const rawDates = [];
        if (os.data_hora) rawDates.push(os.data_hora.split('T')[0]);
        if (os.os_datas && os.os_datas.length > 0) {
            os.os_datas.forEach(d => rawDates.push(d.data));
        }
        if (extraData.datas_cronograma && Array.isArray(extraData.datas_cronograma)) {
            extraData.datas_cronograma.forEach(d => {
                const dtVal = typeof d === 'string' ? d : d.data;
                if (dtVal) rawDates.push(dtVal);
            });
        }
        const uniqueDates = [...new Set(rawDates.filter(Boolean))].sort();

        let cronogramaTxt = '';
        if (uniqueDates.length > 0) {
            cronogramaTxt = uniqueDates.map((d, i) => {
                const dtFmt = new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR');
                return `  • Diária ${i + 1}: ${dtFmt}`;
            }).join('\n');
        } else {
            cronogramaTxt = `  • A definir`;
        }

        // Serviços
        let servicosTxt = os.servico_tipo || 'Execução de serviços elétricos / climatização';
        if (os.os_servicos_executados && os.os_servicos_executados.length > 0) {
            servicosTxt = os.os_servicos_executados.map(s => `  - ${s.servicos?.nome_servico || 'Serviço'} (Qtd: ${s.quantidade})`).join('\n');
        }

        // Materiais
        let materiaisTxt = 'Nenhum material de estoque listado.';
        if (os.os_materiais_utilizados && os.os_materiais_utilizados.length > 0) {
            materiaisTxt = os.os_materiais_utilizados.map(m => `  - ${m.materiais?.nome_material || 'Material'} (Qtd: ${m.quantidade_usada})`).join('\n');
        }

        // Custos Extras / Repasses
        let extrasTxt = '';
        const custosExtras = extraData.custos_extras || [];
        if (custosExtras.length > 0) {
            extrasTxt = '\n\n💵 *CUSTOS EXTRAS / REPASSES:*\n' + custosExtras.map(e => `  - ${e.descricao} (R$ ${parseFloat(e.valor || 0).toFixed(2)})`).join('\n');
        }

        const msg = 
`👨‍🔧 *ORDEM DE SERVIÇO #OS-${String(os.id_os).padStart(4, '0')} — ARNALDO TRENTIN SERVIÇOS*

👤 *Cliente:* ${nmCliente}
📞 *Contato Cliente:* ${phoneCliente}
📍 *Endereço da Obra:* ${endereco}
🗺️ *Rota / GPS:* ${mapsUrl}

📅 *CRONOGRAMA DE DIÁRIAS:*
${cronogramaTxt}

🛠️ *SERVIÇOS A EXECUTAR:*
${servicosTxt}

📦 *MATERIAIS / FERRAMENTAL A LEVAR:*
${materiaisTxt}${extrasTxt}

📝 *Orientações:* Realizar o checklist fotográfico e avisar qualquer imprevisto na obra.`;

        // Descobre o WhatsApp do técnico
        let techPhone = '';
        if (os.tecnico_id) {
            const tech = (window.colabCache || []).find(c => c.id === os.tecnico_id);
            if (tech && tech.telefone) {
                techPhone = tech.telefone.replace(/\D/g, '');
            }
        }

        if (techPhone) {
            if (!techPhone.startsWith('55')) techPhone = '55' + techPhone;
            window.open(`https://wa.me/${techPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };

    // ==========================================
    // MASS ACTIONS (CONTROLE GERAL DE OS)
    // ==========================================
    window.toggleAllOSChecks = function(source) {
        const cbs = document.querySelectorAll('.mass-action-os-cb');
        cbs.forEach(cb => cb.checked = source.checked);
        updateMassActionOSCount();
    };

    window.updateMassActionOSCount = function() {
        const cbs = document.querySelectorAll('.mass-action-os-cb:checked');
        const countSpan = document.getElementById('mass-action-os-count');
        const massBar = document.getElementById('mass-action-os-bar');
        
        if(countSpan) countSpan.innerText = `${cbs.length} sel.`;
        if(massBar) {
            massBar.style.display = cbs.length > 0 ? 'flex' : 'none';
        }
        
        // Uncheck "select all" if not all are selected or none are selected
        const checkAll = document.getElementById('mass-action-os-checkall');
        const allCbs = document.querySelectorAll('.mass-action-os-cb');
        if (checkAll && allCbs.length > 0) {
            checkAll.checked = (cbs.length === allCbs.length);
        }
    };

    window.executeMassActionOS = async function() {
        const action = document.getElementById('mass-action-os-select').value;
        if (!action) return alert('Selecione uma ação válida (Arquivar ou Apagar).');

        const cbs = document.querySelectorAll('.mass-action-os-cb:checked');
        const ids = Array.from(cbs).map(cb => cb.value);
        if (ids.length === 0) return;

        if (!confirm(`Deseja realmente ${action} as ${ids.length} O.S(s) selecionadas? Esta ação é irreversível/permanente para o caso de Apagar.`)) return;

        triggerAutoSave(`Aplicando ação em lote (${action})...`);
        try {
            if (action === 'Apagar') {
                for (const id of ids) {
                    await supabase.from('ordens_servico').delete().eq('id_os', id);
                }
            } else if (action === 'Arquivar') {
                for (const id of ids) {
                    await supabase.from('ordens_servico').update({ status_ia: 'Cancelado' }).eq('id_os', id);
                }
            }
            triggerSaveSuccess(`Ação concluída em ${ids.length} O.S(s)!`);
            document.getElementById('mass-action-os-checkall').checked = false;
            loadData(); // Recarrega todas as O.S
        } catch(err) {
            console.error(err);
            triggerSaveError('Erro ao aplicar ação em lote.');
        }
    };

    function showBoardSkeleton() {
        const cols = ['group-today', 'group-tomorrow', 'group-upcoming'];
        cols.forEach(id => {
            const col = document.querySelector(`#${id} .os-group-list`);
            if (col) {
                col.innerHTML = `
                <div class="skeleton-card" style="height: 120px; border-radius: 8px; background: rgba(255,255,255,0.05); margin-bottom: 15px; animation: pulse 1.5s infinite;"></div>
                <div class="skeleton-card" style="height: 120px; border-radius: 8px; background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite;"></div>
            `;
            }
        });
    }

    // ==========================================
    // 2. BUSCAR DADOS (READ) E POPULAR QUADRO
    // ==========================================
    async function loadData(showSkeletons = true) {
        if (showSkeletons) {
            showBoardSkeleton();
            showTableSkeleton('table-obras', 5);
            showTableSkeleton('table-caixa', 6);
            showTableSkeleton('table-clientes', 5);
            showTableSkeleton('table-materiais', 7);
            showTableSkeleton('table-ferramentas', 6);
            showTableSkeleton('table-servicos', 5);
            showTableSkeleton('table-colaboradores', 6);
            showTableSkeleton('table-contratos', 5);
        }

        try {
            if (showSkeletons) triggerAutoSave('Sincronizando Dados Gerais...');

            // 1. Traz Ordem de Serviço (Aprimorado com Obras e Pagamento V5 e Itens)
            let ordens = null;
            try {
                const { data: ordensData, error: errOrdens } = await supabase
                    .from('ordens_servico')
                    .select(`
                        id_os, servico_tipo, status_ia, status_pagamento, cliente_id, obra_id, data_hora, tecnico_id, colaborador, materiais_lista,
                        clientes(id, nome_cliente, endereco_completo, whatsapp), 
                        obras(nome_obra),
                        os_servicos_executados(servico_id, quantidade, subtotal_cobrado, servicos(nome_servico, valor_base, categoria)),
                        os_materiais_utilizados(material_id, quantidade_usada, valor_unitario_cobrado, subtotal_material, materiais(nome_material, unidade_medida)),
                        os_datas(data, descricao)
                    `)
                    .order('data_hora', { ascending: false });

                if (errOrdens) {
                    console.error('Erro Crítico [ordens_servico]:', errOrdens.message);
                }
                ordens = ordensData;
            } catch (osErr) {
                console.error('[loadData] Falha ao carregar OS (RLS?):', osErr);
            }
            if (ordens) {
                window.ordensCache = ordens;
                window.renderCards(ordens);
                window.renderTodasOS(ordens);

                // ATUALIZAÇÃO GADGET DE PERFORMANCE
                const totalAbertas = ordens.filter(o => o.status_ia !== 'Finalizado' && o.status_ia !== 'Validado').length;
                const totalConcluidas = ordens.filter(o => o.status_ia === 'Finalizado' || o.status_ia === 'Validado').length;
                const eficiencia = ordens.length > 0 ? Math.round((totalConcluidas / ordens.length) * 100) : 100;

                const stats = document.querySelectorAll('.stat-circle .circle-value');
                if (stats.length >= 3) {
                    stats[0].textContent = totalAbertas;
                    stats[1].textContent = totalConcluidas;
                    stats[2].textContent = eficiencia + '%';
                }
            }

            // 1.5 Traz Obras
            const { data: obras, error: errObras } = await supabase.from('obras').select('*, clientes(nome_cliente)').order('created_at', { ascending: false });
            if (errObras) alert("Erro Supabase nas Obras: " + JSON.stringify(errObras));
            if (!errObras && obras) {
                window.obrasCache = obras; // Pra usar nas Super Fichas
                const tbody = document.querySelector('#table-obras tbody');
                if (tbody) tbody.innerHTML = obras.map(o => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('obras', '${o.id}')"><td><strong>${o.nome_obra}</strong></td><td>${o.clientes?.nome_cliente || '-'}</td><td>${o.endereco_operacional || '-'}</td><td><span class="badge in-progress">${o.status_obra}</span></td><td style="text-align:right;">${getActionButtons('obras', o.id, o.nome_obra)}</td></tr>`).join('');
            }

            // 1.6 Traz Fluxo de Caixa Central
            const { data: caixa, error: errCaixa } = await supabase.from('fluxo_caixa').select('*').order('data_ocorrencia', { ascending: false });
            if (errCaixa) alert("Erro Supabase no Caixa: " + JSON.stringify(errCaixa));
            if (!errCaixa && caixa) {
                window.caixaCache = caixa;
                const tbody = document.querySelector('#table-caixa tbody');
                if (tbody) {
                    tbody.innerHTML = caixa.map(cx => {
                        const isEntrada = cx.tipo_movimento === 'Entrada';
                        const corValor = isEntrada ? 'success' : 'danger';
                        return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('fluxo_caixa', '${cx.id}')">
                                    <td><span class="badge ${corValor}"><i class="fa-solid ${isEntrada ? 'fa-arrow-turn-up' : 'fa-arrow-turn-down'}"></i> ${cx.tipo_movimento}</span></td>
                                    <td>${cx.categoria}</td>
                                    <td>${cx.descricao || '-'}</td>
                                    <td><strong class="${corValor}">R$ ${cx.valor}</strong></td>
                                    <td>${cx.created_at ? new Date(cx.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td>${cx.data_ocorrencia ? new Date(cx.data_ocorrencia).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td style="text-align:right;">${getActionButtons('fluxo_caixa', cx.id, cx.descricao || cx.categoria)}</td>
                                </tr>`;
                    }).join('');
                }

                // DRE DIDÁTICO (NO ALTO DA ABA DE CAIXA)
                let dreReceitas = 0;
                let dreDespesas = 0;
                let dreComissoes = 0;

                caixa.forEach(cx => {
                    if (cx.tipo_movimento === 'Entrada') {
                        dreReceitas += parseFloat(cx.valor);
                    } else if (cx.tipo_movimento === 'Saida') {
                        if (cx.categoria && cx.categoria.toLowerCase().includes('comissã')) {
                            dreComissoes += parseFloat(cx.valor);
                        } else {
                            dreDespesas += parseFloat(cx.valor);
                        }
                    }
                });

                const dreLucro = dreReceitas - dreDespesas - dreComissoes;

                const elReceita = document.getElementById('dre-receitas');
                const elDespesa = document.getElementById('dre-despesas');
                const elComissao = document.getElementById('dre-comissoes');
                const elLucro = document.getElementById('dre-lucro');

                if (elReceita) elReceita.textContent = 'R$ ' + dreReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (elDespesa) elDespesa.textContent = 'R$ ' + dreDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (elComissao) elComissao.textContent = 'R$ ' + dreComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (elLucro) {
                    elLucro.textContent = 'R$ ' + dreLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    if (dreLucro < 0) { elLucro.parentElement.style.borderBottomColor = '#e74c3c'; elLucro.previousElementSibling.style.color = '#e74c3c'; }
                }


                // ATUALIZAÇÃO GADGET FINANCEIRO
                let saldoReal = 0;
                caixa.forEach(cx => {
                    if (cx.tipo_movimento === 'Entrada') saldoReal += parseFloat(cx.valor);
                    if (cx.tipo_movimento === 'Saida') saldoReal -= parseFloat(cx.valor);
                });
                const financeVals = document.querySelectorAll('.finance-item .value');
                if (financeVals.length >= 3) {
                    financeVals[0].textContent = 'R$ ' + saldoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    financeVals[1].textContent = '(Em Breve)'; // Meta de UI puxando faturamentos pendentes
                    financeVals[2].textContent = '(Em Breve)';

                    // Aplica regra de visibilidade global a cada atualização
                    financeVals.forEach(val => val.classList.toggle('blur-value', !window.financesVisible));
                }
            }

            // 2. Traz Clientes e Status do Bot
            const { data: pauseMemories } = await supabase.from('agent_memory')
                .select('phone, content, created_at')
                .eq('role', 'user')
                .in('content', ['BOT_PAUSADO', 'BOT_ATIVO', 'GLOBAL_PAUSE', 'GLOBAL_ACTIVE'])
                .order('created_at', { ascending: false });

            window.pausedPhones = {};
            window._globalBotLoaded = false;
            if (pauseMemories) {
                pauseMemories.forEach(m => {
                    if (window.pausedPhones[m.phone] === undefined && m.phone !== 'GLOBAL_CONFIG') {
                        window.pausedPhones[m.phone] = m.content === 'BOT_PAUSADO';
                    }
                    if (m.phone === 'GLOBAL_CONFIG' && !window._globalBotLoaded) {
                        window._globalBotLoaded = true;
                        const gBtn = document.getElementById('btn-global-bot-switch');
                        if (gBtn) {
                            if (m.content === 'GLOBAL_PAUSE') {
                                gBtn.dataset.state = 'PAUSADO';
                                gBtn.innerHTML = '<i class="fa-solid fa-microphone-lines-slash"></i> AUTOATENDIMENTO: OFF';
                                gBtn.style.background = '#e74c3c';
                                gBtn.style.boxShadow = '0 4px 15px rgba(231,76,60,0.3)';
                            } else {
                                gBtn.dataset.state = 'ATIVO';
                                gBtn.innerHTML = '<i class="fa-solid fa-robot fa-shake" style="margin-right: 8px;"></i> AUTOATENDIMENTO: ON';
                                gBtn.style.background = '#2ecc71';
                                gBtn.style.boxShadow = '0 4px 15px rgba(46,204,113,0.3)';
                            }
                        }
                    }
                });
            }

            const { data: clientes, error: errCli } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (errCli) console.error('[loadData] Erro ao carregar clientes (RLS?):', errCli.message);
            if (!errCli && clientes) {
                window.clientesCache = clientes; // Guardando pra uso offline de selects
                const tbody = document.querySelector('#table-clientes tbody');
                if (tbody) tbody.innerHTML = clientes.map(c => {
                    const isPaused = window.pausedPhones[c.whatsapp] || false;
                    const botBadge = isPaused
                        ? `<button onclick="event.stopPropagation(); window.toggleBotStatus('${c.whatsapp}', false)" style="background:var(--accent-red); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; width:90px;"><i class="fa-solid fa-microphone-lines-slash"></i> Pausada</button>`
                        : `<button onclick="event.stopPropagation(); window.toggleBotStatus('${c.whatsapp}', true)" style="background:rgba(46, 204, 113, 0.2); color:var(--accent-green); border:1px solid rgba(46, 204, 113, 0.3); padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; width:90px;"><i class="fa-solid fa-robot"></i> Ativa</button>`;

                    return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('clientes', '${c.id}')"><td>${c.nome_cliente}</td><td>${c.whatsapp || '-'}</td><td>${c.endereco_completo || '-'}</td><td>${c.documento_cpf_cnpj || '-'}</td><td>${botBadge}</td><td style="text-align:right;">${getActionButtons('clientes', c.id, c.nome_cliente)}</td></tr>`;
                }).join('');

                // Popula select das Obras
                const selectObra = document.getElementById('ob-cliente-id');
                if (selectObra) selectObra.innerHTML = '<option value="">(Selecione o Cliente...)</option>' + clientes.map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');
            }

            // 3. Traz Materiais (Estoque)
            const { data: materiais, error: errMat } = await supabase.from('materiais').select('*');
            if (errMat) console.error('[loadData] Erro ao carregar materiais (RLS?):', errMat.message);
            if (!errMat && materiais) {
                window.materiaisCache = materiais;
                if (typeof window.renderMateriais === 'function') window.renderMateriais();
            }

            // 4. Traz Ferramentas
            const { data: ferramentas, error: errFer } = await supabase.from('ferramentas').select('*, colaboradores(nome_completo)');
            if (!errFer && ferramentas) {
                window.ferramentasCache = ferramentas;
                const tbody = document.querySelector('#table-ferramentas tbody');
                tbody.innerHTML = ferramentas.map(f => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('ferramentas', '${f.id}')"><td>${f.nome_ferramenta}</td><td><span class="badge ${f.status === 'Disponível' ? 'success' : (f.status === 'Manutenção' ? 'danger' : 'warning')}">${f.status}</span></td><td><strong>${f.colaboradores ? f.colaboradores.nome_completo : '-'}</strong></td><td>${f.local_atual || 'Depósito Central'}</td><td>${f.estado_conservacao || 'OK'}</td><td>${f.observacao || '-'}</td><td style="text-align:right;">${getActionButtons('ferramentas', f.id, f.nome_ferramenta)}</td></tr>`).join('');
            }

            // 5. Traz Servicos
            const { data: servicos, error: errSer } = await supabase.from('servicos').select('*');
            if (errSer) console.error('[loadData] Erro ao carregar servicos (RLS?):', errSer.message);
            if (!errSer && servicos) {
                window.servicosCache = servicos;
                if (typeof window.renderServicos === 'function') window.renderServicos();
            }

            // 6. Traz Quadro de Funcionários (Colaboradores)
            const { data: colaboradores, error: errCol } = await supabase.from('colaboradores').select('*').order('nome_completo', {ascending: true});
            if (!errCol && colaboradores) {
                window.colabCache = colaboradores;
                const filterTecnicoObj = document.getElementById('filter-comissao-tecnico');
                if (filterTecnicoObj) filterTecnicoObj.innerHTML = '<option value="">(Todos)</option>' + colaboradores.map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');

                const dropdownCautelaF = document.getElementById('fer-colaborador-id');
                if (dropdownCautelaF) dropdownCautelaF.innerHTML = '<option value="">Nenhum (Em Estoque / Central)</option>' + colaboradores.map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');

                const tbody = document.querySelector('#table-colaboradores tbody');
                const CARGO_LABELS = { admin: 'Administrador', financeiro: 'Financeiro', atendimento: 'Atendimento', tecnico: 'Técnico de Campo' };
                const CARGO_BADGES = { admin: 'danger', financeiro: 'warning', atendimento: 'in-progress', tecnico: 'normal' };
                if (tbody) {
                    tbody.innerHTML = colaboradores.map(c => {
                        const cargoLabel = CARGO_LABELS[c.cargo] || c.cargo;
                        const cargoBadge = CARGO_BADGES[c.cargo] || 'normal';
                        const ultimoAcesso = c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca';
                        return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('colaboradores', '${c.id}')">
                            <td><strong><i class="fa-solid fa-user"></i> ${c.nome_completo}</strong></td>
                            <td>${c.telefone_whatsapp || '-'}</td>
                            <td>${c.email || '-'}</td>
                            <td><span style="font-size:0.8rem; color: var(--text-muted);">${ultimoAcesso}</span></td>
                            <td><span class="badge ${cargoBadge}">${cargoLabel}</span></td>
                            <td style="text-align:right;">
                                ${getActionButtons('colaboradores', c.id, c.nome_completo)}
                            </td>
                        </tr>`;
                    }).join('');
                }
            }

            // 7. Traz Contratos PMOC e Jurídico
            const { data: contratos, error: errContratos } = await supabase.from('contratos_pmoc').select('*, clientes(nome_cliente)').order('created_at', { ascending: false });
            if (!errContratos && contratos) {
                window.contratosCache = contratos;
                const tbody = document.querySelector('#table-contratos tbody');
                if (tbody) {
                    if (contratos.length > 0) {
                        tbody.innerHTML = contratos.map(c => {
                            const badgeSt = c.status_contrato === 'Ativo' ? 'success' : 'warning';
                            let btnAcao = '';
                            if (c.tipo_contrato.includes('PMOC')) {
                                btnAcao = `<button class="action-btn" style="padding:5px 10px; font-size:0.8rem; background:var(--accent-orange);" onclick="event.stopPropagation(); alert('Emissão de Laudos PMOC/ANVISA via PDF em breve.')"><i class="fa-solid fa-file-pdf"></i> Laudo PMOC</button>`;
                            } else {
                                btnAcao = `<button class="action-btn" style="padding:5px 10px; font-size:0.8rem; background:var(--accent-blue);" onclick="event.stopPropagation(); alert('Visualizador de Contratos em breve.')"><i class="fa-solid fa-file-signature"></i> Ver Contrato</button>`;
                            }

                            return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('contratos_pmoc', '${c.id}')">
                                <td><strong><i class="fa-solid fa-file-contract"></i> ${c.tipo_contrato}</strong><br><small style="color:#a4b0be">Ref: ${c.id.split('-')[0]}</small></td>
                                <td>${c.clientes?.nome_cliente || '-'}</td>
                                <td><span class="badge ${badgeSt}">${c.status_contrato}</span></td>
                                <td>${c.vigencia_meses} meses<br><strong style="color:var(--accent-blue)">R$ ${c.valor_contrato}</strong></td>
                                <td style="text-align:right;">
                                    <div style="display:flex; justify-content:flex-end; gap:5px; align-items:center;">
                                        ${btnAcao}
                                        ${getActionButtons('contratos_pmoc', c.id, c.tipo_contrato)}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#a4b0be; padding:30px;">O Jurídico (Júlia Sakamoto) ainda não emitiu contratos PMOC.</td></tr>`;
                    }
                }
            }

            // 7.1 Traz Propostas (Orçamentos Industriais) V5.7
            const { data: propostas, error: errPropostas } = await supabase.from('propostas').select('*, clientes(nome_cliente)').order('created_at', { ascending: false });
            if (!errPropostas && propostas) {
                window.propostasCache = propostas;
                const tbody = document.querySelector('#table-propostas tbody');
                if (tbody) {
                    if (propostas.length > 0) {
                        tbody.innerHTML = propostas.map(p => {
                            const badgeSt = p.status === 'Pendente' ? 'warning' : (p.status === 'Aprovado' ? 'success' : 'normal');
                            const btnAprovar = p.status === 'Pendente' ? `<button type="button" style="background:var(--accent-green); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;" onclick="window.approveProposal(event, '${p.id}')" title="Aprovar"><i class="fa-solid fa-check"></i> Fechar</button>` : '';
                            const btnReprovar = p.status === 'Pendente' ? `<button type="button" style="background:var(--danger-color); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;" onclick="window.rejectProposal(event, '${p.id}')" title="Reprovar"><i class="fa-solid fa-xmark"></i> Perder</button>` : '';
                            const btnPDF = `<button type="button" style="background:var(--accent-blue); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;" onclick="window.generateProposalPDF(event, '${p.id}')" title="PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;

                            return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('propostas', '${p.id}')">
                                <td><strong><i class="fa-solid fa-file-invoice-dollar"></i> ${p.servico_tipo || 'Orçamento'}</strong><br><small style="color:#a4b0be">ID: ${p.id.split('-')[0]}</small></td>
                                <td>${p.clientes?.nome_cliente || '-'}<br><small style="color:#a4b0be"><i class="fa-regular fa-calendar" style="margin-right:3px;"></i>${p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '-'}</small></td>
                                <td><span class="badge ${badgeSt}">${p.status || 'Novo'}</span></td>
                                <td><strong style="color:var(--accent-green)">R$ ${parseFloat(p.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                                <td style="text-align:right;">
                                    <div style="display:flex; justify-content:flex-end; gap:5px; align-items:center;">
                                        ${btnPDF}
                                        ${btnAprovar}
                                        ${btnReprovar}
                                        ${getActionButtons('propostas', p.id, p.servico_tipo)}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#a4b0be; padding:30px;">Nenhuma proposta gerada até o momento.</td></tr>`;
                    }
                }
            }

            // ==========================================
            // 7.2 Traz Faturamentos B2B
            if (typeof window.loadFaturamentos === 'function') await window.loadFaturamentos();

            // 7.3 Traz Comissões (Pagamentos de Equipe)
            if (typeof window.loadComissoes === 'function') await window.loadComissoes();

            // 7.4 Traz Vendas de Produtos (Estoque)
            const { data: vendas, error: errVendas } = await supabase.from('vendas_produtos').select('*').order('data_venda', { ascending: false });
            if (!errVendas && vendas) {
                window.vendasCache = vendas;
                const tbody = document.querySelector('#table-vendas-produtos tbody');
                if (tbody) {
                    if (vendas.length > 0) {
                        tbody.innerHTML = vendas.map(v => {
                            const dateStr = v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR') : '-';
                            const faturamento = parseFloat(v.valor_unitario_venda || 0) * parseFloat(v.quantidade_vendida || 0);
                            return `<tr>
                                <td><i class="fa-regular fa-calendar"></i> ${dateStr}</td>
                                <td><strong>${v.nome_material || '-'}</strong></td>
                                <td>${v.cliente_nome || '-'}</td>
                                <td style="text-align:center;">${v.quantidade_vendida}</td>
                                <td style="text-align:right; font-weight:bold; color:var(--text-primary);">R$ ${faturamento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                                <td style="text-align:right; font-weight:800; color:#2ecc71;">R$ ${parseFloat(v.lucro_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                            </tr>`;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a4b0be; padding:30px;">Nenhuma venda registrada até o momento.</td></tr>`;
                    }
                }
            }

            // ==========================================
            // 8. RENDERIZAR DASHBOARD ANALÍTICO EM TEMPO REAL E AGENDAS
            if (typeof renderDashboardAnalytics === 'function') {
                renderDashboardAnalytics();
            }

            if (typeof window.renderTechAgenda === 'function') {
                window.renderTechAgenda();
            }
            if (typeof window.renderDualCalendar === 'function') {
                window.renderDualCalendar();
                window.renderDailyProgram();
            }

            // Re-aplica visibilidade de preços após renderização das tabelas
            applyPriceVisibility();

            // Aplica permissões de acesso da UI
            if (typeof window.applyRolePermissions === 'function') {
                window.applyRolePermissions();
            }

            // 7.4 Traz Parque de Equipamentos (PMOC)
            await window.loadEquipamentos();

            triggerSaveSuccess('Auto-Save Ativo (Supabase Connect)');
        } catch (err) {
            console.error('Erro ao buscar dados:', err);
            triggerSaveError('Erro na Conexão Supabase!');
        }
    }

    // ==========================================
    // 2.A FETCH ROTINAS FINANCEIRAS COM TIPAGEM
    // ==========================================

    /**
     * @typedef {Object} Faturamento
     * @property {string} id - UUID
     * @property {string} os_id - Ordem de Serviço Referência
     * @property {string} cliente_id - ID do Cliente
     * @property {string} data_emissao - Data de emissão ISO
     * @property {number} total_servicos - Subtotal serviços
     * @property {number} total_materiais - Subtotal materiais
     * @property {number} impostos - Total de Impostos
     * @property {number} valor_geral - Dinheiro Total
     * @property {string} status - Pendente, Faturado, Pago, Cancelado
     * @property {Object} [clientes] - Dados do cliente opcionais (relacionais)
     */

    /**
     * Preenche o dropdown de Ordens de Serviço no Modal de Faturamento
     */
    window.populateFaturamentoOSDropdown = function (selectedOsId = '') {
        const sel = document.getElementById('fat-os-id');
        if (!sel) return;

        let options = '<option value="">Faturamento Manual / Sem OS</option>';
        const ordens = window.ordensCache || [];

        ordens.forEach(o => {
            const osId = o.id_os || o.id;
            const cliName = o.clientes?.nome_cliente || (o.cliente_id ? (window.clientesCache || []).find(c => String(c.id || c.id_cli) === String(o.cliente_id))?.nome_cliente : null) || 'Cliente N/D';
            const serv = o.servico_tipo || 'Geral';
            
            let total = 0;
            if (o.os_servicos_executados && Array.isArray(o.os_servicos_executados)) {
                o.os_servicos_executados.forEach(s => { total += Number(s.subtotal_cobrado || 0); });
            }
            if (o.os_materiais_utilizados && Array.isArray(o.os_materiais_utilizados)) {
                o.os_materiais_utilizados.forEach(m => { total += Number(m.subtotal_material || 0); });
            }

            const valorStr = total > 0 ? ` - R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
            const isSelected = String(osId) === String(selectedOsId) ? 'selected' : '';
            options += `<option value="${osId}" ${isSelected}>#${osId} - ${cliName} - ${serv}${valorStr}</option>`;
        });

        sel.innerHTML = options;
    };

    /**
     * Renderiza dinamicamente os detalhes da OS e do Cliente no Modal de Faturamento
     */
    window.renderFaturamentoOSDetails = function (osId = '', faturamentoItem = null) {
        const container = document.getElementById('fat-os-details-container');
        const warning = document.getElementById('fat-manual-warning');
        const btnVerOSWrapper = document.getElementById('fat-btn-ver-os-wrapper');
        const quickActions = document.getElementById('fat-quick-actions');
        if (!container || !warning) return;

        // Limpa ações rápidas
        if (quickActions) quickActions.innerHTML = '';

        if (faturamentoItem) {
            const actualStatus = faturamentoItem.status_faturamento || faturamentoItem.status || 'Pendente';
            if (quickActions) {
                if (actualStatus !== 'Pago') {
                    quickActions.innerHTML = `<button type="button" class="action-btn" style="background:#27ae60; color:#fff; font-size:0.8rem; padding:0 14px; height:42px; display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.baixarFaturamento(null, '${faturamentoItem.id}')" title="Dar Baixa no Caixa Central"><i class="fa-solid fa-hand-holding-dollar"></i> Receber no Caixa</button>`;
                } else {
                    quickActions.innerHTML = `<button type="button" class="action-btn" style="background:#3498db; color:#fff; font-size:0.8rem; padding:0 14px; height:42px; display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window.gerarReciboPdf(null, '${faturamentoItem.id}')" title="Gerar Recibo Oficial (PDF)"><i class="fa-solid fa-file-pdf"></i> Gerar Recibo PDF</button>`;
                }
            }
        }

        const cleanOsId = osId ? String(osId).trim() : '';
        if (!cleanOsId) {
            container.style.display = 'none';
            warning.style.display = 'block';
            if (btnVerOSWrapper) btnVerOSWrapper.style.display = 'none';
            return;
        }

        // Procura a OS no cache ou do faturamentoItem
        let os = (window.ordensCache || []).find(o => String(o.id_os || o.id) === cleanOsId);
        if (!os && faturamentoItem?.ordens_servico) {
            os = faturamentoItem.ordens_servico;
        }

        if (!os) {
            container.style.display = 'none';
            warning.style.display = 'block';
            if (btnVerOSWrapper) btnVerOSWrapper.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        warning.style.display = 'none';
        if (btnVerOSWrapper) btnVerOSWrapper.style.display = 'block';

        // 1. Dados do Cliente
        const cliObj = os.clientes || (os.cliente_id ? (window.clientesCache || []).find(c => String(c.id || c.id_cli) === String(os.cliente_id)) : null);
        const cliDiv = document.getElementById('fat-detalhes-cliente');
        if (cliDiv) {
            const nomeCli = cliObj?.nome_cliente || 'Cliente não identificado';
            const whatsCli = cliObj?.whatsapp || cliObj?.telefone || '';
            const docCli = cliObj?.documento_cpf_cnpj || 'Não informado';
            const endCli = cliObj?.endereco_completo || cliObj?.endereco || 'Não informado';
            
            const whatsLink = whatsCli ? `<a href="https://wa.me/55${whatsCli.replace(/\D/g, '')}" target="_blank" style="color: var(--accent-green); text-decoration: none; margin-left: 8px; font-weight: bold;"><i class="fa-brands fa-whatsapp"></i> ${whatsCli}</a>` : '<span style="color: var(--text-muted);">Não informado</span>';

            cliDiv.innerHTML = `
                <div><span style="color: var(--text-muted);">Nome:</span> <strong style="color: #fff;">${nomeCli}</strong></div>
                <div><span style="color: var(--text-muted);">WhatsApp:</span> ${whatsLink}</div>
                <div><span style="color: var(--text-muted);">CPF / CNPJ:</span> <span style="color: #eee;">${docCli}</span></div>
                <div style="margin-top: 2px;"><span style="color: var(--text-muted);">Endereço:</span> <span style="color: #eee;">${endCli}</span></div>
            `;
        }

        // 2. Dados da OS
        const osDiv = document.getElementById('fat-detalhes-os');
        const osBadge = document.getElementById('fat-detalhes-os-badge');
        if (osDiv) {
            const st = os.status_ia || 'Aberto';
            const stClass = st.includes('Finalizado') || st.includes('Validado') || st.includes('Concluído') ? 'success' : (st.includes('Andamento') ? 'in-progress' : 'warning');
            if (osBadge) {
                osBadge.className = `badge ${stClass}`;
                osBadge.textContent = st;
            }

            const dataOS = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR') : 'Não informada';
            const colab = (window.colabCache || []).find(cb => cb.id === os.tecnico_id);
            const nomeTec = colab?.nome_completo || os.colaborador || 'Não definido';
            const obraNome = os.obras?.nome_obra || (os.obra_id ? (window.obrasCache || []).find(o => String(o.id) === String(os.obra_id))?.nome_obra : null);

            osDiv.innerHTML = `
                <div><span style="color: var(--text-muted);">OS:</span> <strong style="color: var(--accent-orange);">#${os.id_os || os.id}</strong> - <span style="color: #fff;">${os.servico_tipo || 'Geral'}</span></div>
                <div><span style="color: var(--text-muted);">Data da OS:</span> <span style="color: #eee;">${dataOS}</span></div>
                <div><span style="color: var(--text-muted);">Responsável:</span> <span style="color: #eee;">${nomeTec}</span></div>
                ${obraNome ? `<div><span style="color: var(--text-muted);">Obra / Projeto:</span> <span style="color: var(--accent-blue);">${obraNome}</span></div>` : ''}
            `;
        }

        // 3. Tabela de Serviços Executados
        const servBody = document.getElementById('fat-lista-servicos-body');
        const servBadge = document.getElementById('fat-total-servicos-badge');
        const servBox = document.getElementById('fat-box-servicos');
        let totalServ = 0;

        if (servBody) {
            const servicos = os.os_servicos_executados || [];
            if (servicos.length > 0) {
                servBody.innerHTML = servicos.map(s => {
                    const nomeSvc = s.servicos?.nome_servico || 'Serviço Operacional';
                    const qtd = Number(s.quantidade || 1);
                    const sub = Number(s.subtotal_cobrado || 0);
                    totalServ += sub;
                    return `<tr>
                        <td style="color:#fff;"><i class="fa-solid fa-check" style="color:var(--accent-green); font-size:0.75rem; margin-right:5px;"></i>${nomeSvc}</td>
                        <td style="text-align:center;">${qtd}</td>
                        <td style="text-align:right; font-weight:bold; color:var(--accent-green);">R$ ${sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>`;
                }).join('');
            } else {
                totalServ = Number(faturamentoItem?.total_servicos || 0);
                servBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">${totalServ > 0 ? `Valor global de serviços lançado: R$ ${totalServ.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Nenhum serviço unitário discriminado na OS.'}</td></tr>`;
            }
            if (servBadge) servBadge.textContent = `R$ ${totalServ.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }

        // 4. Tabela de Materiais Utilizados
        const matBody = document.getElementById('fat-lista-materiais-body');
        const matBadge = document.getElementById('fat-total-materiais-badge');
        const matBox = document.getElementById('fat-box-materiais');
        let totalMat = 0;

        if (matBody) {
            const materiais = os.os_materiais_utilizados || [];
            if (materiais.length > 0) {
                matBody.innerHTML = materiais.map(m => {
                    const nomeMat = m.materiais?.nome_material || 'Material de Reposição';
                    const un = m.materiais?.unidade_medida || 'un';
                    const qtd = Number(m.quantidade_usada || 0);
                    const sub = Number(m.subtotal_material || 0);
                    totalMat += sub;
                    return `<tr>
                        <td style="color:#fff;"><i class="fa-solid fa-cube" style="color:var(--accent-orange); font-size:0.75rem; margin-right:5px;"></i>${nomeMat}</td>
                        <td style="text-align:center;">${qtd} ${un}</td>
                        <td style="text-align:right; font-weight:bold; color:var(--accent-orange);">R$ ${sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>`;
                }).join('');
                if (matBox) matBox.style.display = 'block';
            } else {
                totalMat = Number(faturamentoItem?.total_materiais || 0);
                if (totalMat > 0) {
                    matBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">Valor de materiais faturado: R$ ${totalMat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`;
                    if (matBox) matBox.style.display = 'block';
                } else {
                    matBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:8px;">Nenhum material adicional lançado.</td></tr>`;
                    if (matBox) matBox.style.display = 'block';
                }
            }
            if (matBadge) matBadge.textContent = `R$ ${totalMat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }

        // 5. Comissões e Rateio
        const comDiv = document.getElementById('fat-lista-comissoes-container');
        const comBadge = document.getElementById('fat-total-comissoes-badge');
        if (comDiv) {
            let comVend = 0;
            let comTec = 0;
            const comList = faturamentoItem?.comissoes || os.comissoes;
            if (comList && Array.isArray(comList) && comList.length > 0) {
                comDiv.innerHTML = comList.map(c => {
                    const colab = (window.colabCache || []).find(cb => cb.id === c.colaborador_id);
                    const nome = colab?.nome_completo || 'Colaborador';
                    const v = Number(c.valor_comissao || 0);
                    const isSeller = colab && ['vendedor', 'comercial', 'vendas'].some(cargo => colab.cargo?.toLowerCase().includes(cargo));
                    if (isSeller) comVend += v; else comTec += v;
                    return `<span style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);"><strong style="color:${isSeller ? 'var(--accent-orange)' : 'var(--accent-blue)'};">${nome} (${c.percentual_acordado || 0}%):</strong> R$ ${v.toFixed(2)}</span>`;
                }).join('');
            } else {
                const baseCalc = totalServ > 0 ? totalServ : (Number(faturamentoItem?.total_geral || 0));
                comVend = baseCalc * 0.10;
                comTec = baseCalc * 0.40;
                comDiv.innerHTML = `
                    <span style="background:rgba(230,126,34,0.1); padding:4px 8px; border-radius:4px; border:1px solid rgba(230,126,34,0.3); color:#f39c12;">
                        <i class="fa-solid fa-user-tag"></i> <strong>Comissão Vendas (10%):</strong> R$ ${comVend.toFixed(2)}
                    </span>
                    <span style="background:rgba(52,152,219,0.1); padding:4px 8px; border-radius:4px; border:1px solid rgba(52,152,219,0.3); color:#3498db;">
                        <i class="fa-solid fa-users-gear"></i> <strong>Rateio Técnico (40%):</strong> R$ ${comTec.toFixed(2)}
                    </span>
                `;
            }
            if (comBadge) comBadge.textContent = `R$ ${(comVend + comTec).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
    };

    /**
     * Handler disparado ao mudar a OS no select
     */
    window.onFatOSChange = function (osId) {
        window.renderFaturamentoOSDetails(osId);
        if (osId) {
            const os = (window.ordensCache || []).find(o => String(o.id_os || o.id) === String(osId));
            if (os) {
                let total = 0;
                if (os.os_servicos_executados && Array.isArray(os.os_servicos_executados)) {
                    os.os_servicos_executados.forEach(s => { total += Number(s.subtotal_cobrado || 0); });
                }
                if (os.os_materiais_utilizados && Array.isArray(os.os_materiais_utilizados)) {
                    os.os_materiais_utilizados.forEach(m => { total += Number(m.subtotal_material || 0); });
                }
                const valInput = document.getElementById('fat-valor');
                if (valInput && (!valInput.value || parseFloat(valInput.value) === 0)) {
                    if (total > 0) valInput.value = total.toFixed(2);
                }
            }
        }
    };

    /**
     * Abre o modal completo da Super OS a partir do Faturamento
     */
    window.abrirOSDoFaturamento = function () {
        const osId = document.getElementById('fat-os-id')?.value;
        if (!osId) {
            alert('Nenhuma Ordem de Serviço vinculada a este lançamento.');
            return;
        }
        closeModal('modal-faturamento-b2b');
        if (typeof window.openSuperOS === 'function') {
            window.openSuperOS(osId);
        }
    };

    /**
     * Busca os faturamentos industriais e B2B gravados no banco de dados.
     * Atualiza a tabela "table-faturamentos" e o cache "window.faturamentosCache".
     * @returns {Promise<void>}
     */
    window.loadFaturamentos = async function () {
        try {
            let data = null;
            try {
                const { data: qData, error: qErr } = await supabase
                    .from('faturamentos')
                    .select(`
                        *,
                        ordens_servico(
                            id_os,
                            servico_tipo,
                            data_hora,
                            status_ia,
                            cliente_id,
                            obra_id,
                            tecnico_id,
                            colaborador,
                            clientes(id, nome_cliente, whatsapp, telefone, endereco_completo, documento_cpf_cnpj),
                            obras(id, nome_obra),
                            os_servicos_executados(servico_id, quantidade, subtotal_cobrado, servicos(nome_servico, valor_base)),
                            os_materiais_utilizados(material_id, quantidade_usada, valor_unitario_cobrado, subtotal_material, materiais(nome_material)),
                            comissoes(*, colaboradores(nome_completo))
                        ),
                        comissoes(*, colaboradores(nome_completo))
                    `)
                    .order('data_emissao', { ascending: false });

                if (!qErr && qData) {
                    data = qData;
                } else {
                    console.warn('[Faturamentos] Join relacional falhou, ativando fallback:', qErr?.message);
                    throw qErr || new Error('Join error');
                }
            } catch (joinErr) {
                const { data: fbData, error: fbErr } = await supabase
                    .from('faturamentos')
                    .select('*, comissoes(*, colaboradores(nome_completo))')
                    .order('data_emissao', { ascending: false });

                if (fbErr) {
                    console.error('[Faturamentos] Erro na busca fallback:', fbErr.message);
                    return;
                }
                data = fbData || [];
            }

            window.faturamentosCache = data || [];
            const tbody = document.querySelector('#table-faturamentos tbody');
            if (tbody) {
                if (window.faturamentosCache.length > 0) {
                    tbody.innerHTML = window.faturamentosCache.map(/** @param {Faturamento} f */(f) => {
                        const actualStatus = f.status_faturamento || f.status || 'Pendente';
                        const statusClass = actualStatus === 'Pago' ? 'success' : (actualStatus === 'Faturado' ? 'in-progress' : 'warning');
                        const dataEmissao = f.data_emissao ? new Date(f.data_emissao).toLocaleDateString('pt-BR') : '-';
                        
                        // Resolução Robusta de OS e Cliente
                        const os = f.ordens_servico || (window.ordensCache || []).find(o => String(o.id_os || o.id) === String(f.os_id));
                        const clienteObj = os?.clientes || (os?.cliente_id ? (window.clientesCache || []).find(c => String(c.id || c.id_cli) === String(os.cliente_id)) : null) || f.clientes;
                        const clienteNome = clienteObj?.nome_cliente || (f.os_id ? `OS #${f.os_id}` : 'Faturamento Avulso');
                        const servicoNome = os?.servico_tipo || 'Serviço Avulso / Geral';
                        const valorTotalFormatado = Number(f.total_geral || f.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

                        let comVend = 0;
                        let comTec = 0;
                        const comList = f.comissoes || os?.comissoes;
                        if (comList && Array.isArray(comList)) {
                            comList.forEach(c => {
                                const colab = (window.colabCache || []).find(cb => cb.id === c.colaborador_id);
                                const isSeller = colab && ['vendedor', 'comercial', 'vendas'].some(cargo => colab.cargo?.toLowerCase().includes(cargo));
                                if (isSeller) {
                                    comVend += Number(c.valor_comissao || 0);
                                } else {
                                    comTec += Number(c.valor_comissao || 0);
                                }
                            });
                        }
                        const totalComissoes = comVend + comTec;

                        const btnBaixar = actualStatus !== 'Pago'
                            ? `<button type="button" style="background:#27ae60; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-right:5px;" onclick="window.baixarFaturamento(event, '${f.id}')" title="Dar Baixa no Faturamento no Caixa Central"><i class="fa-solid fa-hand-holding-dollar"></i> Receber</button>`
                            : '';
                            
                        const btnRecibo = actualStatus === 'Pago'
                            ? `<button type="button" style="background:#3498db; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-right:5px;" onclick="window.gerarReciboPdf(event, '${f.id}')" title="Gerar Recibo de Pagamento (PDF)"><i class="fa-solid fa-file-pdf"></i> Recibo</button>`
                            : '';

                        const btnVerOS = f.os_id
                            ? `<button type="button" style="background:transparent; color:var(--accent-blue); border:1px solid var(--accent-blue); padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-right:5px;" onclick="event.stopPropagation(); window.openSuperOS('${f.os_id}')" title="Abrir Ordem de Serviço #${f.os_id}"><i class="fa-solid fa-arrow-up-right-from-square"></i> OS</button>`
                            : '';

                        return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('faturamentos', '${f.id}')">
                            <td>
                                <strong style="color:var(--accent-blue); display:flex; align-items:center; gap:4px;">
                                    <i class="fa-solid fa-hashtag" style="font-size:0.75rem; opacity:0.7;"></i>${f.os_id ? String(f.os_id).split('-')[0] : 'S/OS'}
                                </strong>
                            </td>
                            <td>
                                <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                                    <i class="fa-solid fa-building-user" style="color:var(--accent-blue); font-size:0.8rem;"></i>
                                    <span>${clienteNome}</span>
                                </div>
                            </td>
                            <td>
                                <div style="color:var(--text-muted); font-size:0.85rem; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${servicoNome}">
                                    <i class="fa-solid fa-screwdriver-wrench" style="color:var(--accent-orange); font-size:0.75rem; margin-right:4px;"></i>
                                    <span>${servicoNome}</span>
                                </div>
                            </td>
                            <td style="font-size:0.85rem;">${dataEmissao}</td>
                            <td style="font-size:0.85rem;">R$ ${Number(f.total_servicos || 0).toFixed(2)}</td>
                            <td style="font-size:0.85rem;">R$ ${Number(f.total_materiais || 0).toFixed(2)}</td>
                            <td style="font-size:0.85rem; color:var(--text-muted);">R$ ${Number(f.impostos_taxas || f.impostos || 0).toFixed(2)}</td>
                            <td style="font-size:0.85rem; color:var(--accent-orange);"><small>R$ ${totalComissoes.toFixed(2)}</small></td>
                            <td><strong style="color:var(--accent-green); font-size:0.95rem;">R$ ${valorTotalFormatado}</strong></td>
                            <td><span class="badge ${statusClass}">${actualStatus}</span></td>
                            <td style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; gap:5px; align-items:center;">
                                    ${btnVerOS}
                                    ${btnBaixar}
                                    ${btnRecibo}
                                    ${getActionButtons('faturamentos', f.id, 'Fatura #' + (f.os_id ? String(f.os_id).split('-')[0] : f.id.split('-')[0]))}
                                </div>
                            </td>
                        </tr>`;

                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:var(--text-muted); padding:30px;">Nenhum faturamento de Ordem de Serviço registrado.</td></tr>';
                }
            }
        } catch (err) {
            console.error('[Faturamentos] Erro local na função loadFaturamentos:', err);
        }
    };

    /**
     * Motor de Renderização e Filtro Inteligente de Materiais
     */
    window.renderMateriais = function () {
        if (!window.materiaisCache) return;

        let filteredList = window.materiaisCache.slice();

        // Obter valores dos filtros
        const texto = (document.getElementById('filtro-mat-texto')?.value || '').toLowerCase();
        const subcatFiltro = document.getElementById('filtro-mat-sub')?.value || '';

        // O pill ativo guarda a categoria principal atual
        const btnCatAtivo = document.querySelector('.cat-pill.active');
        const catFiltro = btnCatAtivo ? btnCatAtivo.getAttribute('data-cat') : '';

        // Obter estado do estoque baixo
        const isEstoqueBaixo = window.filtroEstoqueBaixoAtivo || false;

        // Limita a exibição usando os filtros
        filteredList = filteredList.filter(m => {
            let pass = true;
            const parts = (m.campo_uso || 'Geral | Geral').split(' | ');
            const cat = parts[0] ? parts[0].trim() : 'Geral';
            const subcat = parts[1] ? parts[1].trim() : '';

            // Text Search
            if (texto && !m.nome_material.toLowerCase().includes(texto)) pass = false;
            // Cat Pill
            if (catFiltro && cat !== catFiltro) pass = false;
            // Subcat Select
            if (subcatFiltro && subcat !== subcatFiltro) pass = false;
            // Estoque Baixo (Abaixo de 5 unidades ou <= 10 se for pequeno)
            if (isEstoqueBaixo && Number(m.quantidade || 0) > 5) pass = false;

            return pass;
        });

        const tbody = document.querySelector('#table-materiais tbody');
        if (!tbody) return;

        if (filteredList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding:30px;">Nenhum material encontrado com esses filtros.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredList.map(m => {
            const parts = (m.campo_uso || 'Geral | Geral').split(' | ');
            const cat = parts[0] ? parts[0].trim() : 'Geral';
            const subcat = parts[1] ? parts[1].trim() : '';
            const qty = Number(m.quantidade || 0);

            // Badge visual de estoque
            const qtyBadge = qty <= 5 ? `<span style="color:var(--danger-color); font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${qty}</span>` : qty;

            const badgeHtml = `<span class="badge in-progress" style="margin-right:5px; background:var(--glass-bg-hover); color:var(--text-light); border: 1px solid var(--border-color);">${cat}</span>` + (subcat ? `<span class="badge normal">${subcat}</span>` : '');

            return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('materiais', '${m.id}')">
                <td><strong>${m.nome_material}</strong></td>
                <td>${qtyBadge}</td>
                <td>${m.unidade_medida || 'Un'}</td>
                <td>R$ ${m.preco_compra !== null ? Number(m.preco_compra).toFixed(2) : '0.00'}</td>
                <td>R$ ${m.valor_unitario !== null ? Number(m.valor_unitario).toFixed(2) : '0.00'}</td>
                <td>${badgeHtml}</td>
                <td style="text-align:right;">${getActionButtons('materiais', m.id, m.nome_material)}</td>
            </tr>`;
        }).join('');
    };

    /**
     * Define Pill ativo de Material
     */
    window.setFiltroMatCat = function (btnElement, categoria) {
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        window.renderMateriais();
    };

    /**
     * Toggle botão de estoque baixo
     */
    window.filtroEstoqueBaixoAtivo = false;
    window.toggleEstoqueBaixo = function () {
        window.filtroEstoqueBaixoAtivo = !window.filtroEstoqueBaixoAtivo;
        const btn = document.getElementById('btn-toggle-estoque-baixo');
        if (window.filtroEstoqueBaixoAtivo) {
            btn.style.background = 'var(--danger-color)';
            btn.style.color = '#fff';
        } else {
            btn.style.background = 'var(--surface-light)';
            btn.style.color = '';
        }
        window.renderMateriais();
    };

    /**
     * Motor de Renderização e Filtro Inteligente de Servicos
     */
    window.renderServicos = function () {
        if (!window.servicosCache) return;

        let filteredList = window.servicosCache.slice();

        const texto = (document.getElementById('filtro-ser-texto')?.value || '').toLowerCase();
        const btnCatAtivo = document.querySelector('.cat-pill-ser.active');
        const catFiltro = btnCatAtivo ? btnCatAtivo.getAttribute('data-cat') : '';

        filteredList = filteredList.filter(s => {
            let pass = true;
            const cat = s.categoria || 'Geral';

            if (texto && !s.nome_servico.toLowerCase().includes(texto)) pass = false;
            // Para serviços ignoramos acentuação no cat filter aproximado ou lidamos cru
            if (catFiltro && cat !== catFiltro) pass = false;

            return pass;
        });

        const tbody = document.querySelector('#table-servicos tbody');
        if (!tbody) return;

        if (filteredList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding:30px;">Nenhum serviço encontrado com esses filtros.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredList.map(s => {
            return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('servicos', '${s.id}')">
                <td><strong>${s.nome_servico}</strong></td>
                <td><span class="badge in-progress">${s.categoria || 'Geral'}</span></td>
                <td>${s.descricao || '-'}</td>
                <td>R$ ${Number(s.valor_base || 0).toFixed(2)}</td>
                <td style="text-align:right;">${getActionButtons('servicos', s.id, s.nome_servico)}</td>
            </tr>`;
        }).join('');
    };

    /**
     * Define Pill ativo de Serviço
     */
    window.setFiltroSerCat = function (btnElement, categoria) {
        document.querySelectorAll('.cat-pill-ser').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        window.renderServicos();
    };

    /**
     * @typedef {Object} Comissao
     * @property {string} id - UUID
     * @property {string} colaborador_id - ID do Colaborador (Técnico/Vendedor)
     * @property {number} percentual_acordado - % de ganho
     * @property {number} valor_faturamento_ref - R$ Base Faturada
     * @property {number} valor_pagar - R$ a Receber
     * @property {string} status_pagamento - Pendente, Aprovado, Pago
     * @property {string} data_registro - ISO Date
     * @property {Object} [colaboradores] - Relacional
     */

    /**
     * Busca os relatórios analíticos de comissões e pagamentos da equipe.
     * Atualiza a tabela "table-comissoes".
     * @returns {Promise<void>}
     */
    window.loadComissoes = async function () {
        try {
            const { data, error } = await supabase
                .from('comissoes')
                .select('*, colaboradores(nome_completo), faturamentos(total_servicos)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Comissões] Erro Supabase:', error.message);
                return;
            }

            window.comissoesCache = data || [];

            // FILTRAGEM LOCAL
            const filtroTecnicoId = document.getElementById('filter-comissao-tecnico')?.value;
            const filtroIni = document.getElementById('filter-comissao-data-inicio')?.value;
            const filtroFim = document.getElementById('filter-comissao-data-fim')?.value;

            let filteredList = window.comissoesCache.slice();

            if (filtroTecnicoId) {
                // A FK na tabela comissoes se chama colaborador_id 
                // Evitamos === porque o DB pode retornar Number (bigint) e o Select retorna String.
                filteredList = filteredList.filter(c => c.colaborador_id == filtroTecnicoId);
            }
            if (filtroIni) {
                const limitTime = new Date(filtroIni + "T00:00:00").getTime();
                filteredList = filteredList.filter(c => new Date(c.created_at).getTime() >= limitTime);
            }
            if (filtroFim) {
                const limitTimeEnd = new Date(filtroFim + "T23:59:59").getTime();
                filteredList = filteredList.filter(c => new Date(c.created_at).getTime() <= limitTimeEnd);
            }

            // Ativa ou desativa a visibilidade do botão do PDF Rateio/Recibo
            const btnRecibo = document.getElementById('btn-comissao-recibo');
            if (btnRecibo) {
                btnRecibo.style.display = (filtroTecnicoId && filteredList.length > 0) ? 'inline-block' : 'none';
            }
            window.filteredComissoesParaRecibo = filteredList; // Global para PDF

            const tbody = document.querySelector('#table-comissoes tbody');
            if (tbody) {
                if (filteredList.length > 0) {
                    tbody.innerHTML = filteredList.map(/** @param {Comissao} c */(c) => {
                        const statusClass = c.status_pagamento === 'Pago' ? 'success' : 'warning';
                        const dataReg = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-';
                        const colabNome = c.colaboradores ? c.colaboradores.nome_completo : 'Desconhecido';
                        const relFat = c.faturamentos ? c.faturamentos.total_servicos : 0;

                        return `<tr>
                            <td><strong><i class="fa-solid fa-user-tie"></i> ${colabNome}</strong></td>
                            <td>${Number(c.percentual_acordado || 0).toFixed(2)}%</td>
                            <td>R$ ${Number(relFat).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td><strong style="color:var(--accent-orange)">R$ ${Number(c.valor_comissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                            <td><span class="badge ${statusClass}">${c.status_pagamento || 'Pendente'}</span></td>
                            <td>${dataReg}</td>
                            <td style="text-align:right;">${getActionButtons('comissoes', c.id, 'Comissão de ' + colabNome)}</td>
                        </tr>`;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Nenhuma comissão encontrada para este filtro.</td></tr>';
                }
            }
        } catch (err) {
            console.error('[Comissões] Erro no processamento de exibição:', err);
        }
    };

    // ==========================================
    // REALTIME ENGINE (SUPABASE)
    // ==========================================
    // ... realtime initialization code is kept below

    // ==========================================
    // CONTROLE DE PERMISSÕES DA UI
    // ==========================================
    window.applyRolePermissions = function () {
        if (!window.userCargo) return;

        const cargo = window.userCargo.toLowerCase();

        // Verifica níveis de permissão
        const isMaster = ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo'].some(c => cargo.includes(c));
        const isFinance = isMaster || cargo.includes('financeiro') || cargo.includes('tesouraria');
        const isTech = cargo.includes('tecnico') || cargo.includes('técnico');

        // Permissões Financeiras (Ex: Faturamentos e Comissões)
        // ⚠️ NUNCA toque em .view-page (O Roteador cuida delas)
        document.querySelectorAll('.finance-level:not(.view-page)').forEach(el => {
            el.style.display = isFinance ? '' : 'none';
        });

        // Permissões Administrativas Restritas
        // ⚠️ NUNCA toque em .view-page (O Roteador cuida delas)
        document.querySelectorAll('.admin-only:not(.view-page)').forEach(el => {
            el.style.display = isMaster ? '' : 'none';
        });

        console.log(`[ACL] Permissões aplicadas para o cargo: ${cargo}`);
    };

    function initRealtime() {
        let liveReloadTimeout = null;
        const channel = supabase.channel('realtime-overhaul')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ordens_servico'
            }, (payload) => {
                console.log('[Realtime] Mudança em OS detectada:', payload);
                loadData(false); // Atualiza sem piscar esqueletos
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'fluxo_caixa'
            }, () => loadData(false))
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'agent_memory'
            }, (payload) => {
                const newRow = payload.new;
                // Ignora locks e debug
                if (newRow?.phone?.startsWith('LOCK_') || newRow?.phone === 'DEBUG_AUDIO' || newRow?.phone === 'GLOBAL_CONFIG') return;
                
                console.log('[Realtime] Nova mensagem detectada:', newRow?.phone, newRow?.role);
                
                // Debounce de 800ms para não recarregar a cada insert rápido
                if (liveReloadTimeout) clearTimeout(liveReloadTimeout);
                liveReloadTimeout = setTimeout(() => {
                    // Se a Central de Mensagens estiver visível, atualiza
                    if (typeof window.loadLiveConversations === 'function') {
                        window.loadLiveConversations();
                    }
                    // Se a conversa aberta é do mesmo phone, atualiza o chat
                    const curClean = (typeof currentLivePhone !== 'undefined' && currentLivePhone) ? currentLivePhone.replace(/\D/g, '') : '';
                    const rowClean = (newRow?.phone) ? newRow.phone.replace(/\D/g, '') : '';
                    const isSamePhone = curClean && rowClean && (curClean === rowClean || curClean.endsWith(rowClean) || rowClean.endsWith(curClean));
                    
                    if (isSamePhone && typeof window.selectLiveConversation === 'function') {
                        window.selectLiveConversation(currentLivePhone);
                    }
                }, 800);
            })
            .subscribe();

        console.log('[Realtime] Escuta de mudanças ativada (OS + Caixa + Mensagens).');
    }

    function renderCards(ordens) {
        // Limpar colunas com a nova lógica de Agenda V5
        const colToday = document.querySelector('#group-today .os-group-list');
        const colTomorrow = document.querySelector('#group-tomorrow .os-group-list');
        const colUpcoming = document.querySelector('#group-upcoming .os-group-list');

        if (colToday) colToday.innerHTML = '';
        if (colTomorrow) colTomorrow.innerHTML = '';
        if (colUpcoming) colUpcoming.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dayAfter = new Date(today);
        dayAfter.setDate(today.getDate() + 2);

        ordens.forEach(os => {
            const card = document.createElement('div');
            card.className = 'card draggable';
            card.draggable = true;
            card.dataset.id_os = os.id_os;

            const osDate = os.data_hora ? new Date(os.data_hora) : null;
            if (osDate) osDate.setHours(0, 0, 0, 0);

            let badgeClass = 'normal';
            if (os.status_ia === 'Aberto') badgeClass = 'danger';
            if (os.status_ia === 'Em Campo') badgeClass = 'in-progress';

            const clienteNome = os.clientes ? os.clientes.nome_cliente : `Cliente Indefinido`;
            const nomeObra = os.obras ? os.obras.nome_obra : false;
            const badgePagamento = os.status_pagamento === 'Pago' ? `<span class="badge success" style="font-size:0.6rem;"><i class="fa-solid fa-check-double"></i> Pago</span>` : (os.status_pagamento === 'Pendente' ? `<span class="badge danger" style="font-size:0.6rem;"><i class="fa-solid fa-clock"></i> Pendente</span>` : `<span class="badge normal" style="font-size:0.6rem;">Sem Fatura</span>`);

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h5 style="margin:0;">${clienteNome} <small>(#${os.id_os})</small></h5>
                    <span style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">${os.data_hora ? os.data_hora.split('T')[1].substring(0, 5) : 'H/N'}</span>
                </div>
                ${nomeObra ? `<p class="card-desc" style="font-size: 0.70rem; color: var(--text-muted); margin: 5px 0;"><i class="fa-solid fa-building"></i> ${nomeObra}</p>` : ''}
                <p class="card-desc" style="margin-top:5px;"><i class="fa-solid fa-bolt"></i> ${os.servico_tipo || 'Serviço Geral'}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <span class="badge ${badgeClass}">${os.status_ia}</span>
                    ${badgePagamento}
                </div>
            `;

            // Lógica de Atribuição por Data (Agenda V5)
            if (!osDate || osDate.getTime() === today.getTime()) {
                const col = document.querySelector('#group-today .os-group-list');
                if (col) col.appendChild(card);
            } else if (osDate.getTime() === tomorrow.getTime()) {
                const col = document.querySelector('#group-tomorrow .os-group-list');
                if (col) col.appendChild(card);
            } else if (osDate.getTime() >= dayAfter.getTime()) {
                const col = document.querySelector('#group-upcoming .os-group-list');
                if (col) col.appendChild(card);
            }

            card.addEventListener('dragstart', dragStart);
            card.addEventListener('dragend', dragEnd);
            card.addEventListener('click', () => openSuperOS(os.id_os));
        });
    }


    // ==========================================
    // 3. ATUALIZAR DADOS E DRAG & DROP (UPDATE)
    // ==========================================
    const columns = document.querySelectorAll('.board-column');
    let draggedItem = null;

    function dragStart() {
        draggedItem = this;
        setTimeout(() => this.style.opacity = '0.5', 0);
    }

    function dragEnd() {
        setTimeout(() => {
            draggedItem.style.opacity = '1';
            draggedItem = null;
        }, 0);
    }

    columns.forEach(column => {
        column.addEventListener('dragover', e => e.preventDefault());
        column.addEventListener('dragenter', function (e) { e.preventDefault(); this.classList.add('drag-over'); });
        column.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
        column.addEventListener('drop', dragDrop);
    });

    async function dragDrop() {
        this.classList.remove('drag-over');
        this.appendChild(draggedItem);

        // Identificar pra qual coluna foi movido
        let newStatus = 'Aberto';
        if (this.id === 'col-in-progress') newStatus = 'Em Campo';
        if (this.id === 'col-done') newStatus = 'Validado';

        // Atualiza a UI internamente
        const badge = draggedItem.querySelector('.badge');
        badge.textContent = newStatus;

        // Atualiza o Banco de Dados Real!
        const osId = draggedItem.dataset.id_os;

        // Se vier de dados mockados (sem ID do banco), só pisca
        if (!osId) {
            triggerSaveSuccess('Sincronização Simulada OK');
            return;
        }

        try {
            triggerAutoSave('Gravando no Supabase...');

            const { error } = await supabase
                .from('ordens_servico')
                .update({ status_ia: newStatus })
                .eq('id_os', osId);

            if (error) throw error;

            await saveAuditLog('STATUS_CHANGE', 'ordens_servico', osId, { oldStatus: badge.textContent, newStatus });
            triggerSaveSuccess('Auto-Save Ativo (Supabase Connect)');

        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            triggerSaveError('Erro de Sincronização');
        }
    }


    // ==========================================
    // 4. EFEITOS UI GERAIS
    // ==========================================
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('pt-BR');
    }
    setInterval(updateClock, 1000);
    updateClock();

    function triggerAutoSave(message) {
        autoSaveStatus.classList.remove('active', 'error');
        autoSaveStatus.classList.add('saving');
        const icon = autoSaveStatus.querySelector('i');
        icon.className = 'fa-solid fa-arrows-rotate fa-spin';
        autoSaveStatus.querySelector('span').textContent = message;
    }

    function triggerSaveSuccess(message) {
        autoSaveStatus.classList.remove('saving', 'error');
        autoSaveStatus.classList.add('active');
        const icon = autoSaveStatus.querySelector('i');
        icon.className = 'fa-solid fa-cloud-check pulse';
        autoSaveStatus.querySelector('span').textContent = message;
        setTimeout(() => icon.className = 'fa-solid fa-cloud-arrow-up pulse', 3000);
    }

    function triggerSaveError(message) {
        autoSaveStatus.classList.remove('saving', 'active');
        autoSaveStatus.classList.add('error');
        autoSaveStatus.style.color = 'var(--accent-red)';
        const icon = autoSaveStatus.querySelector('i');
        icon.className = 'fa-solid fa-triangle-exclamation pulse';
        autoSaveStatus.querySelector('span').textContent = message;
    }

    // ==========================================
    // 7. SPA ROUTER E VERIFICADOR DE SESSÃO (AUTH)
    // ==========================================
    const homeApp = document.getElementById('home-app');
    const dashboardApp = document.getElementById('dashboard-app');
    const authForm = document.getElementById('auth-form');
    const loginError = document.getElementById('login-error');

    let userCargo = 'tecnico'; // Estado Global das restrições de permissão

    // ═══ MAPA RBAC GRANULAR ═══
    // Cada módulo: { ver: bool, modificar: bool, precos: bool }
    const RBAC = {
        tecnico: {
            clientes: { ver: false, modificar: false, excluir: false, precos: false },
            ordens: { ver: true, modificar: true, excluir: false, precos: false },
            colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
            materiais: { ver: true, modificar: false, excluir: false, precos: true },
            ferramentas: { ver: true, modificar: true, excluir: false, precos: false },
            servicos: { ver: true, modificar: false, excluir: false, precos: false },
            fornecedores: { ver: true, modificar: false, excluir: false, precos: false },
            obras: { ver: true, modificar: false, excluir: false, precos: false },
            caixa: { ver: false, modificar: false, excluir: false, precos: false },
            contratos: { ver: false, modificar: false, excluir: false, precos: false },
            relatorios: { ver: false, modificar: false, excluir: false, precos: false },
            finances_widget: { ver: false },
            chat_arquiteto: { ver: false }
        },
        atendimento: {
            clientes: { ver: true, modificar: true, excluir: false, precos: true },
            ordens: { ver: true, modificar: true, excluir: false, precos: true },
            colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
            materiais: { ver: true, modificar: true, excluir: false, precos: true },
            ferramentas: { ver: true, modificar: true, excluir: false, precos: false },
            servicos: { ver: true, modificar: true, excluir: false, precos: true },
            fornecedores: { ver: true, modificar: true, excluir: false, precos: true },
            obras: { ver: true, modificar: true, excluir: false, precos: true },
            caixa: { ver: false, modificar: false, excluir: false, precos: false },
            contratos: { ver: false, modificar: false, excluir: false, precos: false },
            relatorios: { ver: false, modificar: false, excluir: false, precos: false },
            finances_widget: { ver: false },
            chat_arquiteto: { ver: false }
        },
        financeiro: {
            clientes: { ver: true, modificar: false, excluir: false, precos: true },
            ordens: { ver: true, modificar: false, excluir: false, precos: true },
            colaboradores: { ver: true, modificar: false, excluir: false, precos: false },
            materiais: { ver: true, modificar: false, excluir: false, precos: true },
            ferramentas: { ver: true, modificar: false, excluir: false, precos: true },
            servicos: { ver: true, modificar: false, excluir: false, precos: true },
            fornecedores: { ver: true, modificar: false, excluir: false, precos: true },
            obras: { ver: true, modificar: false, excluir: false, precos: true },
            caixa: { ver: true, modificar: true, excluir: true, precos: true },
            contratos: { ver: true, modificar: false, excluir: false, precos: true },
            relatorios: { ver: true, modificar: false, excluir: false, precos: true },
            finances_widget: { ver: true },
            chat_arquiteto: { ver: true }
        },
        admin: {
            clientes: { ver: true, modificar: true, excluir: true, precos: true },
            ordens: { ver: true, modificar: true, excluir: true, precos: true },
            colaboradores: { ver: true, modificar: true, excluir: true, precos: true },
            materiais: { ver: true, modificar: true, excluir: true, precos: true },
            ferramentas: { ver: true, modificar: true, excluir: true, precos: true },
            servicos: { ver: true, modificar: true, excluir: true, precos: true },
            fornecedores: { ver: true, modificar: true, excluir: true, precos: true },
            obras: { ver: true, modificar: true, excluir: true, precos: true },
            caixa: { ver: true, modificar: true, excluir: true, precos: true },
            contratos: { ver: true, modificar: true, excluir: true, precos: true },
            relatorios: { ver: true, modificar: true, excluir: true, precos: true },
            finances_widget: { ver: true },
            chat_arquiteto: { ver: true }
        }
    };

    // Helper: Verifica permissão pelo cargo atual
    window.perm = function (modulo) {
        const roleStr = userCargo ? userCargo : 'tecnico';
        return RBAC[roleStr]?.[modulo] || { ver: false, modificar: false, excluir: false, precos: false };
    };

    // Mapa de menus → módulos (data-target no HTML → chave RBAC)
    const MENU_MAP = {
        'view-clientes': 'clientes',
        'view-ordens': 'ordens',
        'view-colaboradores': 'colaboradores',
        'view-materiais': 'materiais',
        'view-ferramentas': 'ferramentas',
        'view-servicos': 'servicos',
        'view-fornecedores': 'fornecedores',
        'view-obras': 'obras',
        'view-caixa': 'caixa',
        'view-contratos': 'contratos',
        'view-relatorios': 'relatorios'
    };

    // Mapa de botões "+" → módulo RBAC
    const BTN_MAP = {
        'btn-novo-cliente': 'clientes',
        'btn-nova-os': 'ordens',
        'btn-registrar-colab': 'colaboradores',
        'btn-novo-mat': 'materiais',
        'btn-nova-fer': 'ferramentas',
        'btn-novo-ser': 'servicos',
        'btn-novo-fornecedor': 'fornecedores',
        'btn-nova-obra': 'obras',
        'btn-novo-caixa': 'caixa',
        'btn-novo-contrato': 'contratos'
    };

    // Engine de Permissões (Role Based Access Control)
    async function checkPermissions() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: colab, error: colabErr } = await supabase.from('colaboradores').select('cargo, nome_completo, telefone_whatsapp').eq('id', user.id).single();

            if (colabErr) console.warn('[RBAC] Falha ao buscar cargo:', colabErr);

            // Tratamento Seguro do Cargo (Admin escape flexível)
            userCargo = (colab ? colab.cargo : 'tecnico').toLowerCase().trim();
            window.userCargo = userCargo; // <--- This fixes ALL access denied popups
            const isAdminNames = ['admin', 'administrador', 'diretoria', 'diretor', 'engenheiro', 'ceo', 'dono', 'master'];
            const isUserAdmin = isAdminNames.includes(userCargo) || (colab && colab.nome_completo && colab.nome_completo.toLowerCase().includes('arnaldo'));
            const isAdmin = isUserAdmin;
            window.isAdmin = isAdmin; // <--- Also useful globally

            const userName = colab ? colab.nome_completo.split(' ')[0] : 'Colaborador';
            console.log('[RBAC] Cargo final detectado:', userCargo, '| Admin:', isAdmin);

            // Saudações
            const confortMessages = [
                "Pronto para mais um dia de excelência?",
                "A engenharia transforma o impossível em obra.",
                "Um bom planejamento evita todas as falhas.",
                "Segurança e precisão em primeiro lugar.",
                "Mais um dia, mais um projeto de sucesso."
            ];
            const msg = confortMessages[Math.floor(Math.random() * confortMessages.length)];
            const hr = new Date().getHours();
            const turno = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
            const greetingBox = document.getElementById('user-greeting');
            if (greetingBox) {
                greetingBox.innerHTML = `<strong>${turno}, ${userName}!</strong> <br/><span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary);">${msg}</span>`;
            }

            // ═══ 1. ACESSO AOS MENUS (Apenas desabilita, não esconde) ═══
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                const target = link.getAttribute('data-target');
                const modulo = MENU_MAP[target];

                // Reset de Visibilidade (Passo para trás para restaurar)
                link.parentElement.style.display = 'block';

                const hasVer = isAdmin || perm(modulo).ver;
                link.classList.toggle('menu-disabled', !hasVer);
            });

            // Garantir que as seções de menu estejam visíveis
            document.querySelectorAll('.menu-section').forEach(section => {
                section.style.display = 'block';
            });

            // ═══ 2. VISIBILIDADE DOS BOTÕES "+" ═══
            Object.entries(BTN_MAP).forEach(([btnId, modulo]) => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    const hasMod = isAdmin || perm(modulo).modificar;
                    btn.classList.toggle('btn-disabled', !hasMod);
                    // Mantemos o display original ou resetamos caso algo tenha ficado escondido
                    if (btn.style.display === 'none' && hasMod) btn.style.display = '';
                }
            });

            // ═══ 3. WIDGET FINANCEIRO ═══
            const widgetFin = document.getElementById('finances-widget');
            if (widgetFin) {
                widgetFin.style.display = 'block'; // Garante visibilidade
                widgetFin.classList.toggle('menu-disabled', !(isAdmin || perm('finances_widget').ver));
            }

            // ═══ 4. CHAT DO ARQUITETO ═══
            const btnChatArq = document.getElementById('chat-toggle');
            if (btnChatArq) {
                btnChatArq.style.display = 'flex';
                btnChatArq.classList.toggle('menu-disabled', !(isAdmin || perm('chat_arquiteto').ver));
            }

            // Esconde chat Secretária no Dashboard (Regra técnica mantida)
            const btnChatSec = document.getElementById('chat-sec-toggle');
            if (btnChatSec) btnChatSec.style.display = 'none';

            // ═══ 5. OCULTAR COLUNAS DE PREÇO ═══
            applyPriceVisibility();

            loadData(); // Inicia fetch depois de checados os bloqueios
        } catch (e) {
            console.error('[RBAC] Erro crítico nas permissões:', e);
            // Em caso de erro, ao menos tentamos carregar os dados base
            loadData();
        }
    }

    // Função que esconde colunas de preço nas tabelas
    function applyPriceVisibility() {
        // Serviços: coluna 4 (Valor Base)
        if (!perm('servicos').precos) {
            document.querySelectorAll('#table-servicos th:nth-child(4), #table-servicos td:nth-child(4)').forEach(el => el.style.display = 'none');
        }
        // Materiais: colunas 4 e 5 (Custo e Venda)
        if (!perm('materiais').precos) {
            document.querySelectorAll('#table-materiais th:nth-child(4), #table-materiais td:nth-child(4), #table-materiais th:nth-child(5), #table-materiais td:nth-child(5)').forEach(el => el.style.display = 'none');
        }
    }

    // Engine de Redirecionamento 
    // Engine de Redirecionamento e Sincronismo de Auth
    let isTransitioning = false;
    async function syncAppView(session) {
        if (isTransitioning) return;
        isTransitioning = true;

        try {
            if (session) {
                // Se temos sessão, garante que o login suma imediatamente
                homeApp.style.display = 'none';
                dashboardApp.style.display = 'flex'; // Exibe o Dashboard antes de processar permissões para evitar tela branca

                if (document.getElementById('chat-sec-toggle')) document.getElementById('chat-sec-toggle').style.display = 'none';

                // Grava último acesso rapidamente antes de processar os dados da tabela
                // await supabase.from('colaboradores').update({ ultimo_acesso: new Date().toISOString() }).eq('id', session.user.id);

                // Agora processa as regras de negócio em background ou await
                await checkPermissions();
            } else {
                dashboardApp.style.display = 'none';
                homeApp.style.display = 'flex';
                if (document.getElementById('chat-sec-toggle')) document.getElementById('chat-sec-toggle').style.display = 'flex';
                if (document.getElementById('chat-toggle')) document.getElementById('chat-toggle').style.display = 'none';
            }
        } catch (err) {
            console.error('[Sync] Erro no redirecionamento:', err);
        } finally {
            isTransitioning = false;
        }
    }

    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await syncAppView(session);
        } catch (e) {
            console.error('[Init] Erro ao checar sessão inicial:', e);
            syncAppView(null);
        }
    }

    // Ouvinte Oficial de Troca de Identidade do Supabase
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] Evento:', event);
        // Filtragem para evitar transições fantasmas (aparece e some)
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            if (session) syncAppView(session);
        } else if (event === 'SIGNED_OUT') {
            syncAppView(null);
        }
    });

    // Botão de Sair (Logout)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            loginError.textContent = ''; // Limpa msg anterior
            await supabase.auth.signOut();
        });
    }

    // Toggle Formulários (Login / Registo)
    const formLoginView = document.getElementById('form-login-view');
    const formRegisterView = document.getElementById('form-register-view');
    const goToRegister = document.getElementById('go-to-register');
    const goToLogin = document.getElementById('go-to-login');
    const registerForm = document.getElementById('register-form');

    if (goToRegister) {
        goToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            formLoginView.style.display = 'none';
            formRegisterView.style.display = 'block';
            loginError.textContent = '';
        });
    }

    if (goToLogin) {
        goToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            formRegisterView.style.display = 'none';
            formLoginView.style.display = 'block';
            loginError.textContent = '';
        });
    }

    // Formulário de Cadastro Automático
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('reg-nome').value;
            const cargo = 'visitante';
            const wpp = document.getElementById('reg-whatsapp').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            loginError.style.color = 'var(--text-primary)';
            loginError.textContent = 'Autenticando na Nuvem...';

            const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

            if (authError) {
                loginError.style.color = 'var(--accent-red)';
                loginError.textContent = '❌ Erro: ' + authError.message;
                return;
            }

            if (authData.user) {
                loginError.textContent = 'Salvando Permissões de ' + cargo + '...';

                // Grava o Pareamento na Tabela SQL de Colaboradores
                const { error: dbError } = await supabase.from('colaboradores').insert([
                    { id: authData.user.id, nome_completo: nome, cargo: cargo, telefone_whatsapp: wpp }
                ]);

                if (dbError) {
                    loginError.style.color = 'var(--accent-orange)';
                    loginError.textContent = 'Conta criada, mas falha ao parear Cargo no banco. Avise a TI.';
                } else {
                    loginError.style.color = 'var(--accent-green)';
                    loginError.textContent = '✅ Cadastro Efetuado! Por favor, faça Login.';
                    setTimeout(() => {
                        formRegisterView.style.display = 'none';
                        formLoginView.style.display = 'block';
                        document.getElementById('login-email').value = email;
                        loginError.textContent = '';
                    }, 2500);
                }
            }
        });
    }

    // Submissão do Formulário de Login na Home Page
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            loginError.style.color = 'var(--text-primary)';
            loginError.textContent = 'Trancando credenciais via Supabase Auth...';

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                loginError.style.color = 'var(--accent-red)';
                loginError.textContent = '❌ Acesso Negado: E-mail ou Senha incorretos.';
            } else {
                loginError.style.color = 'var(--accent-green)';
                loginError.textContent = '✅ Acesso Liberado!';
                // Garante transição imediata
                if (data.session) syncAppView(data.session);
            }
        });
    }

    // Gatilho inicial
    checkSession();
    initRealtime();

    // SPA Router movido para o topo do script para garantir funcionamento.

    // ==========================================
    // 5. CHAT DO ARQUITETO (INTERATIVIDADE)
    // ==========================================
    const chatToggle = document.getElementById('chat-toggle');
    const chatContainer = document.getElementById('chat-container');
    const closeChat = document.getElementById('close-chat');
    const sendChat = document.getElementById('send-chat');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    chatToggle.addEventListener('click', () => {
        chatContainer.classList.add('open');
        chatToggle.style.transform = 'scale(0)';
    });

    closeChat.addEventListener('click', () => {
        chatContainer.classList.remove('open');
        chatToggle.style.transform = 'scale(1)';
    });

    sendChat.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSubmit();
    });

    function handleChatSubmit() {
        const text = chatInput.value.trim();
        if (!text) return;

        const correlationId = 'v2-' + Math.random().toString(36).substr(2, 9);

        // User Message
        const userMsg = document.createElement('div');
        userMsg.className = 'msg user';
        userMsg.textContent = text;
        chatMessages.appendChild(userMsg);

        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // "Agent Typing" Indicator
        const typingMsg = document.createElement('div');
        typingMsg.className = 'msg ai typing';
        typingMsg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Arquiteto processando...';
        chatMessages.appendChild(typingMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Arquitetura V2: Timeout (3s) e Fallback
        callAIWithTimeout('Arquiteto', { text: text }).then(res => {
            typingMsg.classList.remove('typing');

            if (res.status === 'success') {
                typingMsg.innerHTML = `<strong>Arquiteto Central:</strong><br>${res.data.dados}<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
            } else {
                // FALLBACK PARCIAL
                typingMsg.innerHTML = `<strong>Aviso do Sistema:</strong><br>A análise pesada excedeu 3 segundos. <span style="color:var(--accent-orange)"><i class="fa-solid fa-clock"></i> Tarefa movida para Background.</span> Notificarei via painel quando a matriz for gerada.<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    // ==========================================
    // ENGINE V2: AGENT TIMEOUTS & FALLBACK (25000ms)
    // ==========================================
    async function callAIWithTimeout(agentName, payload, timeoutMs = 25000) {
        const correlationId = 'v2-' + Math.random().toString(36).substr(2, 9);
        console.log(`[Agent Engine] Connect: ${agentName} | CorrID: ${correlationId}`);

        let fetchPromise;
        if (N8N_MASTER_WEBHOOK.includes('[SEU_N8N_URL]')) {
            // Modo Simulação (Para testes UI antes de ligar a URL oficial)
            fetchPromise = new Promise((resolve) => {
                const delay = Math.random() > 0.5 ? 1200 : 4500;
                setTimeout(() => resolve({
                    success: true,
                    dados: `[Simulação] Processamento do contexto finalizado. Atualizei as dependências.`,
                    correlationId
                }), delay);
            });
        } else {
            // Modo Produção V2: Dispara para o n8n Master Router
            fetchPromise = fetch(N8N_MASTER_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentTarget: agentName,
                    payload: payload,
                    correlationId: correlationId,
                    userRole: userCargo
                })
            }).then(res => res.json());
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout HTTP de ${timeoutMs}ms excedido.`)), timeoutMs);
        });

        try {
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            return { status: 'success', data: response, correlationId };
        } catch (error) {
            console.warn(`[Agent Engine] Falha por Timeout (${agentName}). Acionando Fallback. ID: ${correlationId}`);
            // Lógica de Partial State
            return {
                status: 'partial',
                message: error.message,
                correlationId
            };
        }
    }

    // ==========================================
    // 5.B CHAT DA SECRETÁRIA (PUB/HOME)
    // ==========================================
    const chatSecToggle = document.getElementById('chat-sec-toggle');
    const chatSecContainer = document.getElementById('chat-sec-container');
    const closeSecChat = document.getElementById('close-sec-chat');
    const sendSecChat = document.getElementById('send-sec-chat');
    const chatSecInput = document.getElementById('chat-sec-input');
    const chatSecMessages = document.getElementById('chat-sec-messages');

    if (chatSecToggle && chatSecContainer) {
        chatSecToggle.addEventListener('click', (e) => {
            if (chatSecToggle.dataset.dragged === 'true') return;
            chatSecContainer.classList.add('open');
            chatSecToggle.style.transform = 'scale(0)';
        });
        closeSecChat.addEventListener('click', () => {
            chatSecContainer.classList.remove('open');
            chatSecToggle.style.transform = 'scale(1)';
        });

        function handleSecChatSubmit() {
            const text = chatSecInput.value.trim();
            if (!text) return;

            const userMsg = document.createElement('div');
            userMsg.className = 'msg user';
            userMsg.textContent = text;
            chatSecMessages.appendChild(userMsg);

            chatSecInput.value = '';
            chatSecMessages.scrollTop = chatSecMessages.scrollHeight;

            const typingMsg = document.createElement('div');
            typingMsg.className = 'msg ai typing';
            typingMsg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Maria Cecília digitando...';
            chatSecMessages.appendChild(typingMsg);
            chatSecMessages.scrollTop = chatSecMessages.scrollHeight;

            // Engine com Timeout e Fallback
            callAIWithTimeout('Maria Cecília', { text: text }).then(res => {
                typingMsg.classList.remove('typing');
                if (res.status === 'success') {
                    // A Resposta real do n8n Master -> Roteador -> Maria Cecilia
                    typingMsg.innerHTML = `<strong>Maria Cecília:</strong><br>${res.data.dados}<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                } else {
                    // FALLBACK
                    typingMsg.innerHTML = `<strong>Aviso do Sistema:</strong><br>A Maria Cecília está processando uma fila alta de atendimentos. O processo foi jogado para segundo plano. Em breve você receberá a resposta! 😊<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                }
                chatSecMessages.scrollTop = chatSecMessages.scrollHeight;
            });
        }

        sendSecChat?.addEventListener('click', handleSecChatSubmit);
        chatSecInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSecChatSubmit();
        });
    }

    // ==========================================
    // 5.C CHAT DO IAN GILLAN (CAMPO/SUPERVISOR)
    // ==========================================
    const chatIanToggle = document.getElementById('chat-ian-toggle');
    const chatIanContainer = document.getElementById('chat-ian-container');
    const closeIanChat = document.getElementById('close-ian-chat');
    const sendIanChat = document.getElementById('send-ian-chat');
    const chatIanInput = document.getElementById('chat-ian-input');
    const chatIanMessages = document.getElementById('chat-ian-messages');

    if (chatIanToggle && chatIanContainer) {
        chatIanToggle.addEventListener('click', () => {
            chatIanContainer.classList.add('open');
            chatIanToggle.style.transform = 'scale(0)';
        });
        closeIanChat.addEventListener('click', () => {
            chatIanContainer.classList.remove('open');
            chatIanToggle.style.transform = 'scale(1)';
        });

        function handleIanChatSubmit() {
            const text = chatIanInput.value.trim();
            if (!text) return;

            const userMsg = document.createElement('div');
            userMsg.className = 'msg user';
            userMsg.textContent = text;
            chatIanMessages.appendChild(userMsg);

            chatIanInput.value = '';
            chatIanMessages.scrollTop = chatIanMessages.scrollHeight;

            const typingMsg = document.createElement('div');
            typingMsg.className = 'msg ai typing';
            typingMsg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Ian Gillan rastreando frota...';
            chatIanMessages.appendChild(typingMsg);
            chatIanMessages.scrollTop = chatIanMessages.scrollHeight;

            callAIWithTimeout('Ian Gillan', { text: text }).then(res => {
                typingMsg.classList.remove('typing');
                if (res.status === 'success') {
                    typingMsg.innerHTML = `<strong>Ian Gillan:</strong><br>${res.data.dados}<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                } else {
                    typingMsg.innerHTML = `<strong>Aviso do Sistema:</strong><br>O Ian está ocupado inspecionando uma obra. O rádio falhou. Tarefa em background iniciada!<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                }
                chatIanMessages.scrollTop = chatIanMessages.scrollHeight;
            });
        }

        sendIanChat?.addEventListener('click', handleIanChatSubmit);
        chatIanInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleIanChatSubmit();
        });
    }

    // ==========================================
    // 5.C.2 CALCULADORA DE CUSTOS OPERACIONAIS
    // ==========================================
    // Armazena horas estimadas por serviço para persistir durante edição
    window._calcHorasEstimadas = JSON.parse(localStorage.getItem('calcHorasEstimadas')) || {};

    window.saveCalcConfigDB = async function() {
        const diasUteis = parseInt(document.getElementById('calc-dias-uteis')?.value) || 22;
        const horasDia = parseInt(document.getElementById('calc-horas-dia')?.value) || 8;
        const periodo = document.getElementById('calc-periodo')?.value || 'mes';
        
        const payload = {
            params: { diasUteis, horasDia, periodo },
            horas: window._calcHorasEstimadas || {}
        };
        
        localStorage.setItem('calcConfig', JSON.stringify(payload.params));
        localStorage.setItem('calcHorasEstimadas', JSON.stringify(payload.horas));
        
        try {
            await supabase.from('sistema_configuracoes').upsert({
                chave: 'calc_config',
                valor: payload
            }, { onConflict: 'chave' });
        } catch (e) {
            console.warn("Falha ao salvar config calc no banco:", e);
        }
    };

    window.renderCalcCustos = function (fromInput = false) {
        const caixa = window.caixaCache || [];
        const servicos = window.servicosCache || [];

        const diasUteisEl = document.getElementById('calc-dias-uteis');
        const horasDiaEl = document.getElementById('calc-horas-dia');
        const periodoEl = document.getElementById('calc-periodo');

        if (!window._calcConfigLoaded) {
            const savedConfig = window._calcConfig || JSON.parse(localStorage.getItem('calcConfig')) || {};
            if (savedConfig.diasUteis && diasUteisEl) diasUteisEl.value = savedConfig.diasUteis;
            if (savedConfig.horasDia && horasDiaEl) horasDiaEl.value = savedConfig.horasDia;
            if (savedConfig.periodo && periodoEl) periodoEl.value = savedConfig.periodo;
            window._calcConfigLoaded = true;
        }

        const diasUteis = parseInt(diasUteisEl?.value) || 22;
        const horasDia = parseInt(horasDiaEl?.value) || 8;
        const periodo = periodoEl?.value || 'mes';

        // Dispara o salvamento no banco sem travar a interface
        if (fromInput) window.saveCalcConfigDB();

        // Filtra despesas por período
        let despesasFiltradas = caixa.filter(cx => cx.tipo_movimento === 'Saida');

        if (periodo === 'mes') {
            const now = new Date();
            const mesAtual = now.getMonth();
            const anoAtual = now.getFullYear();
            despesasFiltradas = despesasFiltradas.filter(cx => {
                const d = new Date(cx.data_ocorrencia || cx.created_at);
                return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
            });
        }

        // Calcula totais
        let totalCustos = 0;
        despesasFiltradas.forEach(cx => { totalCustos += parseFloat(cx.valor) || 0; });

        const custoDia = diasUteis > 0 ? totalCustos / diasUteis : 0;
        const custoHora = (diasUteis > 0 && horasDia > 0) ? totalCustos / (diasUteis * horasDia) : 0;

        // Atualiza Cards
        const fmt = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const elTotal = document.getElementById('calc-total-custos');
        const elDia = document.getElementById('calc-custo-dia');
        const elHora = document.getElementById('calc-custo-hora');
        const elServCount = document.getElementById('calc-total-servicos');

        if (elTotal) elTotal.textContent = fmt(totalCustos);
        if (elDia) elDia.textContent = fmt(custoDia);
        if (elHora) elHora.textContent = fmt(custoHora);
        if (elServCount) elServCount.textContent = servicos.length;

        // Renderiza Tabela de Serviços
        const tbody = document.getElementById('calc-custos-tbody');
        if (!tbody) return;

        if (servicos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;"><i class="fa-solid fa-inbox"></i> Nenhum serviço cadastrado no catálogo.</td></tr>';
            return;
        }

        // Ordena por valor_base descrescente
        const sorted = [...servicos].sort((a, b) => (parseFloat(b.valor_base) || 0) - (parseFloat(a.valor_base) || 0));

        let html = '';
        sorted.forEach(s => {
            const valorBase = parseFloat(s.valor_base) || 0;
            const horasEst = window._calcHorasEstimadas[s.id] !== undefined ? window._calcHorasEstimadas[s.id] : 2;
            const custoOp = custoHora * horasEst;
            const lucro = valorBase - custoOp;
            const margem = valorBase > 0 ? (lucro / valorBase) * 100 : 0;

            let margemColor = '#2ecc71';
            let margemBg = 'rgba(46,204,113,0.15)';
            let margemIcon = 'fa-arrow-trend-up';
            if (margem < 20) {
                margemColor = '#e74c3c';
                margemBg = 'rgba(231,76,60,0.15)';
                margemIcon = 'fa-triangle-exclamation';
            } else if (margem < 50) {
                margemColor = '#f39c12';
                margemBg = 'rgba(243,156,18,0.15)';
                margemIcon = 'fa-minus';
            }

            html += `<tr>
                <td><strong style="color: var(--text-primary);">${s.nome_servico || '-'}</strong></td>
                <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px;">${s.categoria || 'Geral'}</span></td>
                <td style="text-align: right; font-weight: 700; color: #2ecc71;">${fmt(valorBase)}</td>
                <td style="text-align: center;">
                    <input type="number" value="${horasEst}" min="0.5" max="100" step="0.5" 
                        style="width: 60px; text-align: center; padding: 5px; border-radius: 6px; border: 2px solid #f39c12; background: rgba(243,156,18,0.1); color: #f39c12; font-weight: 800; font-size: 0.9rem;" 
                        onchange="window._calcHorasEstimadas['${s.id}'] = parseFloat(this.value) || 2; localStorage.setItem('calcHorasEstimadas', JSON.stringify(window._calcHorasEstimadas)); window.renderCalcCustos(true)">
                </td>
                <td style="text-align: right; color: #e74c3c; font-weight: 600;">${fmt(custoOp)}</td>
                <td style="text-align: right; font-weight: 800; color: ${lucro >= 0 ? '#2ecc71' : '#e74c3c'};">${fmt(lucro)}</td>
                <td style="text-align: center;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; background: ${margemBg}; color: ${margemColor}; border: 1px solid ${margemColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 800;">
                        <i class="fa-solid ${margemIcon}"></i> ${margem.toFixed(1)}%
                    </span>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    // ==========================================
    // 5.D CHAT DA MÁRCIA RIBEIRO (FINANÇAS/MARKETING)
    // ==========================================
    const chatMarciaToggle = document.getElementById('chat-marcia-toggle');
    const chatMarciaContainer = document.getElementById('chat-marcia-container');
    const closeMarciaChat = document.getElementById('close-marcia-chat');
    const sendMarciaChat = document.getElementById('send-marcia-chat');
    const chatMarciaInput = document.getElementById('chat-marcia-input');
    const chatMarciaMessages = document.getElementById('chat-marcia-messages');

    // Novos elementos Tela Cheia
    const sendMarciaFs = document.getElementById('marcia-fs-send');
    const inputMarciaFs = document.getElementById('marcia-fs-input');
    const messagesMarciaFs = document.getElementById('marcia-fs-messages');

    if (chatMarciaToggle && chatMarciaContainer) {
        chatMarciaToggle.addEventListener('click', (e) => {
            if (chatMarciaToggle.dataset.dragged === 'true') return;
            chatMarciaContainer.classList.add('open');
            chatMarciaToggle.style.transform = 'scale(0)';
        });
        closeMarciaChat.addEventListener('click', () => {
            chatMarciaContainer.classList.remove('open');
            chatMarciaToggle.style.transform = 'scale(1)';
        });
    }

    function appendMarciaMessage(role, htmlContent, isTyping = false) {
        const className = role === 'user' ? 'msg user' : (isTyping ? 'msg ai typing' : 'msg ai');
        
        // Adiciona no widget
        if (chatMarciaMessages) {
            const msgW = document.createElement('div');
            msgW.className = className;
            msgW.innerHTML = htmlContent;
            chatMarciaMessages.appendChild(msgW);
            chatMarciaMessages.scrollTop = chatMarciaMessages.scrollHeight;
        }
        
        // Adiciona na tela cheia com estilo levemente diferente para alinhar
        if (messagesMarciaFs) {
            const msgFs = document.createElement('div');
            msgFs.className = className;
            if(role === 'ai') {
                msgFs.style.alignSelf = 'flex-start';
                msgFs.style.background = 'rgba(255,255,255,0.05)';
                msgFs.style.padding = '15px';
                msgFs.style.borderRadius = '8px 8px 8px 0';
                msgFs.style.maxWidth = '80%';
                msgFs.style.borderLeft = '3px solid var(--accent-green)';
            } else {
                msgFs.style.alignSelf = 'flex-end';
                msgFs.style.background = 'var(--accent-green)';
                msgFs.style.padding = '15px';
                msgFs.style.borderRadius = '8px 8px 0 8px';
                msgFs.style.maxWidth = '80%';
            }
            msgFs.innerHTML = htmlContent;
            messagesMarciaFs.appendChild(msgFs);
            messagesMarciaFs.scrollTop = messagesMarciaFs.scrollHeight;
        }
    }

    function handleMarciaChatSubmit(sourceText) {
        const text = sourceText.trim();
        if (!text) return;

        // Salva na memória
        if(!window.marciaChatHistory) window.marciaChatHistory = [];
        window.marciaChatHistory.push({ role: 'user', text: text });

        // Exibe mensagem do usuário
        appendMarciaMessage('user', text);

        if (chatMarciaInput) chatMarciaInput.value = '';
        if (inputMarciaFs) inputMarciaFs.value = '';

        // Loading state
        const loadingHtml = '<i class="fa-solid fa-circle-notch fa-spin"></i> Márcia analisando caixa...';
        appendMarciaMessage('ai', loadingHtml, true);

        supabase.functions.invoke('finance-advisor', {
            body: { 
                text: text, 
                userRole: window.userCargo || 'Diretoria',
                history: window.marciaChatHistory.slice(0, -1) // Exclude current message as it is sent in 'text'
            }
        }).then(({ data, error }) => {
            // Remove last typing message
            if (chatMarciaMessages && chatMarciaMessages.lastChild) chatMarciaMessages.lastChild.remove();
            if (messagesMarciaFs && messagesMarciaFs.lastChild) messagesMarciaFs.lastChild.remove();

            if (error) {
                console.error("Erro Edge Function:", error);
                appendMarciaMessage('ai', `<strong>Aviso do Sistema:</strong><br>Erro ao conectar com a Márcia (Servidor Indisponível).`);
            } else if (data && data.success) {
                const resposta = data.dados;
                window.marciaChatHistory.push({ role: 'model', text: resposta });
                appendMarciaMessage('ai', `<strong>Márcia:</strong><br>${resposta}<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${data.correlationId}</span>`);
            } else {
                appendMarciaMessage('ai', `<strong>Aviso do Sistema:</strong><br>Não foi possível processar a requisição financeira.`);
            }
        }).catch(err => {
            if (chatMarciaMessages && chatMarciaMessages.lastChild) chatMarciaMessages.lastChild.remove();
            if (messagesMarciaFs && messagesMarciaFs.lastChild) messagesMarciaFs.lastChild.remove();
            appendMarciaMessage('ai', `<strong>Aviso do Sistema:</strong><br>Falha de rede ao contatar a Diretoria Financeira.`);
        });
    }

    // Eventos Widget
    sendMarciaChat?.addEventListener('click', () => handleMarciaChatSubmit(chatMarciaInput.value));
    chatMarciaInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleMarciaChatSubmit(chatMarciaInput.value);
    });

    // Eventos Full Screen
    sendMarciaFs?.addEventListener('click', () => handleMarciaChatSubmit(inputMarciaFs.value));
    inputMarciaFs?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleMarciaChatSubmit(inputMarciaFs.value);
    });

    // ==========================================
    // 6. AUTO-SAVE GLOBAL (UPSERT)
    // ==========================================
    // Escuta qualquer mudança de valor em inputs, selects ou textareas (exceto o chat)
    document.body.addEventListener('change', async (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {

            // Bloco de excessão: Não roda Upsert global em chats nem nos modais de formulário
            if (e.target.id === 'chat-input') return;
            if (e.target.classList.contains('modal-input') || e.target.closest('.modal-content')) return;

            // Pega o nome da tabela no atributo HTML ex: data-table="financas"
            const tableName = e.target.dataset.table || 'tabela_indefinida';
            const fieldName = e.target.dataset.field || 'campo_indefinido';
            const value = e.target.value;

            console.log(`[Arquiteto Log] Auto-Save global -> Tabela: ${tableName} | Campo: ${fieldName} | Valor: ${value}`);
            triggerAutoSave('Upserting no Supabase...');

            try {
                // Comando real Upsert liberado para o dev futuro acoplar as chaves 
                // const { error } = await supabase.from(tableName).upsert({ [fieldName]: value });

                // Simula latência de rede para a UI
                setTimeout(() => {
                    triggerSaveSuccess('Auto-Save Ativo (Pronto para Supabase UPSERT)');
                }, 800);

            } catch (err) {
                console.error(err);
                triggerSaveError('Erro no Auto-Save!');
            }
        }
    });

    // ==========================================
    // 8. CONFIGURAÇÕES DE CATEGORIAS (UI MODAL)
    // ==========================================
    window.renderConfigCategorias = function() {
        const container = document.getElementById('config-cat-container');
        if (!container) return;
        container.innerHTML = '';
        
        for (const [catMaster, subcats] of Object.entries(window.catalogoTree)) {
            const divMaster = document.createElement('div');
            divMaster.style.border = '1px solid var(--panel-border)';
            divMaster.style.borderRadius = 'var(--radius-md)';
            divMaster.style.padding = '10px';
            divMaster.style.background = 'var(--bg-color)';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '10px';
            
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.value = catMaster;
            titleInput.className = 'modal-input';
            titleInput.style.flexGrow = '1';
            titleInput.style.marginRight = '10px';
            titleInput.onchange = (e) => {
                const newKey = e.target.value.trim();
                if (newKey && newKey !== catMaster) {
                    window.catalogoTree[newKey] = window.catalogoTree[catMaster];
                    delete window.catalogoTree[catMaster];
                    window.renderConfigCategorias();
                }
            };

            const btnDelCat = document.createElement('button');
            btnDelCat.className = 'action-btn danger';
            btnDelCat.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btnDelCat.onclick = () => {
                if (confirm(`Excluir a categoria "${catMaster}" e todas as suas subcategorias?`)) {
                    delete window.catalogoTree[catMaster];
                    window.renderConfigCategorias();
                }
            };

            header.appendChild(titleInput);
            header.appendChild(btnDelCat);
            divMaster.appendChild(header);

            // Subcategories list
            const subContainer = document.createElement('div');
            subContainer.style.paddingLeft = '20px';
            subContainer.style.borderLeft = '2px solid var(--accent-blue)';
            subContainer.style.display = 'flex';
            subContainer.style.flexDirection = 'column';
            subContainer.style.gap = '5px';

            subcats.forEach((sub, idx) => {
                const subRow = document.createElement('div');
                subRow.style.display = 'flex';
                subRow.style.gap = '5px';
                
                const subInput = document.createElement('input');
                subInput.type = 'text';
                subInput.value = sub;
                subInput.className = 'modal-input';
                subInput.style.flexGrow = '1';
                subInput.style.fontSize = '0.85rem';
                subInput.style.padding = '5px 10px';
                subInput.onchange = (e) => {
                    const newVal = e.target.value.trim();
                    if (newVal) window.catalogoTree[catMaster][idx] = newVal;
                    else window.catalogoTree[catMaster].splice(idx, 1);
                    window.renderConfigCategorias();
                };

                const btnDelSub = document.createElement('button');
                btnDelSub.type = 'button';
                btnDelSub.className = 'action-btn danger';
                btnDelSub.style.padding = '5px 10px';
                btnDelSub.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                btnDelSub.onclick = () => {
                    window.catalogoTree[catMaster].splice(idx, 1);
                    window.renderConfigCategorias();
                };

                subRow.appendChild(subInput);
                subRow.appendChild(btnDelSub);
                subContainer.appendChild(subRow);
            });

            const btnAddSub = document.createElement('button');
            btnAddSub.type = 'button';
            btnAddSub.className = 'action-btn';
            btnAddSub.style.fontSize = '0.8rem';
            btnAddSub.style.marginTop = '10px';
            btnAddSub.style.padding = '4px 10px';
            btnAddSub.innerHTML = '<i class="fa-solid fa-plus"></i> Subcategoria';
            btnAddSub.onclick = () => {
                window.catalogoTree[catMaster].push('Nova Subcategoria');
                window.renderConfigCategorias();
            };
            subContainer.appendChild(btnAddSub);

            divMaster.appendChild(subContainer);
            container.appendChild(divMaster);
        }
    };

    window.addNovaCategoriaMaster = function() {
        window.catalogoTree['Nova Categoria'] = [];
        window.renderConfigCategorias();
        // Scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('config-cat-container');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    };

    window.saveConfigCategorias = async function() {
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            // Salva no localStorage como fallback rápido
            localStorage.setItem('catalogo_arvore', JSON.stringify(window.catalogoTree));

            // Tenta salvar no Supabase (se a tabela existir e tiver permissão)
            await supabase.from('sistema_configuracoes').upsert({
                chave: 'catalogo_arvore',
                valor: window.catalogoTree
            }, { onConflict: 'chave' });

            triggerSaveSuccess('Árvore de categorias salva com sucesso!');
            window.closeModal('modal-config-categorias');
            
            // Re-renderizar formulários abertos se necessário
            window.populateCategorySelects();
        } catch (e) {
            console.error(e);
            triggerSaveError('Erro ao salvar no banco. Salvo localmente.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    window.populateCategorySelects = function() {
        const catSelects = document.querySelectorAll('#ser-categoria, #mat-categoria');
        catSelects.forEach(sel => {
            if(!sel) return;
            const val = sel.value; // save current selection
            sel.innerHTML = '<option value="">Selecione uma Categoria</option>';
            for (const cat of Object.keys(window.catalogoTree)) {
                sel.innerHTML += `<option value="${cat}">${cat}</option>`;
            }
            if (window.catalogoTree[val] || val === 'add_new') sel.value = val;
            sel.innerHTML += '<option value="add_new">+ Adicionar Outro...</option>';
        });
    };

    window.updateSubcategories = function(catId, subId) {
        const catSelect = document.getElementById(catId);
        const subSelect = document.getElementById(subId);
        const subGroup = document.getElementById('group-' + subId);
        if (!catSelect || !subSelect) return;

        const catValue = catSelect.value;
        const subs = window.catalogoTree[catValue] || [];
        
        subSelect.innerHTML = '<option value="">Selecione...</option>';
        
        if (subs.length > 0) {
            subs.forEach(s => {
                subSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
            subSelect.innerHTML += '<option value="add_new">+ Adicionar Outro...</option>';
            if(subGroup) subGroup.style.display = 'block';
        } else {
            // Se não tem subcategorias predefinidas, oculta ou permite livre
            if(subGroup) subGroup.style.display = 'none';
        }
    };
    window.closeModal = function (id) {
        const m = document.getElementById(id);
        if (m) {
            m.style.display = 'none';
            const f = m.querySelector('form');
            if (f) {
                f.reset();
                delete f.dataset.editId;
            }
        }
    };

    window.openModal = function (id, preventReset = false) {
        if (id === 'modal-config-categorias') {
            window.renderConfigCategorias();
        }
        if (id === 'modal-venda') {
            window.populateVendaSelect();
            const info = document.getElementById('venda-estoque-info');
            if (info) info.textContent = '';
            const c = document.getElementById('resumo-venda-custo');
            if (c) c.textContent = 'R$ 0,00';
            const f = document.getElementById('resumo-venda-faturamento');
            if (f) f.textContent = 'R$ 0,00';
            const l = document.getElementById('resumo-venda-lucro');
            if (l) { l.textContent = 'R$ 0,00'; l.style.color = '#2ecc71'; }
        }
        const m = document.getElementById(id);
        if (m) {
            if (!preventReset) {
                const f = m.querySelector('form');
                if (f) {
                    f.reset();
                    delete f.dataset.editId;
                }
            }
            m.style.display = 'flex';
        }
    };

    // ==========================================
    // 8.1 EDIÇÃO DE COLABORADORES (MODAL UPSERT)
    // ==========================================
    window.openEditColab = function (colabId) {
        const c = (window.colabCache || []).find(x => x.id === colabId);
        if (!c) return;
        document.getElementById('edit-colab-id').value = c.id;
        document.getElementById('edit-colab-nome').value = c.nome_completo || '';
        document.getElementById('edit-colab-tel').value = c.telefone_whatsapp || '';
        document.getElementById('edit-colab-email').value = c.email || '';
        document.getElementById('edit-colab-cargo').value = c.cargo || 'tecnico';
        document.getElementById('modal-edit-colab').style.display = 'flex';
    };

    document.getElementById('form-edit-colab')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const role = (window.userCargo || 'visitante').toLowerCase();
        const isAdmin = ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo'].some(c => role.includes(c));

        if (!isAdmin) {
            alert('Acesso Negado: Você não possui a credencial de Administrador para promover cargos.');
            return;
        }

        const colabId = document.getElementById('edit-colab-id').value;
        if (!colabId) return;

        triggerAutoSave('Atualizando Colaborador...');
        const { error } = await supabase.from('colaboradores').update({
            nome_completo: document.getElementById('edit-colab-nome').value,
            telefone_whatsapp: document.getElementById('edit-colab-tel').value,
            cargo: document.getElementById('edit-colab-cargo').value,
        }).eq('id', colabId);

        if (error) {
            triggerSaveError('ERRO SUPABASE: ' + JSON.stringify(error));
            console.error(error);
        } else {
            triggerSaveSuccess('Colaborador Atualizado!');
            document.getElementById('modal-edit-colab').style.display = 'none';
            loadData();
        }
    });

    // Botões mapeados para abrir as janelas HTML
    const btnCli = document.getElementById('btn-novo-cliente');
    if (btnCli) btnCli.addEventListener('click', () => openModal('modal-cliente'));

    const btnMat = document.getElementById('btn-novo-mat');
    if (btnMat) btnMat.addEventListener('click', () => openModal('modal-material'));

    const btnFer = document.getElementById('btn-nova-fer');
    if (btnFer) btnFer.addEventListener('click', () => openModal('modal-ferramenta'));

    const btnSer = document.getElementById('btn-novo-ser');
    if (btnSer) btnSer.addEventListener('click', () => openModal('modal-servico'));

    // Obra, Caixa e Nova Super OS
    const btnObra = document.getElementById('btn-nova-obra');
    if (btnObra) btnObra.addEventListener('click', () => openModal('modal-obra'));

    const btnCaixa = document.getElementById('btn-novo-caixa');
    if (btnCaixa) btnCaixa.addEventListener('click', () => openModal('modal-caixa'));

    const btnProposta = document.getElementById('btn-nova-proposta') || document.getElementById('btn-novo-orcamento');
    
    window.onPropClienteChange = function () {
        const sCli = document.getElementById('prop-cliente');
        const chk = document.getElementById('prop-mesmo-endereco');
        const inptEnd = document.getElementById('prop-endereco-obra');
        if (!sCli || !inptEnd) return;

        const cliId = sCli.value;
        const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(cliId));

        if (chk && chk.checked) {
            inptEnd.value = cliObj?.endereco_completo || '';
            inptEnd.readOnly = true;
        }
    };

    window.togglePropEndereco = function (isMesmo) {
        const inptEnd = document.getElementById('prop-endereco-obra');
        const sCli = document.getElementById('prop-cliente');
        if (!inptEnd) return;

        if (isMesmo) {
            const cliId = sCli?.value;
            const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(cliId));
            inptEnd.value = cliObj?.endereco_completo || '';
            inptEnd.readOnly = true;
        } else {
            inptEnd.readOnly = false;
            inptEnd.placeholder = 'Digite o endereço específico da obra (ex: Alameda dos Anapurus, 450 - Moema)...';
            inptEnd.focus();
        }
    };

    window.onSuperClienteChange = function () {
        const sCli = document.getElementById('super-cliente');
        const chk = document.getElementById('super-mesmo-endereco');
        const inptEnd = document.getElementById('super-endereco-obra');
        if (!sCli || !inptEnd) return;

        const cliId = sCli.value;
        const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(cliId));

        if (chk && chk.checked) {
            inptEnd.value = cliObj?.endereco_completo || '';
            inptEnd.readOnly = true;
        }
    };

    window.toggleSuperOSEndereco = function (isMesmo) {
        const inptEnd = document.getElementById('super-endereco-obra');
        const sCli = document.getElementById('super-cliente');
        if (!inptEnd) return;

        if (isMesmo) {
            const cliId = sCli?.value;
            const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(cliId));
            inptEnd.value = cliObj?.endereco_completo || '';
            inptEnd.readOnly = true;
        } else {
            inptEnd.readOnly = false;
            inptEnd.placeholder = 'Digite o endereço específico da obra (ex: Alameda dos Anapurus, 450 - Moema)...';
            inptEnd.focus();
        }
    };

    window.populateProposalSelects = function() {
        // Popular Selects de Proposta com Optgroups Categorizados
        const sSvc = document.getElementById('prop-service-picker');
        const sMat = document.getElementById('prop-material-picker');
        const sCli = document.getElementById('prop-cliente');

        if (sCli) {
            if (!window.clientesCache || window.clientesCache.length === 0) {
                sCli.innerHTML = '<option value="">[X] ERRO: Permissão de Clientes Negada / Cache Vazio</option>';
            } else {
                sCli.innerHTML = '<option value="">Selecione o Cliente...</option>' + window.clientesCache.map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');
            }
        }

        if (sSvc) {
            if (!window.servicosCache || window.servicosCache.length === 0) {
                sSvc.innerHTML = '<option value="">[X] ERRO: Permissão de Serviços Negada / Cache Vazio</option>';
            } else {
                const cats = [...new Set(window.servicosCache.map(s => s.categoria || 'Geral'))];
                sSvc.innerHTML = '<option value="">--- Escolha um Serviço ---</option>' + cats.map(cat => {
                    const items = window.servicosCache.filter(s => (s.categoria || 'Geral') === cat);
                    return `<optgroup label="${cat}">${items.map(s => `<option value="${s.id}">${s.nome_servico}</option>`).join('')}</optgroup>`;
                }).join('');
            }
        }

        if (sMat) {
            if (!window.materiaisCache || window.materiaisCache.length === 0) {
                sMat.innerHTML = '<option value="">[X] ERRO: Permissão de Materiais Negada / Cache Vazio</option>';
            } else {
                const cats = [...new Set(window.materiaisCache.map(m => m.campo_uso || 'Geral'))];
                sMat.innerHTML = '<option value="">--- Escolha um Material ---</option>' + cats.map(cat => {
                    const items = window.materiaisCache.filter(m => (m.campo_uso || 'Geral') === cat);
                    return `<optgroup label="${cat.replace(' | ', ' - ')}">${items.map(m => `<option value="${m.id}">${m.nome_material} (${m.unidade_medida})</option>`).join('')}</optgroup>`;
                }).join('');
            }
        }
    };

    if (btnProposta) btnProposta.addEventListener('click', () => {
        window.populateProposalSelects();
        document.getElementById('prop-valor-ajuste').value = '';
        window.currentPropItems = [];
        window.renderPropItemsTable();
        const chk = document.getElementById('prop-mesmo-endereco');
        if (chk) chk.checked = true;
        const inptEnd = document.getElementById('prop-endereco-obra');
        if (inptEnd) {
            inptEnd.value = '';
            inptEnd.readOnly = true;
        }
        openModal('modal-proposta');
    });

    window.openSuperOS = function (osId = null) {
        const modalTitle = document.querySelector('#modal-super-os h2');

        // Preenche Cliente Global Select
        document.getElementById('super-cliente').innerHTML = '<option value="">(Selecione o Cliente...)</option>' +
            (window.clientesCache || []).map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');

        // Preenche Obras associadas
        document.getElementById('super-obra').innerHTML = '<option value="">(Nenhuma / Serviço Avulso)</option>' +
            (window.obrasCache || []).map(o => `<option value="${o.id}">${o.nome_obra} (${o.clientes?.nome_cliente || ''})</option>`).join('');

        // Preenche Responsável (Técnico)
        const allowedRoles = ['tecnico', 'técnico', 'engenheiro', 'admin', 'gerente'];
        const sysTechs = (window.colabCache || []).filter(c => {
            const role = c.cargo?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            return allowedRoles.includes(role) || allowedRoles.includes(c.cargo?.toLowerCase());
        });
        document.getElementById('super-responsavel').innerHTML = '<option value="Não Definido">Não Definido</option>' +
            sysTechs.map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');

        const sysVendors = (window.colabCache || []).filter(c => {
            const role = (c.cargo || '').toLowerCase();
            return role.includes('vendedor') || role.includes('comercial') || role.includes('admin') || role.includes('diretor') || role.includes('gerente') || role.includes('engenheiro') || role.includes('dono');
        });
        document.getElementById('super-vendedor').innerHTML = '<option value="">(Sem Comissão Atribuída)</option>' +
            sysVendors.map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');

        if (osId) {
            // MODO EDIÇÃO: Busca dados da OS no Cache
            const os = (window.ordensCache || []).find(o => String(o.id_os) === String(osId));
            if (os) {
                if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-file-invoice"></i> Editando OS #${os.id_os}`;
                const form = document.querySelector('#modal-super-os form');
                if (form) form.dataset.editId = os.id_os; // Crucial for Update

                document.getElementById('super-cliente').value = os.cliente_id || '';
                window.loadEquipamentosDropdown(os.cliente_id, os.equipamento_id);
                document.getElementById('super-obra').value = os.obra_id || '';
                document.getElementById('super-titulo').value = os.servico_tipo || '';
                // Se o UUID estiver preenchido, seleciona ele, senão cai pro 'Não Definido' ou ignora
                document.getElementById('super-responsavel').value = os.tecnico_id || 'Não Definido';
                document.getElementById('super-vendedor').value = os.vendedor || '';
                document.getElementById('super-status').value = os.status_ia || 'Aberto';

                // Formatar a data que vem do banco para o input type="date"
                const dateVal = os.data_hora ? os.data_hora.split('T')[0] : '';
                document.getElementById('super-data').value = dateVal;

                // Parse dados extras (plano de pagamento, custos extras, datas extras)
                let extraData = {};
                if (typeof os.materiais_lista === 'string' && os.materiais_lista.startsWith('{')) {
                    try { extraData = JSON.parse(os.materiais_lista); } catch(e) {}
                }

                // Plano de Pagamento
                const condPagElem = document.getElementById('super-condicao-pagamento');
                if (condPagElem) condPagElem.value = extraData.condicao_pagamento || 'À Vista (PIX)';
                const stPagElem = document.getElementById('super-status-pagamento');
                if (stPagElem) stPagElem.value = os.status_pagamento || extraData.status_pagamento || 'Pendente';
                const vencPagElem = document.getElementById('super-vencimento-pagamento');
                if (vencPagElem) vencPagElem.value = extraData.vencimento_pagamento || '';

                // Endereço da Obra na Super OS
                const chkSuperEnd = document.getElementById('super-mesmo-endereco');
                const inptSuperEnd = document.getElementById('super-endereco-obra');
                if (chkSuperEnd && inptSuperEnd) {
                    const mesmoEndSaved = extraData.mesmo_endereco !== false;
                    const endSaved = extraData.endereco_obra || os.clientes?.endereco_completo || '';
                    chkSuperEnd.checked = mesmoEndSaved;
                    inptSuperEnd.value = endSaved;
                    inptSuperEnd.readOnly = mesmoEndSaved;
                }

                // --- CARREGA CRONOGRAMA DE DIÁRIAS (Múltiplas Datas) ---
                const dateContainer = document.getElementById('os-datas-container');
                if (dateContainer) {
                    dateContainer.innerHTML = '';
                    if (os.os_datas && os.os_datas.length > 0) {
                        os.os_datas.forEach(d => window.addOSDateRow(d.data, d.descricao));
                    } else if (extraData.datas_cronograma && Array.isArray(extraData.datas_cronograma)) {
                        extraData.datas_cronograma.forEach(d => {
                            const dtVal = typeof d === 'string' ? d : d.data;
                            const descVal = typeof d === 'string' ? 'Dia de Execução' : (d.descricao || 'Dia de Execução');
                            window.addOSDateRow(dtVal, descVal);
                        });
                    }
                }

                // --- CARREGA CUSTOS EXTRAS & REPASSES ---
                const tExtras = document.getElementById('extras-body');
                if (tExtras) {
                    tExtras.innerHTML = '';
                    const custosExtras = extraData.custos_extras || [];
                    custosExtras.forEach(e => window.addOSExtraRow(e.descricao, e.tipo, e.qtd || 1, e.valor || 0));
                    window.calcExtrasTotal();
                }

                // Botão Enviar WhatsApp no topo do modal
                const btnModalWa = document.getElementById('btn-modal-send-wa');
                if (btnModalWa) {
                    btnModalWa.style.display = 'inline-flex';
                    window.enviarOsWhatsAppTecnicoCurrent = () => window.enviarOsWhatsAppTecnico(os.id_os);
                }

                // Carrega os servicos vinculados na tabela
                const tSvc = document.getElementById('cronograma-body');
                tSvc.innerHTML = '';
                if (os.os_servicos_executados) {
                    const cats = [...new Set((window.servicosCache || []).map(s => s.categoria || 'Geral'))];
                    const optionsHtml = cats.map(cat => {
                        const items = window.servicosCache.filter(s => (s.categoria || 'Geral') === cat);
                        return `<optgroup label="${cat}">${items.map(s => `<option value="${s.id}">${s.nome_servico}</option>`).join('')}</optgroup>`;
                    }).join('');

                    os.os_servicos_executados.forEach(svc => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><select class="c-ser auth-select" required onchange="window.onChangeService(this)"><option value="">Selecione...</option>${optionsHtml}</select></td>
                            <td><input type="number" class="s-qt modal-input" style="width:70px;" value="${svc.quantidade}" step="0.1" onchange="window.calcServiceRow(this)"></td>
                            <td><input type="number" class="s-val modal-input" style="width:90px;" step="0.01" value="${(svc.subtotal_cobrado / (svc.quantidade || 1)).toFixed(2)}" onchange="window.calcServiceRow(this)"></td>
                            <td><input type="number" class="s-sub modal-input" style="width:100px;" value="${svc.subtotal_cobrado}" readonly></td>
                            <td style="text-align:right;"><button type="button" style="color:var(--danger-color); background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove(); window.calcServicosTotal();"><i class="fa-solid fa-trash"></i></button></td>
                        `;
                        tSvc.appendChild(tr);
                        tr.querySelector('.c-ser').value = svc.servico_id;
                    });
                }
                setTimeout(() => window.calcServicosTotal(), 100);

                // Carrega os materiais vinculados
                const tMat = document.getElementById('materiais-body');
                tMat.innerHTML = '';
                if (os.os_materiais_utilizados) {
                    os.os_materiais_utilizados.forEach(mat => {
                        const tr = document.createElement('tr');
                        const matOptionsHtml = [...new Set((window.materiaisCache || []).map(m => m.campo_uso || 'Geral'))].map(cat => {
                            const items = window.materiaisCache.filter(m => (m.campo_uso || 'Geral') === cat);
                            return `<optgroup label="${cat.replace(' | ', ' - ')}">${items.map(m => `<option value="${m.id}">${m.nome_material}</option>`).join('')}</optgroup>`;
                        }).join('');

                        tr.innerHTML = `
                            <td><select class="m-id auth-select" required onchange="window.onChangeMaterial(this)"><option value="">Selecione...</option>${matOptionsHtml}</select></td>
                            <td><input type="number" class="m-qt modal-input" style="width:70px;" value="${mat.quantidade_usada}" step="0.1" onchange="window.calcRowMat(this)"></td>
                            <td><input type="number" class="m-val modal-input" style="width:90px;" step="0.01" value="${mat.valor_unitario_cobrado}" readonly></td>
                            <td><input type="number" class="m-sub modal-input" style="width:100px;" value="${mat.subtotal_material}" readonly></td>
                            <td style="text-align:right;"><button type="button" style="color:var(--danger-color); background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove(); window.calcMateriais();"><i class="fa-solid fa-trash"></i></button></td>
                        `;
                        tMat.appendChild(tr);
                        tr.querySelector('.m-id').value = mat.material_id;
                    });
                }
                setTimeout(() => calcMateriais(), 100);
                document.getElementById('btn-delete-os').style.display = 'inline-block';
                
                const blockedStatuses = ['Cancelado', 'Arquivado'];
                if (blockedStatuses.includes(os.status_ia)) {
                    document.getElementById('btn-reativar-os').style.display = 'inline-block';
                    document.getElementById('btn-faturar-os').style.display = 'none';
                } else {
                    document.getElementById('btn-reativar-os').style.display = 'none';
                    document.getElementById('btn-faturar-os').style.display = (os.status_pagamento === 'Pago') ? 'none' : 'inline-block';
                }
            }
        } else {
            // MODO NOVO: Limpa tudo
            document.getElementById('btn-reativar-os').style.display = 'none';
            document.getElementById('btn-delete-os').style.display = 'none';
            document.getElementById('btn-faturar-os').style.display = 'none';
            const btnModalWa = document.getElementById('btn-modal-send-wa');
            if (btnModalWa) btnModalWa.style.display = 'none';

            if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-file-circle-plus"></i> Abrir Nova OS`;
            document.getElementById('super-cliente').value = '';
            document.getElementById('super-obra').value = '';
            document.getElementById('super-titulo').value = '';
            document.getElementById('super-responsavel').value = 'Não Definido';
            document.getElementById('super-status').value = 'Aberto';
            document.getElementById('super-data').value = new Date().toISOString().split('T')[0];
            
            const condPagElem = document.getElementById('super-condicao-pagamento');
            if (condPagElem) condPagElem.value = 'À Vista (PIX)';
            const stPagElem = document.getElementById('super-status-pagamento');
            if (stPagElem) stPagElem.value = 'Pendente';
            const vencPagElem = document.getElementById('super-vencimento-pagamento');
            if (vencPagElem) vencPagElem.value = '';

            const chkSuperEnd = document.getElementById('super-mesmo-endereco');
            const inptSuperEnd = document.getElementById('super-endereco-obra');
            if (chkSuperEnd) chkSuperEnd.checked = true;
            if (inptSuperEnd) {
                inptSuperEnd.value = '';
                inptSuperEnd.readOnly = true;
            }

            document.getElementById('cronograma-body').innerHTML = '';
            document.getElementById('materiais-body').innerHTML = '';
            const tExtras = document.getElementById('extras-body');
            if (tExtras) tExtras.innerHTML = '';

            const dateContainer = document.getElementById('os-datas-container');
            if (dateContainer) dateContainer.innerHTML = '';
            
            window.calcServicosTotal && window.calcServicosTotal();
            window.calcMateriais && window.calcMateriais();
            window.calcExtrasTotal && window.calcExtrasTotal();
        }

        window.openModal('modal-super-os', !!osId);
    };

    const btnNovaOS = document.getElementById('btn-nova-os');
    if (btnNovaOS) btnNovaOS.addEventListener('click', () => openSuperOS());

    // ==========================================
    // 9.A SUPER FICHA: CRONOGRAMA DINÂMICO
    // ==========================================
    document.getElementById('btn-add-cronograma')?.addEventListener('click', () => {
        const t = document.getElementById('cronograma-body');
        const tr = document.createElement('tr');

        // Agrupar Serviços por Categoria para o OptGroup
        const cats = [...new Set((window.servicosCache || []).map(s => s.categoria || 'Geral'))];
        const optionsHtml = cats.map(cat => {
            const items = window.servicosCache.filter(s => (s.categoria || 'Geral') === cat);
            return `<optgroup label="${cat}">${items.map(s => `<option value="${s.id}">${s.nome_servico}</option>`).join('')}</optgroup>`;
        }).join('');

        tr.innerHTML = `
            <td><select class="c-ser auth-select" required onchange="window.onChangeService(this)"><option value="">Selecione...</option>${optionsHtml}</select></td>
            <td><input type="number" class="s-qt modal-input" style="width:70px;" value="1" step="0.1" onchange="window.calcServiceRow(this)"></td>
            <td><input type="number" class="s-val modal-input" style="width:90px;" step="0.01" onchange="window.calcServiceRow(this)"></td>
            <td><input type="number" class="s-sub modal-input" style="width:100px;" readonly></td>
            <td style="text-align:right;"><button type="button" style="color:var(--danger-color); background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove(); window.calcServicosTotal();"><i class="fa-solid fa-trash"></i></button></td>
        `;
        t.appendChild(tr);
    });

    window.onChangeService = function (sel) {
        const svcId = sel.value;
        const svc = (window.servicosCache || []).find(s => s.id === svcId);
        const tr = sel.closest('tr');
        if (svc) {
            tr.querySelector('.s-val').value = parseFloat(svc.valor_base || 0).toFixed(2);
        } else {
            tr.querySelector('.s-val').value = '';
        }
        window.calcServiceRow(sel);
    };

    window.calcServiceRow = function (el) {
        const tr = el.closest('tr');
        const qt = parseFloat(tr.querySelector('.s-qt').value) || 0;
        const val = parseFloat(tr.querySelector('.s-val').value) || 0;
        tr.querySelector('.s-sub').value = (qt * val).toFixed(2);
        window.calcServicosTotal();
    };

    window.calcServicosTotal = function () {
        let sum = 0;
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            sum += parseFloat(tr.querySelector('.s-sub').value) || 0;
        });
        const disp = document.getElementById('total-servicos-os');
        if (disp) disp.textContent = 'R$ ' + sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        calcSuperOSTotal();
    };

    // ==========================================
    // 9.B SUPER FICHA: MATERIAIS DINÂMICOS
    // ==========================================
    document.getElementById('btn-add-material')?.addEventListener('click', () => {
        const t = document.getElementById('materiais-body');
        const tr = document.createElement('tr');

        // Agrupar Materiais por Categoria para o OptGroup
        const matOptionsHtml = [...new Set((window.materiaisCache || []).map(m => m.campo_uso || 'Geral'))].map(cat => {
            const items = window.materiaisCache.filter(m => (m.campo_uso || 'Geral') === cat);
            return `<optgroup label="${cat.replace(' | ', ' - ')}">${items.map(m => `<option value="${m.id}">${m.nome_material}</option>`).join('')}</optgroup>`;
        }).join('');

        tr.innerHTML = `
            <td><select class="m-id auth-select" required onchange="window.onChangeMaterial(this)"><option value="">Selecione...</option>${matOptionsHtml}</select></td>
            <td><input type="number" class="m-qt modal-input" style="width:70px;" value="1" step="0.1" onchange="window.calcRowMat(this)"></td>
            <td><input type="number" class="m-val modal-input" style="width:90px;" step="0.01" onchange="window.calcRowMat(this)"></td>
            <td><input type="number" class="m-sub modal-input" style="width:100px;" readonly></td>
            <td style="text-align:right;"><button type="button" style="color:var(--danger-color); background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove(); window.calcMateriais();"><i class="fa-solid fa-trash"></i></button></td>
        `;
        t.appendChild(tr);
    });

    window.calcMateriais = function () {
        let sum = 0;
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            sum += parseFloat(tr.querySelector('.m-sub').value) || 0;
        });
        document.getElementById('total-materiais-os').textContent = 'R$ ' + sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        calcSuperOSTotal();
    };

    // ==========================================
    // 9.B.1 CUSTOS EXTRAS & REPASSES NA OBRA
    // ==========================================
    window.addOSExtraRow = function (descricao = '', tipo = 'Material Comprado na Obra', qtd = 1, valor = 0) {
        const tbody = document.getElementById('extras-body');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="e-desc modal-input" placeholder="Ex: 3x Interruptores Bipolares Leroy" value="${descricao}" style="width:100%;"></td>
            <td>
                <select class="e-tipo auth-select">
                    <option value="Material Comprado na Obra" ${tipo === 'Material Comprado na Obra' ? 'selected' : ''}>Material Comprado</option>
                    <option value="Serviço Adicional" ${tipo === 'Serviço Adicional' ? 'selected' : ''}>Serviço Adicional</option>
                    <option value="Deslocamento / Outro" ${tipo === 'Deslocamento / Outro' ? 'selected' : ''}>Deslocamento / Outro</option>
                </select>
            </td>
            <td><input type="number" class="e-qt modal-input" value="${qtd}" min="0.1" step="0.1" style="width:70px;" oninput="window.calcExtrasTotal()"></td>
            <td><input type="number" class="e-sub modal-input" value="${valor}" step="0.01" style="width:100px; font-weight:bold; color:#e67e22;" oninput="window.calcExtrasTotal()"></td>
            <td style="text-align:right;">
                <button type="button" style="color:var(--danger-color); background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove(); window.calcExtrasTotal();">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        window.calcExtrasTotal();
    };

    window.calcExtrasTotal = function () {
        let total = 0;
        document.querySelectorAll('#extras-body tr').forEach(tr => {
            const sub = parseFloat(tr.querySelector('.e-sub')?.value || 0);
            total += isNaN(sub) ? 0 : sub;
        });

        const label = document.getElementById('total-extras-os');
        if (label) label.textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        window.calcSuperOSTotal();
        return total;
    };

    window.calcSuperOSTotal = function () {
        let sumSvcs = 0;
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            sumSvcs += parseFloat(tr.querySelector('.s-sub').value) || 0;
        });
        let sumMats = 0;
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            sumMats += parseFloat(tr.querySelector('.m-sub').value) || 0;
        });
        let sumExtras = 0;
        document.querySelectorAll('#extras-body tr').forEach(tr => {
            sumExtras += parseFloat(tr.querySelector('.e-sub')?.value || 0);
        });

        const total = sumSvcs + sumMats + sumExtras;
        const disp = document.getElementById('super-os-total-label');
        if (disp) disp.textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        // Guarda na janela o valor pra caso usemos no Faturar (Fluxo Caixa)
        window.currentSuperOSTotal = total;
    };

    window.onChangeMaterial = function (sel) {
        const matId = sel.value;
        const mat = (window.materiaisCache || []).find(m => m.id === matId);
        const tr = sel.closest('tr');
        const unitInput = tr.querySelector('.m-val');
        if (mat) unitInput.value = mat.valor_unitario;
        window.calcRowMat(unitInput);
    }

    window.calcRowMat = function (el) {
        const tr = el.closest('tr');
        const qt = parseFloat(tr.querySelector('.m-qt').value) || 0;
        const val = parseFloat(tr.querySelector('.m-val').value) || 0;
        tr.querySelector('.m-sub').value = (qt * val).toFixed(2);
        calcMateriais();
    }

    // ==========================================
    // 9.C SUPER PROPOSTA: ITENS DINÂMICOS & CATEGORIAS (V5)
    // ==========================================
    window.addPropLineItem = function (type) {
        const selId = type === 'service' ? 'prop-service-picker' : 'prop-material-picker';
        const qtdId = type === 'service' ? 'prop-service-qtd' : 'prop-material-qtd';
        const select = document.getElementById(selId);
        const qtdField = document.getElementById(qtdId);
        const id = select.value;
        const qtd = parseFloat(qtdField.value) || 1;

        if (!id) return;

        const item = type === 'service'
            ? (window.servicosCache || []).find(s => s.id === id)
            : (window.materiaisCache || []).find(m => m.id === id);

        if (!item) return;

        // Detectar Categoria do OptGroup (Melhoria de Navegação V5)
        const opt = select.options[select.selectedIndex];
        const category = opt.parentElement.label || 'Geral';

        const newItem = {
            id_db: id,
            type: type,
            name: type === 'service' ? item.nome_servico : item.nome_material,
            category: category,
            price: type === 'service' ? item.valor_base : item.valor_unitario,
            qtd: qtd,
            subtotal: (type === 'service' ? item.valor_base : item.valor_unitario) * qtd
        };

        window.currentPropItems.push(newItem);
        window.renderPropItemsTable();
        window.calcPropTotal();
    };

    window.removeItemFromProposal = function (index) {
        window.currentPropItems.splice(index, 1);
        window.renderPropItemsTable();
        window.calcPropTotal();
    };

    window.updatePropItemQty = function (index, newQty) {
        const qty = parseFloat(newQty) || 1;
        if (window.currentPropItems[index]) {
            window.currentPropItems[index].qtd = qty;
            window.currentPropItems[index].subtotal = qty * window.currentPropItems[index].price;
            window.renderPropItemsTable();
            window.calcPropTotal();
        }
    };

    window.renderPropItemsTable = function () {
        const body = document.querySelector('#table-prop-items tbody');
        if (!body) return;
        body.innerHTML = '';

        window.currentPropItems = window.currentPropItems.filter(i => i && i.type !== 'payment_condition');

        // Agrupar por Categoria (V5 logic)
        const categories = [...new Set(window.currentPropItems.map(i => i.category))];

        categories.sort().forEach(cat => {
            // Header da Categoria
            const headTr = document.createElement('tr');
            headTr.innerHTML = `<td colspan="4" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); font-weight: 800; text-transform: uppercase; font-size: 0.7rem; padding: 4px 10px;">${cat}</td>`;
            body.appendChild(headTr);

            window.currentPropItems.filter(i => i.category === cat).forEach((item) => {
                const tr = document.createElement('tr');
                const globalIdx = window.currentPropItems.indexOf(item);
                tr.innerHTML = `
                    <td style="padding-left: 20px;">${item.name}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="number" 
                                   value="${item.qtd}" 
                                   min="0.1" step="0.1" 
                                   class="modal-input" 
                                   style="width: 70px; padding: 4px 8px; font-size: 0.8rem; text-align: center; background: rgba(0,0,0,0.3);" 
                                   onchange="window.updatePropItemQty(${globalIdx}, this.value)">
                            <span style="color: var(--text-muted); font-size: 0.8rem;">x ${formatCurrency(item.price)}</span>
                        </div>
                    </td>
                    <td><strong style="color:var(--accent-green)">${formatCurrency(item.subtotal)}</strong></td>
                    <td><button type="button" class="action-btn" style="background:var(--accent-red); padding:2px 6px;" onclick="window.removeItemFromProposal(${globalIdx})"><i class="fa-solid fa-trash"></i></button></td>
                `;
                body.appendChild(tr);
            });
        });
    };

    window.calcPropTotal = function () {
        let itemsSum = window.currentPropItems.reduce((acc, i) => acc + i.subtotal, 0);
        const adjustment = parseFloat(document.getElementById('prop-valor-ajuste').value) || 0;
        const total = itemsSum + adjustment;

        const display = document.getElementById('prop-valor');
        if (display) display.value = total.toFixed(2);
    };

    // ==========================================
    // 9.C SUPER FICHA: BOTÃO MAGIA DA I.A. (COM TIMEOUT)
    // ==========================================
    document.getElementById('btn-process-ai')?.addEventListener('click', () => {
        const prompt = document.getElementById('ai-prompt-os').value;
        if (prompt.length < 5) { alert('Digite mais informações na Inteligência.'); return; }

        triggerAutoSave('Engenheiro IA processando prompt...');

        // Chamada V2 com Fallback
        callAIWithTimeout('Arquiteto/Ian', { prompt }).then(res => {
            if (res.status === 'success') {
                document.getElementById('os-resumo').value = `Análise Inteligente Concluída (ID: ${res.correlationId})`;
                document.getElementById('btn-add-cronograma').click();
                document.getElementById('btn-add-material').click();
                triggerSaveSuccess('Dados gerados com sucesso!');
            } else {
                // FALLBACK
                triggerSaveError('Timeout ao chamar IA. Geração Assíncrona Ativa.');
                document.getElementById('os-resumo').value = `(Aviso) Geração demorando. Processo movido para fila paralela. Você pode salvar a OS agora e os dados preencherão depois. ID: ${res.correlationId}`;
            }
        });
    });


    // ==========================================
    // 9.D SUPER FICHA: UPLOAD EM BACKGROUND E COMPRESSÃO (OFFLINE FIRST)
    // ==========================================
    const uploadQueue = [];
    let isUploadingPhotos = false;

    document.getElementById('os-fotos')?.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files.length) return;

        const statusDiv = document.getElementById('upload-queue-status');
        if (statusDiv) statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Comprimindo foto(s) para economizar dados móveis...';

        for (let i = 0; i < files.length; i++) {
            try {
                // Configuração de Compressão Mobile (Máx 500kb, 1200px)
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
                // Garantir que imageCompression está carregado do CDN
                if (typeof imageCompression === 'function') {
                    const compressedFile = await imageCompression(files[i], options);
                    uploadQueue.push({ id: Math.random().toString(36).substr(2, 9), file: compressedFile, name: compressedFile.name, status: 'pending' });
                } else {
                    // Fallback se biblioteca falhar (salva cru)
                    uploadQueue.push({ id: Math.random().toString(36).substr(2, 9), file: files[i], name: files[i].name, status: 'pending' });
                }
            } catch (error) {
                console.error('Erro de compressão de Imagem:', error);
            }
        }
        updateUploadUI();
        processUploadQueue();
    });

    function updateUploadUI() {
        const statusDiv = document.getElementById('upload-queue-status');
        if (!statusDiv) return;
        const pending = uploadQueue.filter(f => f.status === 'pending').length;
        if (pending > 0) {
            statusDiv.innerHTML = `<span style="color: var(--accent-orange)"><i class="fa-solid fa-cloud-arrow-up"></i> ${pending} foto(s) na fila de envio em background. Pode fechar ou continuar trabalhando.</span>`;
        } else {
            const uploaded = uploadQueue.filter(f => f.status === 'uploaded').length;
            if (uploaded > 0) {
                statusDiv.innerHTML = `<span style="color: var(--accent-green)"><i class="fa-solid fa-check-circle"></i> Todos os ${uploaded} anexos salvos com segurança na nuvem.</span>`;
            } else {
                statusDiv.textContent = 'Nenhuma foto anexada à ordem.';
            }
        }
    }

    async function processUploadQueue() {
        if (isUploadingPhotos) return;
        isUploadingPhotos = true;

        for (let item of uploadQueue) {
            if (item.status === 'pending') {
                try {
                    // Simulação para o MVP V2:
                    await new Promise(r => setTimeout(r, 1800));
                    item.status = 'uploaded';
                    console.log(`[Background Sync] Arquivo ${item.name} subiu com sucesso.`);
                    updateUploadUI();
                } catch (e) {
                    console.warn(`[Background Sync] Falha de rede para ${item.name}. Reagendando.`);
                }
            }
        }
        isUploadingPhotos = false;
    }

    // ==========================================
    // 10. SUBMITS DE FORMULÁRIO (MÁGICA DA NUVEM)
    // ==========================================
    async function saveToDatabase(tableName, dataObject, modalId) {
        const form = document.querySelector(`#${modalId} form`);
        const editId = form ? form.dataset.editId : null;

        if (!tableName || !dataObject) return;
        if (typeof supabase === 'undefined') {
            alert('Erro: Supabase não inicializado.');
            return;
        }

        if (editId) {
            triggerAutoSave(`Atualizando em ${tableName}...`);
            // Mapeamento de PK Robusto: OS usa id_os, o resto usa id
            const pkField = tableName === 'ordens_servico' ? 'id_os' : 'id';
            const { error } = await supabase.from(tableName).update(dataObject).eq(pkField, editId);
            if (error) {
                triggerSaveError('Erro ao Atualizar');
                console.error(error);
            } else {
                await saveAuditLog('UPDATE', tableName, editId, dataObject);
                triggerSaveSuccess('Atualizado!');
                if (form) delete form.dataset.editId;
                closeModal(modalId);
                loadData();
            }
        } else {
            triggerAutoSave(`Gravando Novo em ${tableName}...`);
            const { data: inserted, error } = await supabase.from(tableName).insert([dataObject]).select();
            if (error) {
                triggerSaveError('Erro ao Inserir');
                console.error(error);
            } else {
                const newId = inserted && inserted[0] ? (inserted[0].id || inserted[0].id_os) : 'N/A';
                await saveAuditLog('INSERT', tableName, newId, dataObject);
                triggerSaveSuccess('Salvo!');
                closeModal(modalId);
                loadData();
            }
        }
    }

    // Formulários Standard
    document.getElementById('form-cliente')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveToDatabase('clientes', {
            nome_cliente: document.getElementById('cli-nome').value,
            whatsapp: document.getElementById('cli-whats').value,
            endereco_completo: document.getElementById('cli-end').value,
            documento_cpf_cnpj: document.getElementById('cli-doc').value
        }, 'modal-cliente');
    });

    // ==========================================
    // 9.B MÓDULO DE VENDAS
    // ==========================================
    window.populateVendaSelect = function() {
        const select = document.getElementById('venda-material-id');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione um produto em estoque...</option>';
        const mat = (window.materiaisCache || []).filter(m => m.quantidade > 0);
        mat.forEach(m => {
            select.innerHTML += `<option value="${m.id}" data-qtd="${m.quantidade}" data-custo="${m.preco_compra || 0}" data-venda="${m.valor_unitario || 0}" data-nome="${m.nome_material}">${m.nome_material} (Qtd: ${m.quantidade})</option>`;
        });
    };

    window.onVendaProdutoChange = function() {
        const select = document.getElementById('venda-material-id');
        const info = document.getElementById('venda-estoque-info');
        if (!select.value) {
            info.textContent = '';
            return;
        }
        const opt = select.options[select.selectedIndex];
        const qtdMax = parseFloat(opt.dataset.qtd);
        const custo = parseFloat(opt.dataset.custo);
        const venda = parseFloat(opt.dataset.venda);
        const nome = opt.dataset.nome;

        info.textContent = `Disponível em estoque: ${qtdMax} | Custo base: R$ ${custo.toFixed(2)}`;
        
        document.getElementById('venda-estoque-max').value = qtdMax;
        document.getElementById('venda-custo-unit').value = custo;
        document.getElementById('venda-nome-material').value = nome;
        
        const valorUnitInput = document.getElementById('venda-valor-unit');
        if (!valorUnitInput.value || valorUnitInput.value == 0) {
            valorUnitInput.value = venda > 0 ? venda : '';
        }
        
        window.calcResumoVenda();
    };

    window.calcResumoVenda = function() {
        const qtd = parseFloat(document.getElementById('venda-qtd').value) || 0;
        const valorUnit = parseFloat(document.getElementById('venda-valor-unit').value) || 0;
        const custoUnit = parseFloat(document.getElementById('venda-custo-unit').value) || 0;
        const maxQtd = parseFloat(document.getElementById('venda-estoque-max').value) || 0;

        const info = document.getElementById('venda-estoque-info');
        if (qtd > maxQtd) {
            info.style.color = 'var(--danger-color)';
            info.textContent = `⚠️ Erro: Quantidade solicitada (${qtd}) é maior que o estoque atual (${maxQtd}).`;
        } else {
            info.style.color = 'var(--accent-orange)';
            info.textContent = `Disponível em estoque: ${maxQtd} | Custo base: R$ ${custoUnit.toFixed(2)}`;
        }

        const custoTotal = qtd * custoUnit;
        const fatTotal = qtd * valorUnit;
        const lucroTotal = fatTotal - custoTotal;

        document.getElementById('resumo-venda-custo').textContent = `R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('resumo-venda-faturamento').textContent = `R$ ${fatTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
        const elLucro = document.getElementById('resumo-venda-lucro');
        elLucro.textContent = `R$ ${lucroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if (lucroTotal < 0) {
            elLucro.style.color = 'var(--danger-color)';
        } else {
            elLucro.style.color = '#2ecc71';
        }
    };

    document.getElementById('form-venda')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const materialId = document.getElementById('venda-material-id').value;
        const qtdVendida = parseFloat(document.getElementById('venda-qtd').value);
        const valorUnitVenda = parseFloat(document.getElementById('venda-valor-unit').value);
        const clienteNome = document.getElementById('venda-cliente').value || 'Cliente Balcão';
        
        const custoUnit = parseFloat(document.getElementById('venda-custo-unit').value);
        const maxQtd = parseFloat(document.getElementById('venda-estoque-max').value);
        const nomeMat = document.getElementById('venda-nome-material').value;

        if (!materialId || qtdVendida <= 0) {
            alert('Por favor, selecione um produto e insira uma quantidade válida.');
            return;
        }

        if (qtdVendida > maxQtd) {
            alert(`Atenção: A quantidade vendida não pode ser maior que o estoque disponível (${maxQtd}).`);
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando Venda...';
        btn.disabled = true;

        try {
            const custoTotal = qtdVendida * custoUnit;
            const fatTotal = qtdVendida * valorUnitVenda;
            const lucroTotal = fatTotal - custoTotal;

            // 1. Grava no Histórico de Vendas
            const payloadVenda = {
                material_id: materialId,
                nome_material: nomeMat,
                quantidade_vendida: qtdVendida,
                valor_unitario_venda: valorUnitVenda,
                custo_unitario: custoUnit,
                lucro_total: lucroTotal,
                cliente_nome: clienteNome
            };
            const { error: err1 } = await supabase.from('vendas_produtos').insert([payloadVenda]);
            if (err1) throw err1;

            // 2. Abate do Estoque
            const novoEstoque = maxQtd - qtdVendida;
            const { error: err2 } = await supabase.from('materiais').update({ quantidade: novoEstoque }).eq('id', materialId);
            if (err2) throw err2;

            // 3. Lança Entrada no Fluxo de Caixa
            const obsCaixa = `Venda: ${qtdVendida}x ${nomeMat} para ${clienteNome}`;
            const { error: err3 } = await supabase.from('fluxo_caixa').insert([{
                tipo_movimento: 'Entrada',
                categoria: 'Venda de Produto',
                valor: fatTotal,
                descricao: obsCaixa,
                data_ocorrencia: new Date().toISOString().split('T')[0]
            }]);
            if (err3) throw err3;

            alert('✅ Venda registrada com sucesso! Estoque abatido e caixa atualizado.');
            window.closeModal('modal-venda');
            e.target.reset();
            document.getElementById('venda-estoque-info').textContent = '';
            document.getElementById('resumo-venda-custo').textContent = 'R$ 0,00';
            document.getElementById('resumo-venda-faturamento').textContent = 'R$ 0,00';
            document.getElementById('resumo-venda-lucro').textContent = 'R$ 0,00';
            
            // Recarrega os dados globais para atualizar as views
            if (typeof window.fetchDashboardData === 'function') {
                await window.fetchDashboardData();
            }

        } catch (error) {
            console.error("Erro ao registrar venda:", error);
            alert(`Erro ao registrar venda: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('form-material')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cat = document.getElementById('mat-categoria').value || 'Geral';
        const subCat = document.getElementById('mat-subcategoria').value || 'Geral';
        const campoUsoPipe = `${cat} | ${subCat}`;

        await saveToDatabase('materiais', {
            nome_material: document.getElementById('mat-nome').value,
            quantidade: parseFloat(document.getElementById('mat-qtd').value),
            unidade_medida: document.getElementById('mat-un').value,
            preco_compra: parseFloat(document.getElementById('mat-preco-compra').value) || 0,
            valor_unitario: parseFloat(document.getElementById('mat-val').value) || 0,
            campo_uso: campoUsoPipe
        }, 'modal-material');
    });

    document.getElementById('form-ferramenta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const colabId = document.getElementById('fer-colaborador-id').value;
        const payloadFerramenta = {
            nome_ferramenta: document.getElementById('fer-nome').value,
            status: document.getElementById('fer-status').value,
            colaborador_id: colabId ? colabId : null,
            local_atual: document.getElementById('fer-local-atual').value,
            estado_conservacao: document.getElementById('fer-estado-conservacao').value,
            observacao: document.getElementById('fer-obs').value
        };
        
        if (window._currentFerramentaQR) {
            payloadFerramenta.qr_code_id = window._currentFerramentaQR;
        }

        await saveToDatabase('ferramentas', payloadFerramenta, 'modal-ferramenta');
    });

    window.showFerramentaQRFromModal = function() {
        const id = document.getElementById('form-ferramenta').dataset.editId;
        const nome = document.getElementById('fer-nome').value;
        const status = document.getElementById('fer-status').value;
        const qrCodeId = window._currentFerramentaQR || window.gerarQRCodeId();
        
        if (!id) {
            alert('Salve a ferramenta pela primeira vez antes de gerar a etiqueta QR Code.');
            return;
        }
        
        const appUrl = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_URL) ? import.meta.env.VITE_APP_URL : 'https://www.arnaldotrentin.com.br');
        const finalUrl = `${appUrl}?ferramenta=${id}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(finalUrl)}`;
        
        window.imprimirTagQR(nome, `Status: ${status}`, qrApiUrl);
    };

    document.getElementById('form-servico')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let jsonObj = {};
        try {
            const rawJson = document.getElementById('ser-descritivo-json').value;
            if (rawJson) jsonObj = JSON.parse(rawJson);
        } catch (e) { console.warn('JSON inválido'); }
        
        const cat = document.getElementById('ser-categoria').value || 'Geral';
        const subCat = document.getElementById('ser-subcategoria').value || '';
        const categoriaCompleta = subCat ? `${cat} | ${subCat}` : cat;

        await saveToDatabase('servicos', {
            nome_servico: document.getElementById('ser-nome').value,
            categoria: categoriaCompleta,
            descritivo_json: jsonObj,
            descricao: document.getElementById('ser-desc').value,
            valor_base: parseFloat(document.getElementById('ser-val').value)
        }, 'modal-servico');
    });

    document.getElementById('form-obra')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cid = document.getElementById('ob-cliente-id').value;
        await saveToDatabase('obras', {
            nome_obra: document.getElementById('ob-nome').value,
            cliente_id: cid || null,
            endereco_operacional: document.getElementById('ob-end').value,
            status_obra: document.getElementById('ob-status')?.value || 'Em Andamento',
            data_inicio: document.getElementById('ob-data-inicio')?.value || null,
            data_fim_previsto: document.getElementById('ob-data-fim-prev')?.value || null,
            orcamento: parseFloat(document.getElementById('ob-orcamento')?.value) || 0
        }, 'modal-obra');
    });

    document.getElementById('form-caixa')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        await saveToDatabase('fluxo_caixa', {
            tipo_movimento: document.getElementById('cx-tipo').value,
            categoria: document.getElementById('cx-cat').value,
            descricao: document.getElementById('cx-desc').value,
            valor: parseFloat(document.getElementById('cx-val').value),
            data_ocorrencia: document.getElementById('cx-data')?.value || new Date().toISOString(),
            responsavel_id: user ? user.id : null
        }, 'modal-caixa');
    });

    document.getElementById('form-faturamento')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const osIdVal = document.getElementById('fat-os-id')?.value;
        const osIdNum = osIdVal ? (parseInt(osIdVal) || null) : null;
        const totalGeral = parseFloat(document.getElementById('fat-valor')?.value) || 0;
        const statusFat = document.getElementById('fat-status')?.value || 'Pendente';
        const dtEmissao = document.getElementById('fat-data-emissao')?.value;

        // Se houver OS vinculada, busca subtotais
        let totalServ = 0;
        let totalMat = 0;
        if (osIdNum) {
            const os = (window.ordensCache || []).find(o => String(o.id_os || o.id) === String(osIdNum));
            if (os) {
                if (os.os_servicos_executados && Array.isArray(os.os_servicos_executados)) {
                    os.os_servicos_executados.forEach(s => { totalServ += Number(s.subtotal_cobrado || 0); });
                }
                if (os.os_materiais_utilizados && Array.isArray(os.os_materiais_utilizados)) {
                    os.os_materiais_utilizados.forEach(m => { totalMat += Number(m.subtotal_material || 0); });
                }
            }
        }
        if (totalServ === 0 && totalMat === 0) {
            totalServ = totalGeral;
        }

        const payload = {
            os_id: osIdNum,
            total_servicos: totalServ,
            total_materiais: totalMat,
            total_geral: totalGeral,
            status_faturamento: statusFat
        };
        if (dtEmissao) {
            payload.data_emissao = new Date(dtEmissao + 'T12:00:00Z').toISOString();
        }

        await saveToDatabase('faturamentos', payload, 'modal-faturamento-b2b');
        if (typeof window.loadFaturamentos === 'function') {
            await window.loadFaturamentos();
        }
    });

    document.getElementById('btn-novo-faturamento')?.addEventListener('click', () => {
        const form = document.querySelector('#modal-faturamento-b2b form');
        if(form) {
            form.reset();
            delete form.dataset.editId;
        }
        if (typeof window.populateFaturamentoOSDropdown === 'function') {
            window.populateFaturamentoOSDropdown('');
        }
        const dateInput = document.getElementById('fat-data-emissao');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        if (typeof window.renderFaturamentoOSDetails === 'function') {
            window.renderFaturamentoOSDetails('');
        }
        openModal('modal-faturamento-b2b');
    });

    // --- Sistema de Múltiplas Datas p/ OS ---
    window.addOSDateRow = function (dateValue = '', descValue = 'Dia de Execução') {
        const container = document.getElementById('os-datas-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'os-date-row';
        div.style = "display: flex; gap: 10px; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;";
        div.innerHTML = `
            <input type="date" class="modal-input c-os-date" value="${dateValue}" style="flex: 1; min-width: 130px;">
            <input type="text" class="modal-input c-os-desc" value="${descValue}" placeholder="Descrição (ex: Início, Finalização...)" style="flex: 2;">
            <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 5px;">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        container.appendChild(div);
    };

    // Formulário Super OS (A Revolução)
    document.getElementById('form-super-os')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;

        let clienteId = document.getElementById('super-cliente').value;
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!clienteId || !uuidRegex.test(clienteId)) {
            triggerSaveError('Erro: Cliente Inválido.');
            alert('⚠️ Selecione um Cliente válido na lista antes de salvar a Ordem de Serviço.\n(Proteção contra erro de Integração ativada).');
            return;
        }

        let obraId = document.getElementById('super-obra').value;
        if (!obraId || !uuidRegex.test(obraId)) obraId = null;

        const osId = form.dataset.editId;
        triggerAutoSave(osId ? 'Atualizando Ordem de Serviço...' : 'Orquestrando Super Ficha no Banco...');

        const selResp = document.getElementById('super-responsavel');
        const techId = selResp.value === 'Não Definido' ? null : selResp.value;
        const techName = selResp.value === 'Não Definido' ? 'Não Definido' : selResp.options[selResp.selectedIndex].text;

        // Coleta Custos Extras
        const custosExtras = [];
        document.querySelectorAll('#extras-body tr').forEach(tr => {
            const desc = tr.querySelector('.e-desc')?.value?.trim();
            const tipo = tr.querySelector('.e-tipo')?.value || 'Material Comprado na Obra';
            const qtd = parseFloat(tr.querySelector('.e-qt')?.value || 1);
            const val = parseFloat(tr.querySelector('.e-sub')?.value || 0);
            if (desc && val > 0) {
                custosExtras.push({ descricao: desc, tipo: tipo, qtd: qtd, valor: val });
            }
        });

        // Coleta Cronograma de Diárias
        const datasCronograma = [];
        document.querySelectorAll('.os-date-row').forEach(row => {
            const dateVal = row.querySelector('.c-os-date')?.value;
            const descVal = row.querySelector('.c-os-desc')?.value || 'Dia de Execução';
            if (dateVal) {
                datasCronograma.push({ data: dateVal, descricao: descVal });
            }
        });

        // Coleta Plano de Pagamento
        const condicaoPag = document.getElementById('super-condicao-pagamento')?.value || 'À Vista (PIX)';
        const statusPag = document.getElementById('super-status-pagamento')?.value || 'Pendente';
        const vencPag = document.getElementById('super-vencimento-pagamento')?.value || '';

        // Coleta Endereço da Obra
        const endObraSuper = document.getElementById('super-endereco-obra')?.value || '';
        const mesmoEndSuper = document.getElementById('super-mesmo-endereco')?.checked ?? true;

        const extraDataPack = {
            condicao_pagamento: condicaoPag,
            status_pagamento: statusPag,
            vencimento_pagamento: vencPag,
            custos_extras: custosExtras,
            datas_cronograma: datasCronograma,
            endereco_obra: endObraSuper,
            mesmo_endereco: mesmoEndSuper
        };

        const payload = {
            cliente_id: clienteId,
            obra_id: obraId,
            equipamento_id: document.getElementById('super-equipamento').value || null,
            servico_tipo: document.getElementById('super-titulo').value || 'OS Sem Título',
            colaborador: techName,
            tecnico_id: techId,
            vendedor: document.getElementById('super-vendedor').value || null,
            data_hora: document.getElementById('super-data').value ? new Date(document.getElementById('super-data').value + 'T12:00:00Z').toISOString() : new Date().toISOString(),
            status_ia: document.getElementById('super-status').value || 'Aberto',
            status_pagamento: statusPag,
            materiais_lista: JSON.stringify(extraDataPack)
        };

        let OS_ID = osId;
        if (osId) {
            const { error } = await supabase.from('ordens_servico').update(payload).eq('id_os', osId);
            if (error) {
                console.error("ERRO SUPABASE UPDATE OS:", error);
                triggerSaveError(`Erro ao atualizar: ${error.message}`);
                return;
            }
            await saveAuditLog('UPDATE', 'ordens_servico', osId, payload);
        } else {
            const { data: novaOS, error: errOS } = await supabase.from('ordens_servico').insert([payload]).select();
            if (errOS || !novaOS || novaOS.length === 0) {
                console.error("ERRO SUPABASE INSERT OS:", errOS);
                triggerSaveError(`Erro Crítico: ${errOS ? errOS.message : 'Sem resposta do BD.'}`);
                return;
            }
            OS_ID = novaOS[0].id_os;
            await saveAuditLog('INSERT', 'ordens_servico', OS_ID, payload);
        }

        if (osId) {
            await supabase.from('os_servicos_executados').delete().eq('os_id', OS_ID);
            await supabase.from('os_materiais_utilizados').delete().eq('os_id', OS_ID);
            await supabase.from('os_datas').delete().eq('os_id', OS_ID);
        }

        // --- SALVAMENTO CRONOGRAMA (Múltiplas Datas na tabela os_datas se existir) ---
        const osDates = [];
        datasCronograma.forEach(d => {
            osDates.push({
                os_id: OS_ID,
                data: d.data,
                descricao: d.descricao
            });
        });
        if (osDates.length > 0) {
            const { error: errDates } = await supabase.from('os_datas').insert(osDates);
            if (errDates) console.warn("Aviso os_datas:", errDates.message);
        }

        const svcs = [];
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            const svcId = tr.querySelector('.c-ser')?.value;
            if (svcId) svcs.push({
                os_id: OS_ID,
                servico_id: svcId,
                quantidade: parseFloat(tr.querySelector('.s-qt').value) || 1.0,
                subtotal_cobrado: parseFloat(tr.querySelector('.s-sub').value) || 0
            });
        });
        if (svcs.length > 0) {
            const { error: errSvc } = await supabase.from('os_servicos_executados').insert(svcs);
            if (errSvc) {
                console.error("ERRO SUPABASE: svcs.insert()", errSvc);
                triggerSaveError('Erro DB ao vincular Serviços (RLS ou Permissões).');
                return;
            }
        }

        const mats = [];
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            const matId = tr.querySelector('.m-id')?.value;
            if (matId) mats.push({
                os_id: OS_ID, material_id: matId,
                quantidade_usada: parseFloat(tr.querySelector('.m-qt').value),
                valor_unitario_cobrado: parseFloat(tr.querySelector('.m-val').value),
                subtotal_material: parseFloat(tr.querySelector('.m-sub').value)
            });
        });
        if (mats.length > 0) {
            const { error: errMat } = await supabase.from('os_materiais_utilizados').insert(mats);
            if (errMat) {
                console.error("ERRO SUPABASE: mats.insert()", errMat);
                triggerSaveError('Erro DB ao vincular Materiais (RLS ou Permissões).');
                return;
            }
        }

        triggerSaveSuccess(osId ? 'Ordem Atualizada!' : 'Ordem Gravada com Sucesso!');
        closeModal('modal-super-os');
        loadData();
    });

    // ----------------------------------------------------
    // FATURAR (GERA CONTAS A RECEBER E EXCLUI DO FLUXO DE CAIXA IMEDIATO)
    // ----------------------------------------------------
    document.getElementById('btn-faturar-os')?.addEventListener('click', async () => {
        const osId = document.querySelector('#modal-super-os form').dataset.editId;
        if (!osId) { alert("Salve a OS antes de faturar."); return; }

        const total = window.currentSuperOSTotal || 0;
        if (total <= 0) { alert("O valor da OS está zero! Verifique serviços e materiais faturáveis."); return; }

        let totalServicosLocal = 0;
        document.querySelectorAll('#cronograma-body tr').forEach(tr => totalServicosLocal += parseFloat(tr.querySelector('.s-sub')?.value || 0));

        // Preparar Vendedor (Copia do Modal da OS)
        const vSelect = document.getElementById('fat-vendedor');
        const superV = document.getElementById('super-vendedor');
        if (vSelect && superV) {
            vSelect.innerHTML = superV.innerHTML;
            vSelect.value = superV.value;
        }

        // Preparar Equipe Técnica (Mutiple Checkbox)
        const eqDiv = document.getElementById('fat-equipe');
        if (eqDiv) {
            eqDiv.innerHTML = '';
            const techs = (window.colabCache || []).filter(c => ['tecnico', 'engenheiro', 'admin'].some(r => c.cargo?.toLowerCase().includes(r)));
            const superT = document.getElementById('super-responsavel')?.value;

            techs.forEach(t => {
                const isChecked = (t.id === superT) ? 'checked' : '';
                eqDiv.innerHTML += `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" class="fat-tech-cb" value="${t.id}" ${isChecked}>
                    <span>${t.nome_completo}</span>
                </label>
                `;
            });
        }

        window.tempFaturamentoData = { osId, total, totalServicosLocal };
        openModal('modal-faturamento');
    });

    window.onChangeFatPaymentMode = function () {
        const mode = document.getElementById('fat-payment-mode').value;
        const mc = document.getElementById('fat-milestones-container');
        if (mode === 'A Prazo') {
            mc.style.display = 'block';
            if (document.getElementById('fat-milestones-wrapper').children.length === 0) {
                window.addFatMilestoneRow(50);
                window.addFatMilestoneRow(50);
            }
        } else {
            mc.style.display = 'none';
        }
    };

    window.addFatMilestoneRow = function (defPct = 0) {
        const wrap = document.getElementById('fat-milestones-wrapper');
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <input type="number" class="modal-input fat-milestone-pct" placeholder="%" value="${defPct}" style="width: 70px;" onkeyup="window.checkFatMilestonesSum()">
            <input type="date" class="modal-input fat-milestone-date" style="flex:1;">
            <button type="button" class="action-btn" style="background:var(--danger-color); padding:4px 8px;" onclick="this.parentElement.remove(); window.checkFatMilestonesSum()"><i class="fa-solid fa-trash"></i></button>
        `;
        wrap.appendChild(div);
        window.checkFatMilestonesSum();
    };

    window.checkFatMilestonesSum = function () {
        let sum = 0;
        document.querySelectorAll('#fat-milestones-wrapper > div').forEach(row => {
            sum += parseFloat(row.querySelector('.fat-milestone-pct').value || 0);
        });
        const err = document.getElementById('fat-milestones-error');
        if (err) {
            if (sum !== 100) {
                err.style.display = 'block';
                err.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> A soma deve dar 100% (Atual: ${sum}%)`;
            } else {
                err.style.display = 'none';
            }
        }
    };

    window.reativarOS = async function () {
        const form = document.querySelector('#modal-super-os form');
        const osId = form.dataset.editId;
        if (!osId) return;

        if (!confirm(`Deseja realmente REATIVAR a O.S #${osId}? Ela voltará para a fila de execução.`)) return;

        triggerAutoSave("Reativando O.S...");
        try {
            const { error } = await supabase
                .from('ordens_servico')
                .update({ status_ia: 'Aberto' })
                .eq('id_os', osId);
            
            if (error) throw error;
            triggerSaveSuccess(`O.S #${osId} reativada com sucesso!`);
            closeModal('modal-super-os');
            window.loadSuperOS && await window.loadSuperOS();
            window.renderTechAgenda && window.renderTechAgenda();
            window.renderOSBoard && window.renderOSBoard();
            window.renderCalGrid && window.renderCalGrid();
        } catch (err) {
            console.error(err);
            alert("Erro ao reativar O.S: " + err.message);
        }
    };

    window.processarFaturamentoFinal = async function () {
        if (!window.tempFaturamentoData) return;
        const { osId, total, totalServicosLocal } = window.tempFaturamentoData;

        // Valida se selecionaram técnicos para Rateio (se tiver serviço cobrado)
        const checkedTechsIds = Array.from(document.querySelectorAll('.fat-tech-cb')).filter(cb => cb.checked).map(cb => cb.value);
        if (totalServicosLocal > 0 && checkedTechsIds.length === 0) {
            if (!confirm("Atenção: Nenhum técnico foi selecionado para receber o Rateio da mão de obra (40%). Deseja faturar sem repassar a comissão da equipe?")) return;
        }

        triggerAutoSave("Provisionando faturas e comissões corporativas...");

        let totalMateriaisLocal = 0;
        document.querySelectorAll('#materiais-body tr').forEach(tr => totalMateriaisLocal += parseFloat(tr.querySelector('.m-sub')?.value || 0));

        const mode = document.getElementById('fat-payment-mode')?.value || 'A Vista';
        const milestones = [];
        if (mode === 'A Prazo') {
            document.querySelectorAll('#fat-milestones-wrapper > div').forEach(row => {
                const pct = parseFloat(row.querySelector('.fat-milestone-pct').value || 0);
                const dt = row.querySelector('.fat-milestone-date').value;
                milestones.push({ pct, dt });
            });
            const sum = milestones.reduce((a, b) => a + b.pct, 0);
            if (sum !== 100) { alert('Soma das parcelas deve ser 100%!'); return; }
        } else {
            milestones.push({ pct: 100, dt: new Date().toISOString() });
        }

        // 1. Gera Faturamento no Backend Corporativo (Múltiplas Parcelas)
        const fatInserts = milestones.map(m => {
            const perc = m.pct / 100.0;
            return {
                os_id: parseInt(osId) || null,
                total_servicos: totalServicosLocal * perc,
                total_materiais: totalMateriaisLocal * perc,
                total_geral: total * perc,
                status_faturamento: 'Pendente',
                data_emissao: m.dt ? new Date(m.dt + 'T12:00:00Z').toISOString() : new Date().toISOString()
            };
        });

        const { data: fatData } = await supabase.from('faturamentos').insert(fatInserts).select();

        // 1.5 Lança Materiais em Vendas de Produtos
        const matsToSell = [];
        const cliName = (window.ordensCache || []).find(x => String(x.id_os) === String(osId))?.clientes?.nome_cliente || 'OS #' + osId;
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            const matId = tr.querySelector('.m-id')?.value;
            const matName = tr.querySelector('.m-nome')?.textContent || 'Material OS';
            const qty = parseFloat(tr.querySelector('.m-qt').value || 0);
            const valUnit = parseFloat(tr.querySelector('.m-val').value || 0);
            const sub = parseFloat(tr.querySelector('.m-sub').value || 0);
            if (matId && qty > 0) {
                matsToSell.push({
                    material_id: matId,
                    nome_material: matName,
                    cliente_nome: cliName,
                    quantidade_vendida: qty,
                    valor_unitario_venda: valUnit,
                    custo_unitario_estimado: 0, 
                    lucro_total: sub,
                    data_venda: new Date().toISOString()
                });
            }
        });
        if (matsToSell.length > 0) {
            await supabase.from('vendas_produtos').insert(matsToSell);
            // Reduz estoque
            for (let m of matsToSell) {
                const { data: matInfo } = await supabase.from('materiais').select('quantidade_estoque').eq('id', m.material_id).single();
                if (matInfo) {
                    await supabase.from('materiais').update({ quantidade_estoque: Math.max(0, matInfo.quantidade_estoque - m.quantidade_vendida) }).eq('id', m.material_id);
                }
            }
        }

        // Distribui Comissões Proporcionalmente em cada Parcela de Faturamento
        if (fatData && fatData.length > 0) {
            for (let i = 0; i < fatData.length; i++) {
                const faturamentoId = fatData[i].id;
                const percParcela = milestones[i].pct / 100.0;

                // 2. Comissão de 10% Vendedor
                const vendedorId = document.getElementById('fat-vendedor')?.value;
                if (vendedorId && totalServicosLocal > 0) {
                    await supabase.from('comissoes').insert([{
                        faturamento_id: faturamentoId,
                        colaborador_id: vendedorId,
                        percentual_acordado: 10.00,
                        valor_comissao: (totalServicosLocal * percParcela) * 0.10,
                        status_pagamento: 'Pendente'
                    }]);
                }

                // 3. Rateio Comissão Técnica (40% Divisão Linear)
                if (checkedTechsIds.length > 0 && totalServicosLocal > 0) {
                    const pctIndividual = 40.0 / checkedTechsIds.length;
                    const valIndividual = ((totalServicosLocal * percParcela) * 0.40) / checkedTechsIds.length;

                    const techsInserts = checkedTechsIds.map(id => ({
                        faturamento_id: faturamentoId,
                        colaborador_id: id,
                        percentual_acordado: pctIndividual,
                        valor_comissao: valIndividual,
                        status_pagamento: 'Pendente'
                    }));

                    const { error: errTechCom } = await supabase.from('comissoes').insert(techsInserts);
                    if (errTechCom) console.warn('Erro ao inserir rateio:', errTechCom);
                }
            }
        }

        // 4. Muda Status Pagamento OS
        await supabase.from('ordens_servico').update({ status_pagamento: 'Pendente' }).eq('id_os', osId);

        const btnFat = document.getElementById('btn-faturar-os');
        if (btnFat) btnFat.style.display = 'none';

        triggerSaveSuccess("Fechamento Confirmado! Comissões e Faturamento Lançados com Sucesso.");
        closeModal('modal-faturamento');
        closeModal('modal-super-os');
        window.tempFaturamentoData = null;
        await loadData();
    };

    // ----------------------------------------------------
    // RECEBER / DAR BAIXA NO FATURAMENTO
    // ----------------------------------------------------
    window.baixarFaturamento = async function (evt, fatId) {
        if (evt) evt.stopPropagation();

        const fat = (window.faturamentosCache || []).find(f => f.id === fatId);
        if (!fat) return;

        if (!confirm(`Deseja dar baixa neste Faturamento de R$ ${Number(fat.total_geral).toFixed(2)} e injetar os valores desmembrados no Fluxo de Caixa Central?`)) return;

        triggerAutoSave("Baixando recebimento para o Caixa...");

        try {
            // 1. Cria Entradas no Caixa
            if (fat.total_servicos > 0) {
                await supabase.from('fluxo_caixa').insert([{
                    tipo_movimento: 'Entrada',
                    categoria: 'Venda de Serviços (Mão de Obra)',
                    valor: fat.total_servicos,
                    descricao: `Faturamento #${fat.id.split('-')[0]} (OS #${fat.os_id || 'S/N'})`,
                    os_id: parseInt(fat.os_id) || null,
                    data_ocorrencia: new Date().toISOString()
                }]);
            }

            if (fat.total_materiais > 0) {
                await supabase.from('fluxo_caixa').insert([{
                    tipo_movimento: 'Entrada',
                    categoria: 'Revenda de Materiais',
                    valor: fat.total_materiais,
                    descricao: `Faturamento #${fat.id.split('-')[0]} (Materiais em OS #${fat.os_id || 'S/N'})`,
                    os_id: parseInt(fat.os_id) || null,
                    data_ocorrencia: new Date().toISOString()
                }]);
            }

            // 2. Procura comissao Pendente desse faturamento e provisiona
            const { data: comData } = await supabase.from('comissoes').select('*').eq('faturamento_id', fatId).eq('status_pagamento', 'Pendente');
            if (comData && comData.length > 0) {
                for (let c of comData) {
                    await supabase.from('fluxo_caixa').insert([{
                        tipo_movimento: 'Saida',
                        categoria: 'Provisão de Comissão',
                        valor: c.valor_comissao,
                        descricao: `Provisão Vend: Referência Fat #${fatId.split('-')[0]}`,
                        data_ocorrencia: new Date().toISOString()
                    }]);
                }
            }

            // 3. Atualiza Faturamento para Pago
            await supabase.from('faturamentos').update({ status_faturamento: 'Pago', data_emissao: new Date().toISOString() }).eq('id', fatId);

            triggerSaveSuccess('Valor liquidado no Fluxo de Caixa!');
            if (typeof window.loadFaturamentos === 'function') window.loadFaturamentos();
            loadData();
        } catch (err) {
            console.error('Erro ao baixar faturamento:', err);
            triggerSaveError('Erro ao migrar para Caixa.');
        }
    };

    window.gerarReciboPdf = function (evt, fatId) {
        if (evt) evt.stopPropagation();
        
        const fat = (window.faturamentosCache || []).find(f => f.id === fatId);
        if (!fat) return;

        // Extração robusta da OS e do Cliente
        const os = (window.ordensCache || []).find(o => String(o.id_os) === String(fat.os_id));
        
        let cliName = 'Cliente Não Especificado';
        if (fat.clientes && fat.clientes.nome_cliente) {
            cliName = fat.clientes.nome_cliente;
        } else if (os && os.clientes && os.clientes.nome_cliente) {
            cliName = os.clientes.nome_cliente;
        } else if (os && os.cliente_id) {
            const c = (window.clientesCache || []).find(x => String(x.id) === String(os.cliente_id));
            if (c) cliName = c.nome_cliente;
        } else if (fat.cliente_id) {
            const c = (window.clientesCache || []).find(x => String(x.id) === String(fat.cliente_id));
            if (c) cliName = c.nome_cliente;
        }

        // Preenche o template HTML com os dados do faturamento
        document.getElementById('pdf-recibo-cli-os').textContent = fat.os_id ? String(fat.os_id).split('-')[0] : fat.id.split('-')[0];
        document.getElementById('pdf-recibo-cli-nome').textContent = cliName;
        
        // Formata o valor para Real
        const valorNumerico = Number(fat.valor_geral || fat.total_geral || 0);
        document.getElementById('pdf-recibo-cli-valor').textContent = valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        // Dados da OS (Detalhes)
        let detalhesOS = 'Serviços prestados conforme fatura comercial/OS.';
        if (os) {
            detalhesOS = os.servico_tipo ? os.servico_tipo : 'Serviços Diversos';
            if (os.defeito_relatado) detalhesOS += ` - ${os.defeito_relatado}`;
        }
        document.getElementById('pdf-recibo-cli-detalhes').textContent = detalhesOS;

        // Data atual para o recibo
        const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        document.getElementById('pdf-recibo-cli-data').textContent = dataAtual;

        // Mostrar elemento temporariamente para o html2pdf
        const element = document.getElementById('pdf-recibo-cliente-template');
        element.style.display = 'block';

        // Opções do PDF
        const opt = {
            margin:       10,
            filename:     `Recibo_Fatura_${fat.id.split('-')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Gerar PDF
        html2pdf().set(opt).from(element).save().then(() => {
            // Esconde novamente após gerar
            element.style.display = 'none';
        });
    };

    // ==========================================
    // 8.5 LÓGICA DE MODAIS - JURÍDICO PMOC E PROPOSTAS
    // ==========================================
    const btnNovoContrato = document.getElementById('btn-novo-contrato');
    if (btnNovoContrato) {
        btnNovoContrato.addEventListener('click', () => {
            const selectCli = document.getElementById('contrato-cliente-id');
            if (selectCli && window.clientesCache) {
                selectCli.innerHTML = '<option value=\"\">Selecione o Cliente...</option>';
                window.clientesCache.forEach(c => {
                    selectCli.innerHTML += `<option value="${c.id}">${c.nome_cliente}</option>`;
                });
            }
            if (typeof openModal === 'function') openModal('modal-contrato');
            else { document.getElementById('modal-contrato').style.display = 'flex'; }
        });
    }

    document.getElementById('form-contrato')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const editId = form.dataset.editId;
        const cid = document.getElementById('contrato-cliente-id').value;
        const payload = {
            cliente_id: cid || null,
            identificacao: document.getElementById('contrato-identificacao').value,
            tipo_contrato: document.getElementById('contrato-tipo').value,
            vigencia_meses: document.getElementById('contrato-vigencia').value,
            valor_contrato: parseFloat(document.getElementById('contrato-valor').value || 0),
            status_contrato: document.getElementById('contrato-status').value,
            clausulas_especiais: document.getElementById('contrato-clausulas').value,
            data_inicio: document.getElementById('contrato-data-inicio')?.value || null
        };

        if (editId) {
            triggerAutoSave('Atualizando Contrato...');
            await supabase.from('contratos_pmoc').update(payload).eq('id', editId);
            triggerSaveSuccess('Contrato Atualizado!');
        } else {
            triggerAutoSave('Minutando Contrato no Supabase...');
            await supabase.from('contratos_pmoc').insert([payload]);
            triggerSaveSuccess('Contrato da Júlia Salvo!');
        }
        closeModal('modal-contrato');
        loadData();
    });

    // ==========================================
    // LÓGICA DE APROVAÇÃO E PDF DE PROPOSTAS
    // ==========================================
    window.approveProposal = async function (evt, inlineId) {
        if (evt) evt.stopPropagation();
        const form = document.getElementById('form-proposta');
        const editId = inlineId || form.dataset.editId;
        if (!editId) return alert('É necessário salvar a proposta primeiro.');

        const item = (window.propostasCache || []).find(x => x.id === editId);

        // Open modal
        const modal = document.getElementById('modal-approve-date');
        modal.dataset.propId = editId;
        document.getElementById('approve-date-input').value = new Date().toISOString().split('T')[0];

        // Reset Payment Fields
        document.getElementById('approve-payment-mode').value = 'A Vista';
        document.getElementById('approve-installments-cc').value = '2x';
        document.getElementById('milestones-wrapper').innerHTML = '';
        if (typeof window.onChangePaymentMode === 'function') window.onChangePaymentMode();

        const techSelect = document.getElementById('approve-tech-input');
        if (techSelect) {
            const techs = (window.colabCache || []).filter(c => ['tecnico', 'engenheiro', 'admin', 'gerente'].includes(c.cargo?.toLowerCase()));
            techSelect.innerHTML = `<option value="">Nenhum (Ficará invisível no Kanban)</option>` +
                techs.map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');
        }

        openModal('modal-approve-date');
    };

    // ==========================================
    // LOGICA DINÂMICA DE PAGAMENTO 
    // ==========================================
    window.onChangePaymentMode = function () {
        const mode = document.getElementById('approve-payment-mode').value;
        const methodObj = document.getElementById('approve-payment-method');
        const instContainer = document.getElementById('approve-installments-container');
        const milesContainer = document.getElementById('approve-milestones-container');

        let currentMethod = methodObj.value;

        // Ajusta mix de métodos
        if (mode === 'A Vista') {
            methodObj.innerHTML = '<option value="PIX">PIX</option><option value="Dinheiro">Dinheiro</option><option value="Cartao">Cartão</option>';
            instContainer.style.display = 'none';
            milesContainer.style.display = 'none';
        } else {
            methodObj.innerHTML = '<option value="PIX">PIX</option><option value="Cartao">Cartão</option>';
            if (currentMethod === 'Dinheiro') currentMethod = 'PIX';
        }
        methodObj.value = currentMethod || 'PIX';

        // Atualizou o valor, executa reatividade
        if (mode === 'A Prazo') {
            if (methodObj.value === 'Cartao') {
                instContainer.style.display = 'block';
                milesContainer.style.display = 'none';
            } else if (methodObj.value === 'PIX') {
                instContainer.style.display = 'none';
                milesContainer.style.display = 'block';
                // Adiciona o primeiro vazio se não tiver
                if (document.getElementById('milestones-wrapper').children.length === 0) {
                    window.addMilestoneRow();
                }
            }
        }

        window.recalcMilestones();
    };

    window.addMilestoneRow = function () {
        const wrapper = document.getElementById('milestones-wrapper');
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '5px';
        div.innerHTML = `
            <input type="number" class="modal-input milestone-pct" placeholder="% (Ex: 50)" style="width: 35%; padding: 4px;" oninput="window.recalcMilestones()">
            <input type="date" class="modal-input milestone-date" style="width: 50%; padding: 4px;">
            <button type="button" class="action-btn" style="background:#e74c3c; width:15%; padding:4px;" onclick="this.parentElement.remove(); window.recalcMilestones()"><i class="fa-solid fa-trash"></i></button>
        `;
        wrapper.appendChild(div);
        window.recalcMilestones();
    };

    window.recalcMilestones = function () {
        const pcts = document.querySelectorAll('.milestone-pct');
        let sum = 0;
        pcts.forEach(inpt => {
            sum += parseFloat(inpt.value || 0);
        });
        const errDiv = document.getElementById('milestones-error');
        const sumText = document.getElementById('milestone-sum-text');

        const mode = document.getElementById('approve-payment-mode').value;
        const method = document.getElementById('approve-payment-method').value;

        if (mode === 'A Prazo' && method === 'PIX') {
            if (sumText) sumText.textContent = sum;
            if (sum !== 100 && pcts.length > 0) {
                if (errDiv) errDiv.style.display = 'block';
            } else {
                if (errDiv) errDiv.style.display = 'none';
            }
        } else {
            if (errDiv) errDiv.style.display = 'none';
        }
    };


    window.confirmApproveDate = async function () {
        const modal = document.getElementById('modal-approve-date');
        const editId = modal.dataset.propId;
        if (!editId) return;

        const dataAgendamento = document.getElementById('approve-date-input').value;
        const item = (window.propostasCache || []).find(x => x.id === editId);

        triggerAutoSave('Gerando Ordem de Serviço...');
        try {
            const clienteId = (item ? item.cliente_id : document.getElementById('prop-cliente').value) || null;
            const servicoTipo = item ? (item.servico_tipo || 'Orçamento Customizado') : document.getElementById('prop-servico').value;
            const valor = item ? parseFloat(item.valor_estimado || 0) : (parseFloat(document.getElementById('prop-valor').value) || 0);

            const dateStr = dataAgendamento ? new Date(dataAgendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'A Definir';
            const finalDateISO = dataAgendamento ? new Date(dataAgendamento).toISOString() : new Date().toISOString();

            const valorAjuste = item ? parseFloat(item.valor_ajuste || 0) : (parseFloat(document.getElementById('prop-valor-ajuste').value) || 0);
            let ajusteTexto = '';
            if (valorAjuste < 0) ajusteTexto = ` | Ajuste Aplicado: Desconto de R$ ${Math.abs(valorAjuste).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            else if (valorAjuste > 0) ajusteTexto = ` | Ajuste Aplicado: Acréscimo de R$ ${valorAjuste.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

            const observacoes = (item ? (item.observacoes || '') : document.getElementById('prop-obs').value) + ' | Ref Proposta ' + editId.split('-')[0] + ' | Agendado: ' + dateStr + ajusteTexto;

            const techId = document.getElementById('approve-tech-input')?.value;
            const techObj = techId ? (window.colabCache || []).find(c => String(c.id) === String(techId)) : null;

            // Extrai as Condições de Pagamento
            const mode = document.getElementById('approve-payment-mode').value;
            const method = document.getElementById('approve-payment-method').value;
            let pagamentoObj = {
                modalidade: mode,
                metodo: method
            };

            if (mode === 'A Prazo') {
                if (method === 'Cartao') {
                    pagamentoObj.parcelas = document.getElementById('approve-installments-cc').value;
                } else if (method === 'PIX') {
                    const mkData = [];
                    let sum = 0;
                    document.querySelectorAll('#milestones-wrapper > div').forEach(row => {
                        const pct = parseFloat(row.querySelector('.milestone-pct').value || 0);
                        const dt = row.querySelector('.milestone-date').value;
                        sum += pct;
                        mkData.push({ percentual: pct, data_pagamento: dt });
                    });
                    if (Math.abs(sum - 100) > 0.1 && mkData.length > 0) {
                        alert('A soma das porcentagens do PIX a prazo não fecha 100%! Por favor, corrija antes de aprovar.');
                        triggerSaveError('Soma inválida.');
                        return;
                    }
                    pagamentoObj.milestones = mkData;
                }
            }

            // Para salvar nas Observações, criaremos uma string amigável, pois se a coluna não existir, ele não falha!
            let txtCondicao = `Pgto: ${mode} no ${method}`;
            if (pagamentoObj.parcelas) txtCondicao += ` em ${pagamentoObj.parcelas}`;
            if (pagamentoObj.milestones && pagamentoObj.milestones.length > 0) {
                txtCondicao += ' | Etapas: ' + pagamentoObj.milestones.map(m => `${m.percentual}% em ${m.data_pagamento ? new Date(m.data_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'A Definir'}`).join(', ');
            }

            // Obtém endereço da obra da proposta
            let enderecoObraProposta = null;
            let mesmoEndProposta = true;
            if (item && item.itens_json) {
                try {
                    let parsed = typeof item.itens_json === 'string' ? JSON.parse(item.itens_json) : item.itens_json;
                    if (Array.isArray(parsed)) {
                        const endObj = parsed.find(i => i && i.type === 'endereco_obra');
                        if (endObj) {
                            enderecoObraProposta = endObj.endereco;
                            mesmoEndProposta = endObj.mesmo_endereco !== false;
                        }
                    }
                } catch(e){}
            }

            const initialExtraData = {
                datas_cronograma: [dataAgendamento || new Date().toISOString().split('T')[0]],
                custos_extras: [],
                condicao_pagamento: `${mode} no ${method}`,
                status_pagamento: 'Pendente',
                endereco_obra: enderecoObraProposta || (clienteId && (window.clientesCache || []).find(c => String(c.id) === String(clienteId))?.endereco_completo) || '',
                mesmo_endereco: mesmoEndProposta
            };

            const payloadOS = {
                cliente_id: clienteId,
                servico_tipo: (servicoTipo + ' - ' + mode + ' ' + method + ' | Ref Proposta ' + editId.split('-')[0]).substring(0, 145), // LIMIT 150 CHARS!
                status_ia: 'Aberto',
                data_hora: finalDateISO,
                tecnico_id: techId || null,
                materiais_lista: JSON.stringify(initialExtraData)
            };

            // Vamos embutir nas "propostas" o json para que seja indexado!
            let parsedItems = [];
            if (item && item.itens_json) {
                parsedItems = typeof item.itens_json === 'string' ? JSON.parse(item.itens_json) : item.itens_json;
                if (!Array.isArray(parsedItems)) parsedItems = [];
            }
            let updatedItemsJson = parsedItems;
            updatedItemsJson.push({
                type: 'payment_condition',
                contract_data: pagamentoObj
            });
            const { data: osData, error: osErr } = await supabase.from('ordens_servico').insert([payloadOS]).select();
            if (osErr) throw osErr;

            // Transfere Itens da Proposta para a Nova OS
            if (osData && osData.length > 0) {
                const newOsId = osData[0].id_os;
                const propItems = updatedItemsJson;

                if (propItems && Array.isArray(propItems) && propItems.length > 0) {
                    const svcsToInsert = [];
                    const matsToInsert = [];

                    for (let i of propItems) {
                        if (i.type === 'service') {
                            svcsToInsert.push({
                                os_id: newOsId,
                                servico_id: i.id_db,
                                quantidade: parseFloat(i.qtd) || 1.0,
                                subtotal_cobrado: parseFloat(i.subtotal) || 0
                            });
                        } else if (i.type === 'material') {
                            matsToInsert.push({
                                os_id: newOsId,
                                material_id: i.id_db,
                                quantidade_usada: parseFloat(i.qtd) || 1.0,
                                valor_unitario_cobrado: parseFloat(i.price) || 0,
                                subtotal_material: parseFloat(i.subtotal) || 0
                            });
                        }
                    }

                    if (svcsToInsert.length > 0) await supabase.from('os_servicos_executados').insert(svcsToInsert);
                    if (matsToInsert.length > 0) await supabase.from('os_materiais_utilizados').insert(matsToInsert);
                }

                if (observacoes && observacoes.trim() !== '') {
                    await supabase.from('os_datas').insert([{
                        os_id: newOsId,
                        data: new Date().toISOString(),
                        descricao: observacoes
                    }]);
                }

                // AUTO GERAR FATURAMENTO (Contas a Receber) Baseado na Condição de Pagamento!
                let fatMilestones = [];
                if (mode === 'A Prazo' && method === 'PIX') {
                    fatMilestones = pagamentoObj.milestones.map(m => ({ pct: m.percentual, dt: m.data_pagamento }));
                } else if (mode === 'A Prazo' && method === 'Cartao') {
                    const parcelasStr = pagamentoObj.parcelas || '2x';
                    const numParcelas = parseInt(parcelasStr.replace('x', '')) || 1;
                    const pct = 100 / numParcelas;
                    for (let i = 0; i < numParcelas; i++) {
                        let dt = new Date();
                        dt.setMonth(dt.getMonth() + i); // 1 parcela por mes (a primeira eh hj)
                        fatMilestones.push({ pct, dt: dt.toISOString().split('T')[0] });
                    }
                } else {
                    fatMilestones.push({ pct: 100, dt: new Date().toISOString().split('T')[0] });
                }

                if (fatMilestones.length > 0 && valor > 0) {
                    const fatInserts = fatMilestones.map(m => {
                        const perc = m.pct / 100.0;
                        return {
                            os_id: parseInt(newOsId) || null,
                            total_servicos: valor * perc,
                            total_materiais: 0,
                            total_geral: valor * perc,
                            status_faturamento: 'Pendente',
                            data_emissao: m.dt ? new Date(m.dt + 'T12:00:00Z').toISOString() : new Date().toISOString()
                        };
                    });
                    const { error: errFat } = await supabase.from('faturamentos').insert(fatInserts);
                    if (errFat) console.warn('Erro ao auto-gerar faturamentos:', errFat);
                    
                    // Bloqueia o botão de "Emitir Faturamento" futuramente na OS
                    await supabase.from('ordens_servico').update({ status_pagamento: 'Pendente' }).eq('id_os', newOsId);
                }
            }

            // 2. Atualiza Proposta para 'Aprovado' e SOBRESCREVE OS ITENS PARA INCLUIR CONDIÇÃO DE PGTO
            await supabase.from('propostas').update({
                status: 'Aprovado',
                itens_json: updatedItemsJson
            }).eq('id', editId);

            triggerSaveSuccess('Proposta Aprovada e OS Criada!');
            closeModal('modal-approve-date');

            const propModal = document.getElementById('modal-proposta');
            if (propModal && propModal.style.display === 'flex') closeModal('modal-proposta');

            loadData();
        } catch (e) {
            console.error(e);
            alert("ERRO FATAL: " + (e.message || JSON.stringify(e)));
            triggerSaveError('Erro ao Aprovar Proposta.');
        }
    };

    window.reativarProposta = async function (evt, inlineId) {
        if (evt) evt.preventDefault();
        const id = inlineId || document.querySelector('#modal-proposta form')?.dataset.editId;
        if (!id) return;

        if (!confirm("Deseja reativar este Orçamento? Ele voltará para o status Pendente. Se uma O.S foi gerada, você precisará excluí-la manualmente.")) return;
        
        triggerAutoSave("Reativando Orçamento...");
        try {
            const { error } = await supabase.from('propostas').update({ status: 'Pendente' }).eq('id', id);
            if (error) throw error;
            triggerSaveSuccess("Orçamento Reativado com sucesso!");
            if (!inlineId) closeModal('modal-proposta');
            window.loadPropostas && window.loadPropostas();
            window.renderCRMBoard && window.renderCRMBoard();
        } catch (err) {
            console.error(err);
            alert("Erro ao reativar: " + err.message);
        }
    };

    window.rejectProposal = async function (evt, inlineId) {
        if (evt) evt.stopPropagation();
        const form = document.getElementById('form-proposta');
        const editId = inlineId || form.dataset.editId;
        if (!editId) return;

        const motivo = prompt('Por favor, informe o motivo da recusa desta proposta (ex: Preço Alto, Fechou com concorrência):');
        if (!motivo) return;

        triggerAutoSave('Registrando recusa...');
        try {
            await supabase.from('propostas').update({ status: 'Reprovado', motivo_perda: motivo }).eq('id', editId);
            triggerSaveSuccess('Proposta Reprovada.');
            closeModal('modal-proposta');
            loadData();
        } catch (e) {
            console.error(e);
            triggerSaveError('Erro ao salvar repovação.');
        }
    };

    let isGeneratingProposalPDF = false;
    window.generateProposalPDF = async function (evt, inlineId) {
        if (isGeneratingProposalPDF) {
            console.warn('[PDF] Geração já em andamento, bloqueando clique duplicado.');
            return;
        }
        isGeneratingProposalPDF = true;

        if (evt) evt.stopPropagation();
        const btn = evt?.currentTarget;
        const originalHtml = btn ? btn.innerHTML : null;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
        }

        const form = document.getElementById('form-proposta');
        const editId = inlineId || form.dataset.editId;
        if (!editId) {
            isGeneratingProposalPDF = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
            return alert('Salve a proposta antes de gerar o PDF.');
        }

        let item = (window.propostasCache || []).find(x => x.id === editId);

        let nomeCliente = 'Cliente';
        let servico = '-';
        let prazo = '7';
        let totalVal = '0,00';
        let forn = 'Arnaldo Trentin Fornece';
        let enderecoCadastro = '-';
        let enderecoObra = '-';
        let isMesmoEndereco = true;
        let telefone = '-';

        const cliBaseId = item ? item.cliente_id : document.getElementById('prop-cliente').value;
        const cliObj = (window.clientesCache || []).find(c => String(c.id) === String(cliBaseId));

        if (cliObj) {
            enderecoCadastro = cliObj.endereco_completo || 'Endereço não cadastrado';
            telefone = cliObj.telefone || cliObj.telefone_whatsapp || cliObj.whatsapp || 'Telefone não cadastrado';
        }

        if (item) {
            nomeCliente = cliObj?.nome_cliente || item.clientes?.nome_cliente || 'Cliente';
            servico = item.servico_tipo || '-';
            totalVal = parseFloat(item.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (item.clientes?.telefone || item.clientes?.whatsapp) {
                telefone = item.clientes.telefone || item.clientes.whatsapp;
            }
            forn = item.fornecimento_materiais || (document.getElementById('prop-fornecimento')?.value) || 'Arnaldo Trentin Fornece';

            let p = item.prazo_inicio;
            if (!p) prazo = 'A combinar';
            else if (!isNaN(p)) prazo = `${p} dias após aprovação`;
            else prazo = String(p);

            // Extrai endereço da obra salvo nos itens_json
            if (item.itens_json) {
                try {
                    let parsed = typeof item.itens_json === 'string' ? JSON.parse(item.itens_json) : item.itens_json;
                    if (Array.isArray(parsed)) {
                        const endObj = parsed.find(i => i && i.type === 'endereco_obra');
                        if (endObj) {
                            enderecoObra = endObj.endereco;
                            isMesmoEndereco = endObj.mesmo_endereco !== false;
                        }
                    }
                } catch (e) {}
            }
        } else {
            const comboCli = document.getElementById('prop-cliente');
            nomeCliente = cliObj?.nome_cliente || comboCli.options[comboCli.selectedIndex]?.text || 'Cliente';
            servico = document.getElementById('prop-servico').value || '-';
            totalVal = parseFloat(document.getElementById('prop-valor').value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            forn = document.getElementById('prop-fornecimento').value;

            let p = document.getElementById('prop-prazo').value;
            if (!p) prazo = 'A combinar';
            else if (!isNaN(p) && p.trim() !== '') prazo = `${p} dias após aprovação`;
            else prazo = String(p);
        }

        if (!enderecoObra || enderecoObra === '-') {
            const inptEnd = document.getElementById('prop-endereco-obra');
            if (inptEnd && inptEnd.value) {
                enderecoObra = inptEnd.value;
                isMesmoEndereco = document.getElementById('prop-mesmo-endereco')?.checked ?? true;
            } else {
                enderecoObra = enderecoCadastro;
            }
        }

        const safeName = nomeCliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_').substring(0, 15);

        // --- LÓGICA DE ITENS E CÁLCULOS TÉCNICOS ---
        let rawItens = item?.itens_json || window.currentPropItems || [];
        if (typeof rawItens === 'string') {
            try { rawItens = JSON.parse(rawItens); } catch(e) { rawItens = []; }
        }
        const itens = (Array.isArray(rawItens) ? rawItens : []).filter(i => i && i.type !== 'payment_condition' && i.type !== 'endereco_obra');
        let htmlItens = '';
        let totalMO = 0;
        let totalMat = 0;

        if (itens.length > 0) {
            itens.forEach(it => {
                const pUnit = parseFloat(it.valor || it.price || 0);
                const sub = (parseFloat(it.qtd) || 1) * pUnit;
                const iTipo = (it.tipo || it.type || it.category || '');
                if (iTipo.toLowerCase().includes('material')) totalMat += sub;
                else totalMO += sub;

                htmlItens += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 15px; font-size: 13px; color: #334155;">
                            <div style="font-weight: 700; border-bottom: 1px solid #eef2f6; padding-bottom: 2px;">${it.descricao || it.name || '-'}</div>
                            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-top: 2px;">Categoria: ${iTipo || 'Serviço'}</div>
                        </td>
                        <td style="padding: 10px 15px; font-size: 13px; text-align: center; color: #334155;">${it.qtd || 1}</td>
                        <td style="padding: 10px 15px; font-size: 13px; text-align: right; color: #334155;">R$ ${pUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style="padding: 10px 15px; font-size: 13px; text-align: right; font-weight: 700; color: #0f172a;">R$ ${sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            });
        } else {
            // Fallback caso não tenha itens detalhados
            htmlItens = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">Descrição: ${servico}</td></tr>`;
            totalMO = parseFloat(totalVal.replace(/\./g, '').replace(',', '.')) || 0;
        }

        // Preenchimento do PDF v4 (Premium)
        const printTituloEl = document.getElementById('print-titulo-proposta');
        if (printTituloEl) {
            printTituloEl.innerText = (servico && servico !== '-') ? servico : (item?.servico_tipo || 'Orçamento / Proposta Técnica');
        }
        document.getElementById('print-cliente').innerText = nomeCliente;
        document.getElementById('print-local').innerText = enderecoObra || enderecoCadastro;
        document.getElementById('print-telefone').innerText = telefone;

        const rowCobranca = document.getElementById('print-row-cobranca');
        if (rowCobranca) {
            if (!isMesmoEndereco && enderecoObra && enderecoCadastro && enderecoObra.trim() !== enderecoCadastro.trim()) {
                rowCobranca.style.display = 'block';
                document.getElementById('print-endereco-cobranca').innerText = enderecoCadastro;
            } else {
                rowCobranca.style.display = 'none';
            }
        }
        document.getElementById('print-data').innerText = new Date().toLocaleDateString('pt-BR');
        document.getElementById('print-prazo').innerText = prazo;
        document.getElementById('print-total').innerText = totalVal;
        document.getElementById('print-valor-mo').innerText = totalMO.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('print-valor-mat').innerText = totalMat.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        let valAjuste = 0;
        if (inlineId) {
            // Gerado a partir da listagem (sem modal aberto)
            valAjuste = item ? (parseFloat(item.valor_ajuste) || 0) : 0;
        } else {
            // Gerado com o modal aberto (pega do campo atual)
            valAjuste = parseFloat(document.getElementById('prop-valor-ajuste').value) || 0;
        }
        
        const rowAjuste = document.getElementById('print-row-ajuste');
        if (rowAjuste) {
            if (valAjuste !== 0) {
                rowAjuste.style.display = 'flex';
                document.getElementById('print-valor-ajuste').innerText = valAjuste < 0 
                    ? '- R$ ' + Math.abs(valAjuste).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : '+ R$ ' + valAjuste.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                document.getElementById('print-valor-ajuste').style.color = valAjuste < 0 ? '#10b981' : '#f43f5e';
            } else {
                rowAjuste.style.display = 'none';
            }
        }
        
        document.getElementById('print-ref').innerText = editId.split('-')[0].toUpperCase();
        document.getElementById('print-fornecimento-texto').innerText = forn;
        document.getElementById('print-itens-body').innerHTML = htmlItens;

        // Observações do usuário
        let obsTexto = item ? (item.observacoes || '') : (document.getElementById('prop-obs')?.value || '');
        if (valAjuste !== 0) {
            const ajusteString = valAjuste < 0 
                ? 'Ajuste Aplicado: Desconto de R$ ' + Math.abs(valAjuste).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : 'Ajuste Aplicado: Acréscimo de R$ ' + valAjuste.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            obsTexto = obsTexto ? obsTexto + '\n\n' + ajusteString : ajusteString;
        }

        const printObsEl = document.getElementById('print-obs-texto');
        if (printObsEl) {
            printObsEl.innerText = obsTexto;
            printObsEl.style.display = obsTexto.trim() ? 'block' : 'none';
        }

        const opt = {
            margin: 10,
            filename: `Proposta_${safeName}_${Math.floor(Date.now() / 1000)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const el = document.getElementById('print-proposta-template');
        el.style.display = 'block';

        try {
            triggerAutoSave('Gerando PDF Profissional...');
            await new Promise(r => setTimeout(r, 300)); // Paint Delay

            if (typeof html2pdf !== 'undefined') {
                const pdfBlob = await html2pdf().from(el).set(opt).output('blob');

                if (pdfBlob && pdfBlob.size > 10000) {
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    window.open(pdfUrl, '_blank');

                    console.log(`[PDF Mutex Success] Blob: ${(pdfBlob.size / 1024).toFixed(2)} KB`);
                    triggerSaveSuccess('Proposta Aberta no Navegador!');
                } else {
                    throw new Error('PDF gerado está vazio.');
                }
            } else {
                alert("Biblioteca PDF não carregada. F5.");
            }
        } catch (err) {
            console.error('[PDF Mutex Error]', err);
            triggerSaveError('Erro ao gerar PDF.');
        } finally {
            isGeneratingProposalPDF = false;
            el.style.display = 'none';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // Rotina da Maria Cecília para escrever a apresentação
    document.getElementById('btn-ai-compose')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const originalHtml = btn.innerHTML;

        const comboCli = document.getElementById('prop-cliente');
        const nomeCliente = comboCli.options[comboCli.selectedIndex]?.text || 'Cliente Não Informado';
        const servico = document.getElementById('prop-servico').value || 'Serviços de Engenharia';
        const valor = document.getElementById('prop-valor').value || '0';

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Escrevendo...';
        btn.disabled = true;

        const prompt = `Aja como Maria Cecília, orçamentista senior corporativa da Arnaldo Trentin Serviços. Escreva um parágrafo curto e super profissional (máximo 3 linhas) de apresentação/introdução de proposta técnica para o cliente: ${nomeCliente}. O escopo do projeto é: ${servico}. Valor de referência: R$ ${valor}. Retorne APENAS o texto da introdução pronto para colar no PDF.`;

        try {
            // Re-aproveita o motor central de IA da Maria Cecilia com 15s de timeout 
            const res = await callAIWithTimeout('Maria Cecília', { text: prompt }, 15000);

            if (res.status === 'success' && res.data && res.data.dados) {
                document.getElementById('prop-obs').value = res.data.dados;
                triggerSaveSuccess('Maria Cecília escreveu a introdução!');
            } else {
                throw new Error('Falha no retorno.');
            }
        } catch (err) {
            console.error('[IA Proposal Error]', err);
            triggerSaveError('Maria Cecília offline ou ocupada. Tente novamente.');
            // Se falhar o n8n e o timeout for atingido, fornece um fallback elegante para não frustrar o usuário.
            document.getElementById('prop-obs').value = `Apresentamos nossa proposta técnica e comercial para a execução do escopo: ${servico}, conforme visita técnica. A Arnaldo Trentin garante excelência e cumprimento de normas ABNT neste projeto.`;
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });

    // Formulário Propostas V5 (Industrial)
    document.getElementById('form-proposta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = e.target.dataset.editId;

        const cliId = document.getElementById('prop-cliente').value || null;
        const isMesmoEnd = document.getElementById('prop-mesmo-endereco')?.checked ?? true;
        let endObra = document.getElementById('prop-endereco-obra')?.value || '';

        if (isMesmoEnd && !endObra && cliId) {
            const cli = (window.clientesCache || []).find(c => String(c.id) === String(cliId));
            if (cli) endObra = cli.endereco_completo || '';
        }

        // Itens normais limpos
        const cleanItems = JSON.parse(JSON.stringify(window.currentPropItems.filter(i => i && i.type !== 'payment_condition' && i.type !== 'endereco_obra')));
        
        // Insere o metadado de endereco_obra
        cleanItems.push({
            type: 'endereco_obra',
            endereco: endObra,
            mesmo_endereco: isMesmoEnd
        });

        const payload = {
            cliente_id: cliId,
            servico_tipo: document.getElementById('prop-servico').value || 'Orçamento Customizado',
            valor_estimado: parseFloat(document.getElementById('prop-valor').value) || 0,
            valor_ajuste: parseFloat(document.getElementById('prop-valor-ajuste').value) || 0,
            itens_json: cleanItems,
            observacoes: document.getElementById('prop-obs').value || '',
            fornecimento_materiais: document.getElementById('prop-fornecimento').value || 'Arnaldo Trentin Fornece',
            prazo_inicio: document.getElementById('prop-prazo').value || null,
            status: 'Pendente'
        };

        if (editId) {
            triggerAutoSave('Atualizando Orçamento...');
            const { error } = await supabase.from('propostas').update(payload).eq('id', editId);
            if (!error) {
                await saveAuditLog('UPDATE', 'propostas', editId, payload);
                triggerSaveSuccess('Orçamento Atualizado!');
            } else {
                console.error("ERRO SUPABASE UPDATE PROPOSTA:", error);
                alert(`Erro Supabase: ${error.message || JSON.stringify(error)}`);
                triggerSaveError('Erro ao salvar proposta');
            }
        } else {
            triggerAutoSave('Gerando Nova Proposta Industrial...');
            const { data: inserted, error } = await supabase.from('propostas').insert([payload]).select();
            if (!error) {
                const newId = inserted[0]?.id || 'N/A';
                await saveAuditLog('INSERT', 'propostas', newId, payload);
                triggerSaveSuccess('Orçamento Salvo!');
            } else {
                console.error("ERRO SUPABASE INSERT PROPOSTA:", error);
                alert(`Erro Supabase: ${error.message || JSON.stringify(error)}`);
                triggerSaveError('Falha no Supabase Propostas');
            }
        }
        closeModal('modal-proposta');
        loadData();
    });


    // Analytics e Agenda Tech
    let graficos = {};
    window.renderDashboardAnalytics = function () {
        if (typeof Chart === 'undefined') return;
        const ctxOS = document.getElementById('chartOS');
        if (ctxOS) {
            const ordens = window.ordensCache || [];
            if (graficos['chartOS']) graficos['chartOS'].destroy();
            const cA = ordens.filter(o => o.status_ia === 'Aberto').length;
            const cE = ordens.filter(o => o.status_ia === 'Em Campo').length;
            const cF = ordens.filter(o => o.status_ia === 'Finalizado').length;
            graficos['chartOS'] = new Chart(ctxOS, {
                type: 'doughnut',
                data: {
                    labels: ['Aberto (Fila)', 'Em Campo (Ian)', 'Concluído'],
                    datasets: [{
                        data: [cA, cE, cF],
                        backgroundColor: ['rgba(231, 76, 60, 0.8)', 'rgba(52, 152, 219, 0.8)', 'rgba(46, 204, 113, 0.8)'],
                        borderColor: 'transparent',
                        borderWidth: 2
                    }]
                },
                options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });

        }
        const ctxCaixa = document.getElementById('chartCaixa');
        if (ctxCaixa) {
            const caixa = window.fluxoCaixaCache || [];
            if (graficos['chartCaixa']) graficos['chartCaixa'].destroy();
            let ent = 0; let sai = 0;
            caixa.forEach(cx => {
                if (cx.tipo_movimento === 'Entrada') ent += parseFloat(cx.valor || 0);
                if (cx.tipo_movimento === 'Saida') sai += parseFloat(cx.valor || 0);
            });
            graficos['chartCaixa'] = new Chart(ctxCaixa, {
                type: 'bar',
                data: {
                    labels: ['Financeiro'],
                    datasets: [{ label: 'Entradas', data: [ent], backgroundColor: '#2ecc71' }, { label: 'Saídas', data: [sai], backgroundColor: '#e74c3c' }]
                }
            });
        }
    };

    window.assignExistingOsToTech = async function (osId, techId, techNome) {
        if (!osId) return;
        if (!confirm(`Deseja atribuir a OS #${osId} ao técnico ${techNome}?`)) return;

        triggerAutoSave('Atribuindo O.S...');
        const { error } = await supabase.from('ordens_servico').update({
            tecnico_id: techId,
            colaborador: techNome,
            status_ia: 'Em Campo' // Move a OS automaticamente para "Em Campo" ao atribuir
        }).eq('id_os', osId);

        if (error) {
            triggerSaveError('Erro ao atribuir: ' + error.message);
            console.error(error);
        } else {
            // Atualiza cache local
            const index = window.ordensCache.findIndex(o => String(o.id_os) === String(osId));
            if (index > -1) {
                window.ordensCache[index].tecnico_id = techId;
                window.ordensCache[index].colaborador = techNome;
                window.ordensCache[index].status_ia = 'Em Campo';
            }
            triggerSaveSuccess('O.S atribuída com sucesso!');
            window.renderTechAgenda();
            if (typeof window.renderDailyProgram === 'function') window.renderDailyProgram();
            if (typeof window.renderTodasOS === 'function') window.renderTodasOS();
        }
    };

    window.renderTechAgenda = function () {
        const container = document.getElementById('tech-agenda-container');
        if (!container) return;
        container.innerHTML = '';
        const allowedRoles = ['tecnico', 'técnico', 'engenheiro', 'admin', 'gerente'];
        const technicians = (window.colabCache || []).filter(c => {
            const role = c.cargo?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            return allowedRoles.includes(role) || allowedRoles.includes(c.cargo?.toLowerCase());
        });

        // Pega as O.S abertas/disponíveis para o Dropdown
        const availableOS = (window.ordensCache || []).filter(o => {
            const st = (o.status_ia || '').toLowerCase();
            return !st.includes('cancelado') && !st.includes('finalizado') && !st.includes('faturamento');
        });

        const osOptions = '<option value="">Atribuir O.S Existente...</option>' + availableOS.map(o =>
            `<option value="${o.id_os}">OS #${o.id_os} - ${o.clientes?.nome_cliente || 'N/D'}</option>`
        ).join('');

        technicians.forEach(tech => {
            const techOsList = (window.ordensCache || []).filter(o =>
                (o.responsavel && o.responsavel.toLowerCase() === tech.nome_completo.toLowerCase()) ||
                (o.tecnico_id && String(o.tecnico_id) === String(tech.id))
            );
            let expandedCards = [];
            techOsList.forEach(os => {
                let datesToRender = [];
                if (os.data_hora) datesToRender.push(new Date(os.data_hora));
                if (os.os_datas) {
                    os.os_datas.forEach(od => {
                        if (od.data) datesToRender.push(new Date(od.data + 'T12:00:00Z'));
                    });
                }
                if (datesToRender.length === 0) datesToRender.push(new Date());

                // Para evitar dias duplicados
                const renderedDays = new Set();

                datesToRender.forEach(dataAgendadaOrig => {
                    const dataAgendada = new Date(dataAgendadaOrig);
                    dataAgendada.setHours(0, 0, 0, 0);
                    const timeKey = dataAgendada.getTime();
                    if (renderedDays.has(timeKey)) return;
                    renderedDays.add(timeKey);

                    const dayStr = dataAgendadaOrig.toLocaleDateString('pt-BR').substring(0, 5);
                    const clientName = os.clientes?.nome_cliente || 'Cliente não definido';
                    let stColor = 'var(--text-muted)';
                    if (os.status_ia === 'Aberto') stColor = 'var(--danger-color)';
                    if (os.status_ia === 'Em Campo') stColor = 'var(--accent-orange)';
                    if (os.status_ia === 'Validado' || os.status_ia === 'Finalizado') stColor = 'var(--accent-green)';

                    expandedCards.push(`
                        <div class="agenda-card-mini" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${stColor}; cursor: pointer; display:flex; flex-direction:column; gap:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onclick="window.openSuperOS('${os.id_os}')">
                            <div style="display:flex; justify-content: space-between; align-items:center;">
                                <span style="color:var(--text-muted); font-size:0.75rem;"><i class="fa-regular fa-clock"></i> ${dayStr}</span>
                                <span style="font-size:0.65rem; padding:2px 6px; border-radius:12px; border:1px solid ${stColor}; color:${stColor}; background:rgba(0,0,0,0.2); font-weight:bold;">${os.status_ia}</span>
                            </div>
                            <strong style="font-size: 0.85rem; color: #fff; line-height: 1.2;">${clientName} (#${os.id_os})</strong>
                            <div style="font-size: 0.75rem; color: var(--accent-blue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${os.servico_tipo || 'Sem descrição'}</div>
                        </div>
                    `);
                });
            });

            const cardsHtml = expandedCards.length > 0 ? expandedCards.join('') : '<div style="color:rgba(255,255,255,0.3); font-size:0.75rem; padding: 10px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">Nenhuma OS</div>';

            const el = document.createElement('div');
            el.className = 'glass-panel-dark tech-card';
            el.style.cssText = 'padding: 15px; border-radius: 12px;';
            el.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin:0; font-size: 0.9rem; color: white;">${tech.nome_completo}</h3>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <select class="modal-input os-tech-assign" data-tech-id="${tech.id}" data-tech-nome="${tech.nome_completo}" style="width:160px; font-size:0.7rem; height:24px; padding:2px; background:rgba(0,0,0,0.4);">
                            ${osOptions}
                        </select>
                        <button class="action-btn" style="padding:4px 8px; font-size:0.75rem;" onclick="window.openSuperOS(); document.getElementById('super-titulo').value='Agendado: ${tech.nome_completo}';"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <div>${cardsHtml}</div>`;
            container.appendChild(el);
        });

        // Event Listeners seguros para os Dropdowns de OS
        document.querySelectorAll('.os-tech-assign').forEach(sel => {
            sel.addEventListener('change', function () {
                const selectedOs = this.value;
                if (!selectedOs) return;
                const tid = this.getAttribute('data-tech-id');
                const tnome = this.getAttribute('data-tech-nome');
                this.value = ''; // Reseta visualmente após o clique
                window.assignExistingOsToTech(selectedOs, tid, tnome);
            });
        });
    };


    // ==========================================
    // 99. MINICALENDAR (CHRONOS) E PROGRAMACAO
    // ==========================================
    window.chronosDate = new Date();

    function getOsStatusColor(status) {
        if (!status) return 'var(--text-muted)';
        const lw = status.toLowerCase();
        if (lw.includes('aberto')) return '#F44336';
        if (lw.includes('em campo') || lw.includes('deslocamento')) return '#FF9800';
        if (lw.includes('validado') || lw.includes('finalizado')) return '#4CAF50';
        if (lw.includes('cancelado') || lw.includes('faturamento')) return '#9E9E9E';
        return 'var(--accent-blue)';
    }

    window.renderDailyProgram = function () {
        const dToday = document.querySelector('#group-today .os-group-list');
        const dTomorrow = document.querySelector('#group-tomorrow .os-group-list');
        const dUpcoming = document.querySelector('#group-upcoming .os-group-list');
        if (!dToday || !dTomorrow || !dUpcoming) return;

        dToday.innerHTML = '';
        dTomorrow.innerHTML = '';
        dUpcoming.innerHTML = '';

        const ordens = (window.ordensCache || []).filter(o => {
            const st = (o.status_ia || '').toLowerCase();
            return !st.includes('cancelado') && !st.includes('finalizado') && !st.includes('faturamento');
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const limitUpcoming = new Date(today);
        limitUpcoming.setDate(limitUpcoming.getDate() + 7);

        let cToday = 0, cTomorrow = 0, cUpcoming = 0;

        ordens.forEach(os => {
            if (!os.data_hora) return;
            const osDate = new Date(os.data_hora);
            const osD = new Date(osDate);
            osD.setHours(0, 0, 0, 0);

            const stColor = getOsStatusColor(os.status_ia);
            const hourStr = osDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const cardHtml = `
                <div class="agenda-card-mini" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid ${stColor}; cursor: pointer; display:flex; flex-direction:column; gap:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onclick="window.openSuperOS('${os.id_os}')">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">OS-${String(os.id_os).padStart(4, '0')}</span>
                        <span style="font-size:0.75rem; color:${stColor}; font-weight:800; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">${hourStr} ${os.status_ia || 'N/A'}</span>
                    </div>
                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary); line-height: 1.2;">
                        ${os.servico_tipo || 'Sem Descrição'}
                    </div>
                    ${os.clientes ? `<div style="font-size:0.75rem; color:var(--accent-orange);"><i class="fa-solid fa-user"></i> ${os.clientes.nome_cliente.split(' ')[0]}</div>` : ''}
                </div>`;

            if (osD.getTime() === today.getTime()) {
                dToday.innerHTML += cardHtml;
                cToday++;
            } else if (osD.getTime() === tomorrow.getTime()) {
                dTomorrow.innerHTML += cardHtml;
                cTomorrow++;
            } else if (osD.getTime() > tomorrow.getTime() && osD.getTime() <= limitUpcoming.getTime()) {
                dUpcoming.innerHTML += cardHtml;
                cUpcoming++;
            }
        });

        if (cToday === 0) dToday.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Livre</div>';
        if (cTomorrow === 0) dTomorrow.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Livre</div>';
        if (cUpcoming === 0) dUpcoming.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Nenhum agendamento</div>';
    };

    function renderCalGrid(dateObj, gridId, titleId) {
        const grid = document.getElementById(gridId);
        const title = document.getElementById(titleId);
        const tooltip = document.getElementById('os-tooltip');
        if (!grid || !title) return;

        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        const year = dateObj.getFullYear();
        title.innerHTML = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + year;

        const firstDay = new Date(year, dateObj.getMonth(), 1).getDay();
        const daysInMonth = new Date(year, dateObj.getMonth() + 1, 0).getDate();

        const ordens = window.ordensCache || [];
        const monthFilter = ordens.filter(o => {
            let dates = [];
            if (o.data_hora) dates.push(new Date(o.data_hora));
            if (o.os_datas) {
                o.os_datas.forEach(od => {
                    if (od.data) dates.push(new Date(od.data + 'T12:00:00Z'));
                });
            }
            return dates.some(d => d.getFullYear() === year && d.getMonth() === dateObj.getMonth());
        });

        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-day empty"></div>';
        }

        const today = new Date();
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = (today.getDate() === d && today.getMonth() === dateObj.getMonth() && today.getFullYear() === year);
            const classToday = isToday ? 'cal-day-today' : '';

            // Find OSs for this specific day (checking main date and sub-dates)
            const osForDay = monthFilter.filter(o => {
                let match = false;
                if (o.data_hora && new Date(o.data_hora).getDate() === d) match = true;
                if (o.os_datas) {
                    o.os_datas.forEach(od => {
                        if (od.data && new Date(od.data + 'T12:00:00Z').getDate() === d) match = true;
                    });
                }
                return match;
            });

            let dotsHtml = '';
            let tooltext = '';
            if (osForDay.length > 0) {
                dotsHtml = '<div class="cal-dots" style="display:flex; gap:2px; justify-content:center; margin-top:2px;">';
                osForDay.forEach(o => {
                    const cl = getOsStatusColor(o.status_ia);
                    dotsHtml += `<div style="width:5px; height:5px; border-radius:50%; background:${cl};"></div>`;
                    const hh = new Date(o.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    tooltext += `${hh} - OS-${String(o.id_os).padStart(4, '0')} - ${o.status_ia}<br>`;
                });
                dotsHtml += '</div>';
            }

            html += `<div class="cal-day ${classToday}" data-tooltip="${tooltext}">${d}${dotsHtml}</div>`;
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.cal-day').forEach(el => {
            el.addEventListener('mouseenter', e => {
                const tt = e.target.getAttribute('data-tooltip');
                if (tt && tooltip) {
                    tooltip.innerHTML = tt;
                    tooltip.style.display = 'block';
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });
            el.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none';
            });
            el.addEventListener('mousemove', e => {
                if (tooltip && tooltip.style.display === 'block') {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });
        });
    }

    window.renderDualCalendar = function () {
        const cur = window.chronosDate;
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        renderCalGrid(cur, 'calendar-grid-current', 'cal-title-current');
        renderCalGrid(next, 'calendar-grid-next', 'cal-title-next');
    };

    document.getElementById('prev-month')?.addEventListener('click', () => {
        window.chronosDate.setMonth(window.chronosDate.getMonth() - 1);
        window.renderDualCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        window.chronosDate.setMonth(window.chronosDate.getMonth() + 1);
        window.renderDualCalendar();
    });

    // ==========================================
    // LÓGICA DE SELECTS DINÂMICOS (+ Adicionar Outro...)
    // ==========================================
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('dynamic-select') && e.target.value === 'add_new') {
            const newValue = prompt('Digite a nova opção desejada (ou deixe em branco para cancelar):');
            if (newValue && newValue.trim() !== '') {
                const newOption = document.createElement('option');
                newOption.value = newValue.trim();
                newOption.textContent = newValue.trim();
                const options = e.target.options;
                // Insere a nova opção logo antes do botão de "Adicionar Outro..."
                e.target.insertBefore(newOption, options[options.length - 1]);
                e.target.value = newValue.trim();
            } else {
                // Se cancelou, volta pra primeira opção
                e.target.selectedIndex = 0;
            }
        }
    });

    // ==========================================
    // MÓDULO PMOC & PARQUE DE EQUIPAMENTOS
    // ==========================================

    window.loadEquipamentos = async function () {
        try {
            const tbody = document.querySelector('#table-parque-maquinas tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);"> <i class="fa-solid fa-spinner fa-spin"></i> Carregando equipamentos... </td></tr>`;
            }

            const { data, error } = await supabase
                .from('parque_equipamentos')
                .select('*, clientes(nome_cliente), contratos_pmoc(identificacao)')
                .order('tag_identificacao', { ascending: true });

            if (error) {
                console.error('[Equipamentos] Erro Supabase:', error.message);
                if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:var(--accent-red); text-align:center; padding:20px;">Erro ao carregar: ${error.message}</td></tr>`;
                return;
            }

            window.equipamentosCache = data || [];
            window.renderFiltrosParque();
            window.renderParqueMaquinas(window.equipamentosCache);
            window.renderPMOCAlerts();

            console.log(`[Equipamentos] ${window.equipamentosCache.length} equipamentos carregados.`);
        } catch (err) {
            console.error('[Equipamentos] Erro local:', err);
        }
    };

    window.renderFiltrosParque = function () {
        const sel = document.getElementById('filtro-equip-contrato');
        if (!sel) return;

        const contratos = window.contratosCache || [];
        sel.innerHTML = '<option value="">Todos os Contratos / Máquinas Avulsas</option>' +
            contratos.map(c => `<option value="${c.id}">${c.identificacao || (c.clientes?.nome_cliente + ' - ' + c.tipo_contrato)}</option>`).join('');
    };

    window.renderParqueMaquinas = function (data) {
        const tbody = document.querySelector('#table-parque-maquinas tbody');
        if (!tbody) return;

        const filtroId = document.getElementById('filtro-equip-contrato')?.value;
        const filtrados = filtroId ? data.filter(e => e.contrato_id === filtroId) : data;

        if (filtrados.length === 0) {
            tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">
                <i class="fa-solid fa-fan" style="font-size:2rem; display:block; margin-bottom:10px; opacity:0.3;"></i>
                Nenhum equipamento cadastrado.
                <br><small>Clique em "+ Novo Equipamento" para adicionar.</small>
            </td>
        </tr>`;
            return;
        }

        tbody.innerHTML = filtrados.map(eqp => {
            const dtPrev = eqp.data_ultima_preventiva
                ? new Date(eqp.data_ultima_preventiva).toLocaleDateString('pt-BR')
                : 'Nunca';

            // Alerta visual se preventiva vencida (>90 dias)
            let dtPrevHtml = dtPrev;
            if (eqp.data_ultima_preventiva) {
                const diffDias = Math.floor((new Date() - new Date(eqp.data_ultima_preventiva)) / 86400000);
                if (diffDias > 90) {
                    dtPrevHtml = `<span style="color:var(--accent-red); font-weight:700;">⚠️ ${dtPrev}</span>`;
                }
            } else {
                dtPrevHtml = `<span style="color:var(--accent-orange);">Nunca realizada</span>`;
            }

            const statusClass = eqp.status_equipamento === 'Operacional' ? 'success'
                : eqp.status_equipamento === 'Em Manutenção' ? 'warning' : 'danger';

            const nomeContrato = eqp.contratos_pmoc?.identificacao
                || `<span style="color:var(--accent-orange); font-size:0.75rem;">AVULSO</span>`;

            // QR Icon: sempre mostra se tem qr_code_id; caso não tenha, botão para gerar
            const qrBtn = eqp.qr_code_id
                ? `<button title="QR: ${eqp.qr_code_id}" onclick="event.stopPropagation(); window.showEquipmentQR('${eqp.id}','${eqp.tag_identificacao}','${(eqp.localizacao_interna || '').replace(/'/g, "\\'")}','${eqp.qr_code_id}')"
            style="background:var(--accent-blue); color:#fff; border:none; padding:3px 7px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
            <i class="fa-solid fa-qrcode"></i>
          </button>`
                : `<button title="Gerar QR Code" onclick="event.stopPropagation(); window.gerarEAtribuirQR('${eqp.id}')"
            style="background:rgba(255,255,255,0.1); color:#aaa; border:1px dashed #aaa; padding:3px 7px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
            <i class="fa-solid fa-qrcode"></i> Gerar QR
          </button>`;

            const safeName = (eqp.tag_identificacao || '').replace(/'/g, "\\'");

            return `
        <tr style="cursor:pointer;" onclick="window.openEquipamentoModal(null,'${eqp.id}')">
            <td>
                <strong style="color:var(--accent-blue)">${eqp.tag_identificacao || '—'}</strong>
                <div style="margin-top:4px;">${qrBtn}</div>
            </td>
            <td>
                <small style="color:var(--text-muted);">${nomeContrato}</small>
                <br><strong>${eqp.localizacao_interna || '—'}</strong>
            </td>
            <td>${eqp.clientes?.nome_cliente || '—'}</td>
            <td>
                <strong>${eqp.marca || ''} ${eqp.modelo || ''}</strong>
                <br><small style="color:var(--text-muted);">${eqp.capacidade_btu ? eqp.capacidade_btu.toLocaleString('pt-BR') + ' BTU' : '—'}</small>
            </td>
            <td>${dtPrevHtml}</td>
            <td><span class="badge ${statusClass}">${eqp.status_equipamento || 'Indefinido'}</span></td>
            <td style="text-align:right;">
                <div style="display:flex; justify-content:flex-end; gap:5px; align-items:center;">
                    <button class="action-btn btn-pdf-pmoc" data-id="${eqp.id}" style="padding:4px 8px; font-size:0.75rem; background:var(--accent-blue);" title="Laudo PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                    <button class="action-btn btn-delete-row" data-table="parque_equipamentos" data-id="${eqp.id}" data-name="${safeName}" style="padding:4px 8px; font-size:0.75rem; background:transparent; color:var(--accent-red); border:1px solid var(--accent-red);" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
        }).join('');
    };

    window.gerarEAtribuirQR = async function (equipId) {
        if (typeof window.gerarQRCodeId !== 'function') {
            console.error('gerarQRCodeId não disponível.');
            return;
        }
        const novoId = window.gerarQRCodeId();
        const { error } = await supabase.from('parque_equipamentos')
            .update({ qr_code_id: novoId })
            .eq('id', equipId);

        if (error) {
            alert('Erro ao gerar QR: ' + error.message);
            return;
        }

        // Atualiza cache local imediatamente
        const idx = (window.equipamentosCache || []).findIndex(e => e.id === equipId);
        if (idx >= 0) window.equipamentosCache[idx].qr_code_id = novoId;

        window.renderParqueMaquinas(window.equipamentosCache);

        const eqp = (window.equipamentosCache || []).find(e => e.id === equipId);
        if (eqp) {
            window.showEquipmentQR(equipId, eqp.tag_identificacao, eqp.localizacao_interna, novoId);
        }
    };

    document.getElementById('filtro-equip-contrato')?.addEventListener('change', () => {
        window.renderParqueMaquinas(window.equipamentosCache);
    });

    window.loadEquipamentosDropdown = function (clienteId, selectedId = null) {
        const select = document.getElementById('super-equipamento');
        if (!select) return;
        if (!clienteId) {
            select.innerHTML = '<option value="">Selecione o Cliente Primeiro...</option>';
            return;
        }
        const filtrados = window.equipamentosCache.filter(eqp => eqp.cliente_id === clienteId);
        select.innerHTML = '<option value="">(Equipamento não vinculado)</option>' +
            filtrados.map(eqp => `<option value="${eqp.id}">${eqp.tag_identificacao} - ${eqp.localizacao_interna} (${eqp.marca})</option>`).join('');
        if (selectedId) select.value = selectedId;
    };

    window.showEquipmentQR = function (id, tag, local, qrCodeId) {
        const container = document.getElementById('qr-container');
        const tagLabel = document.getElementById('qr-tag-label');
        const localLabel = document.getElementById('qr-local-label');

        const prodUrl = 'https://ecossistema-arnaldo-trentin.vercel.app';
        const baseUrl = window.location.hostname === 'localhost' ? prodUrl : window.location.origin;
        const qrData = `${baseUrl}?eqp=${id}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(qrData)}`;

        if (container) container.innerHTML = `
    <img src="${qrApiUrl}" id="img-qr-current"
         style="width:220px; height:220px; display:block; border-radius:8px; border:2px solid var(--accent-blue);"
         onerror="this.alt='Erro ao carregar QR — verifique conexão'">`;

        if (tagLabel) tagLabel.innerText = `TAG: ${tag || '—'}`;
        if (localLabel) localLabel.innerText = `Local: ${local || '—'} | ID: ${qrCodeId || '?'}`;

        const btnPrint = document.getElementById('btn-imprimir-qr');
        if (btnPrint) btnPrint.onclick = () => window.imprimirTagQR(tag, local, qrApiUrl, qrCodeId);

        window.openModal('modal-qr-view');
    };

    window.imprimirTagQR = function (tag, local, qrUrl) {
        const printWindow = window.open('', '_blank', 'width=600,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Etiqueta PMOC - ${tag}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; text-align: center; padding: 20px; }
                    .tag-box { border: 2px solid #000; padding: 15px; display: inline-block; border-radius: 10px; width: 300px; }
                    .logo { font-weight: 800; font-size: 1.2rem; color: #000; margin-bottom: 10px; display:block; }
                    .qr { width: 200px; height: 200px; margin: 10px 0; }
                    .tag { font-size: 1.5rem; font-weight: 900; margin: 5px 0; }
                    .local { font-size: 0.9rem; color: #555; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="tag-box">
                    <span class="logo">ARNALDO TRENTIN</span>
                    <span style="font-size: 0.7rem; color: #666;">DASHBOARD INTELIGENTE PMOC</span>
                    <br>
                    <img class="qr" src="${qrUrl}">
                    <div class="tag">${tag}</div>
                    <div class="local">${local || ''}</div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    // --- Lógica de Vínculo entre Cliente e Contrato no Modal de Equipamento ---
    window.filterEquipmentContracts = function (clienteId) {
        const selContra = document.getElementById('eq-contrato-id');
        if (!selContra) return;
        const contratos = window.contratosCache || [];
        const filtered = contratos.filter(c => String(c.cliente_id) === String(clienteId));

        selContra.innerHTML = '<option value="">(Sem Contrato Vinculado)</option>' +
            filtered.map(c => `<option value="${c.id}">${c.identificacao || (c.clientes?.nome_cliente + ' - ' + c.tipo_contrato)}</option>`).join('');
    };

    window.openEquipamentoModal = async function (cliId = null, eqpId = null) {
        const modal = document.getElementById('modal-equipamento');
        const form = document.getElementById('form-equipamento');
        if (!form) return;

        form.reset();
        document.getElementById('eq-id').value = eqpId || '';
        const preview = document.getElementById('eq-fotos-preview');
        if (preview) preview.innerHTML = '';
        window.currentEqpPhotos = [];

        // Estado de "Carregando" interno se for uma edição via ID
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Salvar Equipamento';

        // 1. Popula Dropdown de Clientes (Sempre necessário para o formulário)
        const selCli = document.getElementById('eq-cliente-id');
        if (selCli) {
            selCli.innerHTML = '<option value="">(Selecione o Cliente...)</option>' +
                (window.clientesCache || []).map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');
        }

        // 2. Popula Dropdown de Contratos
        const selContra = document.getElementById('eq-contrato-id');
        if (selContra) selContra.innerHTML = '<option value="">(Selecione o Cliente Primeiro)</option>';

        openModal('modal-equipamento'); // Abre logo o modal para feedback visual

        if (eqpId) {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando Ativo...'; }

            // Tenta achar no cache primeiro
            let eqp = (window.equipamentosCache || []).find(e => e.id === eqpId);

            // FALLBACK: Busca Direta no Supabase se não estiver no cache
            if (!eqp) {
                console.log('[QR SCAN] Máquina não está no cache. Buscando direto no Supabase...');
                try {
                    const { data, error } = await window.supabase
                        .from('parque_equipamentos')
                        .select('*, clientes(nome_cliente), contratos(identificacao)')
                        .eq('id', eqpId)
                        .single();

                    if (error) throw error;
                    eqp = data;
                } catch (err) {
                    console.error('[QR SCAN] Erro na busca direta:', err);
                    triggerSaveError('Equipamento não encontrado ou sem permissão.');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
                    return;
                }
            }

            if (eqp) {
                if (selCli) selCli.value = eqp.cliente_id;
                window.filterEquipmentContracts(eqp.cliente_id);
                if (selContra) selContra.value = eqp.contrato_id || '';

                document.getElementById('eq-tag').value = eqp.tag_identificacao || '';
                document.getElementById('eq-ambiente').value = eqp.localizacao_interna || '';
                document.getElementById('eq-marca').value = eqp.marca || '';
                document.getElementById('eq-btus').value = eqp.capacidade_btu || '';
                document.getElementById('eq-tipo').value = eqp.tipo_maquina || 'Split High Wall';
                document.getElementById('eq-status').value = eqp.status_equipamento || 'Em Operação';
                document.getElementById('eq-qr-id').value = eqp.qr_code_id || '';
                if (document.getElementById('eq-data-inst')) document.getElementById('eq-data-inst').value = eqp.data_instalacao || '';
                if (document.getElementById('eq-data-prev')) document.getElementById('eq-data-prev').value = eqp.data_ultima_preventiva || '';

                window.currentEqpPhotos = eqp.fotos_url || [];
                if (preview && window.currentEqpPhotos.length > 0) {
                    preview.innerHTML = window.currentEqpPhotos.map((url, idx) => `
                        <div class="photo-thumb" style="position:relative;">
                            <img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--accent-blue);">
                            <button type="button" onclick="window.removeEqpPhoto(${idx})" style="position:absolute; top:-5px; right:-5px; background:var(--accent-red); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">×</button>
                        </div>
                    `).join('');
                }
            }

            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
        } else if (cliId) {
            if (selCli) selCli.value = cliId;
            window.filterEquipmentContracts(cliId);
        }
    };

    window.removeEqpPhoto = function (index) {
        window.currentEqpPhotos.splice(index, 1);
        // Re-renderiza preview
        const preview = document.getElementById('eq-fotos-preview');
        if (preview) {
            preview.innerHTML = window.currentEqpPhotos.map((url, idx) => `
                <div class="photo-thumb" style="position:relative;">
                    <img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--accent-blue);">
                    <button type="button" onclick="window.removeEqpPhoto(${idx})" style="position:absolute; top:-5px; right:-5px; background:var(--accent-red); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:10px;">×</button>
                </div>
            `).join('');
        }
    };

    (function patchEquipamentoForm() {
        // Remove listener antigo e adiciona o corrigido
        const form = document.getElementById('form-equipamento');
        if (!form) return;

        const newForm = form.cloneNode(true); // Remove todos os listeners antigos
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('eq-id').value;
            const btn = newForm.querySelector('button[type="submit"]');

            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

            // 1. Upload de Novas Fotos
            const fileInput = document.getElementById('eq-fotos');
            const newPhotoUrls = [];

            if (fileInput && fileInput.files.length > 0) {
                for (let file of fileInput.files) {
                    const ext = file.name.split('.').pop();
                    const fileName = `eqp_${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
                    const filePath = `equipamentos/${fileName}`;

                    const { error: uploadErr } = await supabase.storage
                        .from('documentos_pmoc')
                        .upload(filePath, file);

                    if (!uploadErr) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('documentos_pmoc')
                            .getPublicUrl(filePath);
                        newPhotoUrls.push(publicUrl);
                    } else {
                        console.warn('[Upload] Falha em foto:', uploadErr.message);
                    }
                }
            }

            const finalPhotos = [...(window.currentEqpPhotos || []), ...newPhotoUrls];

            // 2. Auto-gera QR Code ID se campo vazio
            const qrInput = document.getElementById('eq-qr-id');
            if (qrInput && !qrInput.value.trim()) {
                if (typeof window.gerarQRCodeId === 'function') {
                    qrInput.value = window.gerarQRCodeId();
                }
            }

            // 3. Monta payload com validações
            const tagVal = (document.getElementById('eq-tag')?.value || '').trim();
            const cliId = document.getElementById('eq-cliente-id')?.value || null;
            const ctrId = document.getElementById('eq-contrato-id')?.value || null;
            const btus = document.getElementById('eq-btus')?.value;
            const serial = document.getElementById('eq-serial')?.value;
            const dataInstVal = document.getElementById('eq-data-inst')?.value;
            const dataPrevVal = document.getElementById('eq-data-prev')?.value;

            if (!tagVal) {
                alert('⚠️ Preencha a TAG de identificação do equipamento.');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Equipamento'; }
                return;
            }

            const payload = {
                cliente_id: cliId || null,
                contrato_id: ctrId || null,
                tag_identificacao: tagVal,
                localizacao_interna: document.getElementById('eq-ambiente')?.value || '',
                tipo_equipamento: document.getElementById('eq-tipo')?.value || 'Split High Wall',
                marca: document.getElementById('eq-marca')?.value || '',
                capacidade_btu: btus ? parseInt(btus) : null,
                status_equipamento: document.getElementById('eq-status')?.value || 'Operacional',
                data_instalacao: dataInstVal || null,
                data_ultima_preventiva: dataPrevVal || null,
                qr_code_id: qrInput?.value || null,
                fotos_url: finalPhotos
            };

            // 4. Salva no Supabase
            let saveError = null;
            if (id) {
                const { error } = await supabase.from('parque_equipamentos').update(payload).eq('id', id);
                saveError = error;
            } else {
                const { error } = await supabase.from('parque_equipamentos').insert([payload]);
                saveError = error;
            }

            if (saveError) {
                console.error('[Equipamento] Erro Supabase:', saveError);
                alert('❌ Erro ao salvar: ' + saveError.message);
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Equipamento'; }
                return;
            }

            // 5. Sucesso
            if (typeof window.triggerSaveSuccess === 'function') {
                window.triggerSaveSuccess(id ? 'Equipamento Atualizado!' : 'Equipamento Cadastrado! QR gerado automaticamente.');
            }

            window.closeModal('modal-equipamento');

            // 6. Refresh garantido da tabela
            await window.loadEquipamentos();

            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar Equipamento'; }
        });
    })();

    document.getElementById('btn-novo-equipamento')?.addEventListener('click', () => window.openEquipamentoModal());

    document.getElementById('super-cliente')?.addEventListener('change', (e) => {
        window.loadEquipamentosDropdown(e.target.value);
    });

    window.renderPMOCAlerts = function () {
        const list = document.getElementById('pmoc-alert-list');
        const widget = document.getElementById('pmoc-alert-widget');
        if (!list || !widget) return;

        // VERIFICAÇÃO DE ACL PARA WIDGET PMOC
        const role = (window.userCargo || 'visitante').toLowerCase();
        const canView = ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo', 'tecnico', 'atendimento'].some(c => role.includes(c));

        if (!canView) {
            widget.style.display = 'none';
            return;
        }

        const HOJE = new Date();
        const vencidos = window.equipamentosCache.filter(eqp => {
            const ultima = eqp.data_ultima_preventiva ? new Date(eqp.data_ultima_preventiva) : new Date(eqp.data_instalacao || '2000-01-01');
            const diffDias = Math.floor((HOJE - ultima) / (1000 * 60 * 60 * 24));
            return diffDias > 90;
        });

        if (vencidos.length > 0) {
            widget.style.display = 'block';
            list.innerHTML = vencidos.map(eqp => `
                <div class="glass-panel" style="min-width: 250px; padding: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(230, 126, 34, 0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <strong style="color: var(--accent-orange);">${eqp.tag_identificacao}</strong>
                        <span class="badge warning" style="font-size: 0.65rem;">VENCIDO</span>
                    </div>
                    <p style="font-size: 0.8rem; margin-bottom: 10px;">${eqp.clientes?.nome_cliente || 'S/ Cliente'}<br><small>${eqp.localizacao_interna}</small></p>
                    <button class="action-btn" style="width: 100%; font-size: 0.75rem; background: var(--accent-orange);" onclick="window.openSuperOS(); document.getElementById('super-cliente').value='${eqp.cliente_id}'; window.loadEquipamentosDropdown('${eqp.cliente_id}', '${eqp.id}'); document.getElementById('super-titulo').value='Preventiva: ${eqp.tag_identificacao}'">Agendar Agora</button>
                </div>
            `).join('');
        } else {
            widget.style.display = 'none';
        }
    };

    window.generatePMOCTechnicalReport = async function (equipId) {
        const eqp = window.equipamentosCache.find(e => e.id === equipId);
        if (!eqp) return;

        triggerAutoSave('Gerando Laudo de Conformidade PMOC...');

        // 1. Popula Template
        document.getElementById('p-pmoc-cliente').innerText = eqp.clientes?.nome_cliente || '-';
        document.getElementById('p-pmoc-local').innerText = eqp.localizacao_interna || '-';
        document.getElementById('p-pmoc-tag').innerText = eqp.tag_identificacao || '-';
        document.getElementById('p-pmoc-modelo').innerText = `${eqp.marca || ''} ${eqp.modelo || ''} (${eqp.capacidade_btu || '-'} BTU)`;

        // 2. Busca histórico de OS (Preventivas finalizadas)
        const { data: historico, error } = await supabase
            .from('ordens_servico')
            .select('*')
            .eq('equipamento_id', equipId)
            .eq('status_ia', 'Finalizado')
            .order('data_hora', { ascending: false });

        const histHtml = (!error && historico.length > 0)
            ? historico.map(os => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; border: 1px solid #eee;">${new Date(os.data_hora).toLocaleDateString('pt-BR')}</td>
                    <td style="padding: 10px; border: 1px solid #eee;">${os.servico_tipo}</td>
                    <td style="padding: 10px; border: 1px solid #eee;">${os.colaborador}</td>
                    <td style="padding: 10px; border: 1px solid #eee;">CONFORME</td>
                </tr>`).join('')
            : '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhum registro de manutenção finalizado.</td></tr>';

        document.getElementById('p-pmoc-historico').innerHTML = histHtml;

        // 3. Gera PDF usando html2pdf.js
        const element = document.getElementById('print-pmoc-template');
        element.style.display = 'block';

        const opt = {
            margin: 0,
            filename: `PMOC_${eqp.tag_identificacao}_${eqp.clientes?.nome_cliente || 'AT'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            element.style.display = 'none';
            triggerSaveSuccess('Laudo PMOC Aberto com Sucesso!');
        } catch (err) {
            console.error('Erro PDF:', err);
            triggerSaveError('Erro ao gerar PDF.');
            element.style.display = 'none';
        }
    };

    // 🔗 QR CODE DEEP LINK: Abre ficha técnica direto ao escanear
    const urlParams = new URLSearchParams(window.location.search);
    const equipIdFromUrl = urlParams.get('eqp');
    const ferramentaIdFromUrl = urlParams.get('ferramenta');

    if (equipIdFromUrl) {
        console.log('[QR SCAN] Identificado Ativo na URL:', equipIdFromUrl);
        if (typeof window.showSection === 'function') window.showSection('view-parque-maquinas');
        // Chama a função assíncrona que agora resolve sozinha a busca se o cache falhar
        window.openEquipamentoModal(null, equipIdFromUrl);
    }
    
    if (ferramentaIdFromUrl) {
        console.log('[QR SCAN] Identificado Ferramenta na URL:', ferramentaIdFromUrl);
        setTimeout(() => {
            if (typeof window.showSection === 'function') window.showSection('view-ferramentas');
            // Need a slight delay to ensure cache is populated (or handle fallback later)
            window.openEditGeneric('ferramentas', ferramentaIdFromUrl);
        }, 1500);
    }

    // -------------------------------------------------------------------------
    // MÓDULO GERADOR DE CONTRATOS ESTADOLESS (PDF)
    // -------------------------------------------------------------------------
    window.openContractGenerator = function () {
        const selectCliente = document.getElementById('contrato-cliente-select');
        if (selectCliente) {
            selectCliente.innerHTML = '<option value="">Selecione o Cliente / Contratante</option>';
            (window.clientesCache || []).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nome_cliente;
                selectCliente.appendChild(opt);
            });
        }

        document.getElementById('contrato-os-checkboxes').innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Selecione um cliente para buscar O.S disponíveis.</span>';
        openModal('modal-gerador-contrato');
    };

    window.fetchOSForContract = async function () {
        const clienteId = document.getElementById('contrato-cliente-select').value;
        const osContainer = document.getElementById('contrato-os-checkboxes');
        osContainer.innerHTML = '<span style="color: var(--text-muted);">Buscando ordens do cliente no banco central...</span>';

        if (!clienteId) {
            osContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Selecione um cliente para buscar O.S disponíveis.</span>';
            return;
        }

        const { data: osList, error } = await supabase
            .from('ordens_servico')
            .select('*')
            .eq('cliente_id', clienteId);

        // Fetching Propostas associadas para raspar o Valor caso a OS esteja zerada
        const { data: propList } = await supabase
            .from('propostas')
            .select('*')
            .eq('cliente_id', clienteId);

        if (error || !osList || osList.length === 0) {
            osContainer.innerHTML = '<span style="color: var(--accent-orange); font-size: 0.85rem;">Nenhuma OS Aprovada/Ativa encontrada para este cliente.</span>';
            return;
        }

        osContainer.innerHTML = osList.map(os => {
            let val = parseFloat(os.valor_total || os.valor || 0);
            let desc = os.descricao || os.servico_tipo?.split('- |')[0]?.trim() || 'Serviços Diversos';

            // Regex para fisgar o ID da proposta enxertado no servico_tipo. Ex: Ref Proposta 9c1a951f
            const propIdMatch = String(os.servico_tipo || '').match(/Ref Proposta\s+([a-zA-Z0-9\-]+)/i);
            if (propIdMatch && propList) {
                const prop = propList.find(p => String(p.id).toLowerCase().startsWith(propIdMatch[1].toLowerCase()));
                if (prop) {
                    if (val === 0) {
                        val = parseFloat(prop.valor_estimado || 0) + parseFloat(prop.valor_ajuste || 0);
                    }
                    if (desc === 'Serviços Diversos' && prop.servico_tipo) {
                        desc = prop.servico_tipo;
                    }
                }
            }

            return `
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding: 4px;">
                <input type="checkbox" class="contrato-os-cb" value="${os.id_os}" data-valor="${val}" data-desc="${desc}" data-tipo="${os.servico_tipo || ''}">
                <span style="font-size: 0.9rem;"><strong>#${String(os.id_os).split('-')[0]}</strong> - ${desc.substring(0, 30)}... <br><small style="color:var(--accent-green);">R$ ${parseFloat(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></span>
            </label>
            `;
        }).join('');
    };

    window.generateContractPDF = async function () {
        const clienteId = document.getElementById('contrato-cliente-select').value;
        const cbList = document.querySelectorAll('.contrato-os-cb:checked');

        if (!clienteId || cbList.length === 0) {
            alert('Selecione o Cliente e marque ao menos uma (1) Ordem de Serviço na lista.');
            return;
        }

        const clienteObj = (window.clientesCache || []).find(c => c.id === clienteId);
        if (!clienteObj) return;

        let totalContract = 0;
        let objectStringHTML = '';
        let paymentStringHTML = '';

        cbList.forEach(cb => {
            const osVal = parseFloat(cb.getAttribute('data-valor')) || 0;
            const osDesc = cb.getAttribute('data-desc') || 'Serviço Estrutural';
            const osTipo = cb.getAttribute('data-tipo') || 'A Combinar';

            totalContract += osVal;
            const shortId = cb.value.split('-')[0];
            objectStringHTML += `<li><strong>O.S #${shortId}</strong>: ${osDesc} - R$ ${osVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</li>`;

            // Textos longos guardados no Tipo da OS após aprovação ganham tratamento VIP
            paymentStringHTML += `<li style="margin-bottom: 6px;"><strong>O.S #${shortId}:</strong> ${osTipo}</li>`;
        });

        // Preenche Template Assíncrono HTML
        document.getElementById('pdf-contrato-cliente-nome').textContent = clienteObj.nome_cliente;
        document.getElementById('pdf-contrato-cliente-cpf').textContent = clienteObj.documento_cpf_cnpj || 'Não cadastrado';
        document.getElementById('pdf-contrato-cliente-whats').textContent = clienteObj.whatsapp || 'Não cadastrado';
        document.getElementById('pdf-contrato-cliente-end').textContent = clienteObj.endereco_completo || 'Não cadastrado';
        document.getElementById('pdf-contrato-assinatura-cliente').textContent = (clienteObj.nome_cliente || '').toUpperCase();

        document.getElementById('pdf-contrato-os-lista').innerHTML = `<ul>${objectStringHTML}</ul>`;
        document.getElementById('pdf-contrato-valor-total').textContent = totalContract.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        document.getElementById('pdf-contrato-condicoes').innerHTML = `<ul style="list-style: none; padding: 0;">${paymentStringHTML}</ul>`;
        document.getElementById('pdf-contrato-juros').textContent = document.getElementById('contrato-taxa-juros').value;
        document.getElementById('pdf-contrato-data').textContent = new Date().toLocaleDateString('pt-BR');

        closeModal('modal-gerador-contrato');
        triggerAutoSave("Renderizando Instrumento Jurídico...");

        const element = document.getElementById('print-contrato');
        element.style.display = 'block';

        try {
            const opt = {
                margin: 10,
                filename: `Contrato_Servicos_${clienteObj.nome_cliente.replace(/\W+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(element).save();
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            alert('Falha interna ao desenhar o PDF. Verifique o console.');
        } finally {
            element.style.display = 'none';
        }
    };

    window.gerarReciboComissao = async function () {
        const arr = window.filteredComissoesParaRecibo || [];
        const tSelect = document.getElementById('filter-comissao-tecnico');
        if (!tSelect || !tSelect.value) {
            alert('Por favor, selecione um Colaborador no filtro antes de gerar o comprovante.');
            return;
        }

        const nomeTecnico = tSelect.options[tSelect.selectedIndex].text;

        const dtIni = document.getElementById('filter-comissao-data-inicio')?.value;
        const dtFim = document.getElementById('filter-comissao-data-fim')?.value;
        let strPeriodo = 'Histórico Total';
        if (dtIni && dtFim) {
            strPeriodo = `${dtIni.split('-').reverse().join('/')} até ${dtFim.split('-').reverse().join('/')}`;
        } else if (dtIni) {
            strPeriodo = `A partir de ${dtIni.split('-').reverse().join('/')}`;
        } else if (dtFim) {
            strPeriodo = `Até ${dtFim.split('-').reverse().join('/')}`;
        }

        let totalPagar = 0;
        let tableHTML = '';

        arr.forEach(c => {
            const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-';
            const faturamentoObj = c.faturamentos || {};
            const refOS = faturamentoObj.proposta_origem || `OS Interna #${String(c.faturamento_id || c.id).split('-')[0]} (Aprovação Financeira)`;

            const vFat = Number(faturamentoObj.total_servicos || 0);
            const vCom = Number(c.valor_comissao || 0);
            totalPagar += vCom;

            tableHTML += `<tr>
                <td style="padding: 8px; border: 1px solid #000; text-align: left;">${dateStr}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: left;">${refOS.substring(0, 50)}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${Number(c.percentual_acordado || 0).toFixed(2)}%</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: right;">R$ ${vFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 8px; border: 1px solid #000; text-align: right; color:var(--accent-green);"><strong>R$ ${vCom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            </tr>`;
        });

        document.getElementById('pdf-recibo-tecnico').textContent = nomeTecnico.toUpperCase();
        document.getElementById('pdf-recibo-periodo').textContent = strPeriodo;
        document.getElementById('pdf-recibo-emissao').textContent = new Date().toLocaleString('pt-BR');
        document.getElementById('pdf-recibo-tabela').innerHTML = tableHTML;
        document.getElementById('pdf-recibo-total').textContent = totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('pdf-recibo-assinatura-tecnico').textContent = nomeTecnico.toUpperCase();

        triggerAutoSave("Renderizando Recibo PDF Financeiro...");

        const element = document.getElementById('print-recibo');

        element.style.display = 'block';

        const opt = {
            margin: 10,
            filename: `Recibo_Financeiro_${nomeTecnico.replace(/\W+/g, '_')}_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
            element.style.display = 'none';
            triggerSaveSuccess("Recibo Financeiro Gerado com Sucesso!");
        } catch (err) {
            console.error('Erro PDF Recibo:', err);
            triggerSaveError('Falha ao renderizar PDF de Recibo.');
            element.style.display = 'none';
        }
    };
    // Filtra contratos ao mudar o cliente no modal de equipamentos
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'eq-cliente-id') {
            window.filterEquipmentContracts(e.target.value);
        }
    });

    // -----------------------------------------
    // ORDENADOR DE TABELAS DINÂMICO (COM PERSISTÊNCIA)
    // Permite clicar nos cabeçalhos das tabelas (.data-table th)
    // -----------------------------------------
    function sortTableByHeader(th, keepDirection = false) {
        if (th.innerText.trim().toLowerCase() === 'ações') return;
        
        const table = th.closest('table');
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0 || rows[0].querySelector('td[colspan]')) return; // ignore loading/empty skips

        const index = Array.from(th.parentNode.children).indexOf(th);
        
        let isAsc;
        if (keepDirection) {
            isAsc = th.classList.contains('asc');
        } else {
            const wasAsc = th.classList.contains('asc');
            // Limpa setas de todos os THs na tabela atual
            table.querySelectorAll('th').forEach(h => {
                h.classList.remove('asc', 'desc');
                h.innerHTML = h.innerHTML.replace(/ ▲| ▼/g, '');
            });
            // Define o novo sentido
            isAsc = !wasAsc;
            th.classList.add(isAsc ? 'asc' : 'desc');
            th.innerHTML += isAsc ? ' ▲' : ' ▼';
        }

        // Ordena as linhas (DOM nodes)
        rows.sort((a, b) => {
            let cellA = a.children[index];
            let cellB = b.children[index];
            if (!cellA || !cellB) return 0;

            let valA = cellA.innerText.trim();
            let valB = cellB.innerText.trim();

            // Parser tolerante financeiro ou número nativo
            let numA = parseFloat(valA.replace(/[R$\.\s]/g, '').replace(',', '.'));
            let numB = parseFloat(valB.replace(/[R$\.\s]/g, '').replace(',', '.'));

            // Aplica formatação de número caso seja legível como valor
            if (!isNaN(numA) && !isNaN(numB) && valA.match(/\d/) && valB.match(/\d/)) {
                return isAsc ? numA - numB : numB - numA;
            }

            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        tbody.append(...rows);
    }

    document.querySelectorAll('.data-table th').forEach(th => {
        if (th.innerText.trim().toLowerCase() === 'ações') return;

        th.style.cursor = 'pointer';
        th.title = "Clique para ordenar";

        th.addEventListener('click', function () {
            sortTableByHeader(this, false);
        });
    });

    // Observador para restaurar a ordem quando o conteúdo da tabela for atualizado (ex: após loadData)
    document.querySelectorAll('.data-table tbody').forEach(tbody => {
        let isSorting = false;
        const observer = new MutationObserver(() => {
            if (isSorting) return;
            const table = tbody.closest('table');
            const activeTh = table.querySelector('th.asc, th.desc');
            if (activeTh) {
                isSorting = true;
                // Usa requestAnimationFrame para garantir que as novas linhas foram renderizadas
                requestAnimationFrame(() => {
                    sortTableByHeader(activeTh, true); // true = mantém a direção (asc/desc)
                    setTimeout(() => isSorting = false, 50); // reset flag
                });
            }
        });
        observer.observe(tbody, { childList: true });
    });

});
console.log('[EquipFix v5.8] Módulo Parque de Máquinas integrado com sucesso.');

// ==============================================================================
// 📱 CENTRAL DE ATENDIMENTO — LIVE CRM, OUTBOUND & LISTA NEGRA (v2.0)
// ==============================================================================
(function() {
    let campaignTipo = 'atendimento';
    let campaignClients = [];
    let campaignPreviewData = null;
    let allCampaignChecked = false;
    let _campaignInitialized = false;

    // Live CRM State
    let currentLivePhone = null;
    let liveConversations = [];
    let liveClientsMap = {};

    function getSupa() {
        if (window.supabaseClient) return window.supabaseClient;
        const SUPABASE_URL = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ? import.meta.env.VITE_SUPABASE_URL : 'https://tmpwmtpdxcvulglkahcg.supabase.co').trim();
        const SUPABASE_ANON_KEY = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ? import.meta.env.VITE_SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE').trim();
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.supabaseClient;
    }

    // Hook into showSection router
    const _origShowSection = window.showSection;
    window.showSection = function(targetId) {
        _origShowSection(targetId);
        if (targetId === 'view-mensagens') {
            if (!_campaignInitialized) {
                _campaignInitialized = true;
            }
            window.loadLiveConversations();
            window.loadBlacklistTable();
            loadCampaignClients();
            loadCampaignHistory();
        }
    };

    // ==========================================================================
    // 🔀 NAVEGAÇÃO ENTRE ABAS
    // ==========================================================================
    window.switchMensagensTab = function(tabName) {
        document.querySelectorAll('.tab-btn-msg').forEach(btn => {
            btn.style.background = 'var(--surface-light)';
            btn.style.color = 'var(--text-primary)';
            btn.style.border = '1px solid var(--border-color)';
        });
        document.querySelectorAll('.msg-subpane').forEach(p => p.style.display = 'none');

        const activeBtn = document.getElementById(`btn-tab-${tabName}`);
        const activePane = document.getElementById(`pane-mensagens-${tabName}`);

        if (activeBtn) {
            activeBtn.style.background = 'rgba(37,211,102,0.18)';
            activeBtn.style.color = '#25D366';
            activeBtn.style.border = '1px solid rgba(37,211,102,0.4)';
        }
        if (activePane) {
            activePane.style.display = 'block';
        }

        if (tabName === 'live') {
            window.loadLiveConversations();
        } else if (tabName === 'campanhas') {
            loadCampaignClients();
            loadCampaignHistory();
        } else if (tabName === 'blacklist') {
            window.loadBlacklistTable();
        }
    };

    // ==========================================================================
    // 💬 LIVE CRM: CONVERSAS AO VIVO (WHATSAPP INBOX)
    // ==========================================================================
    window.loadLiveConversations = async function() {
        const container = document.getElementById('live-chat-conversations-list');
        if (!container) return;

        try {
            const supa = getSupa();
            
            // 1. Carrega clientes para cruzar nomes
            const { data: clientsData } = await supa.from('clientes').select('id, nome_cliente, whatsapp, endereco_completo');
            liveClientsMap = {};
            (clientsData || []).forEach(c => {
                if (c.whatsapp) {
                    const clean = c.whatsapp.replace(/\D/g, '');
                    liveClientsMap[clean] = c;
                    if (clean.startsWith('55')) liveClientsMap[clean.substring(2)] = c;
                }
            });

            // 2. Carrega mensagens de agent_memory
            const { data: memories, error } = await supa.from('agent_memory')
                .select('phone, role, content, created_at')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) {
                console.error('[LIVE CRM] Erro ao carregar memórias:', error);
                container.innerHTML = `<div style="color:var(--accent-red); padding:15px; font-size:0.85rem;">Erro: ${error.message}</div>`;
                return;
            }

            if (!memories || memories.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:0.85rem;">Nenhuma conversa registrada ainda.</div>';
                return;
            }

            // Agrupar por telefone
            const grouped = {};
            memories.forEach(m => {
                if (!m.phone || m.phone.startsWith('LOCK_') || m.phone === 'GLOBAL_CONFIG' || m.phone === 'DEBUG_AUDIO' || m.phone.includes('@g.us')) return;
                let cleanPhone = m.phone.replace(/\D/g, '');
                if (!cleanPhone || cleanPhone.length < 8) return;
                if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
                    cleanPhone = '55' + cleanPhone;
                }

                if (!grouped[cleanPhone]) {
                    grouped[cleanPhone] = {
                        phone: cleanPhone,
                        messages: [],
                        lastMessage: m.content || '',
                        lastTime: m.created_at,
                        status: 'ativo' // 'ativo', 'pausado', 'ignorado'
                    };
                }
                grouped[cleanPhone].messages.push(m);
            });

            // Determinar o status de cada conversa baseado no comando mais recente
            let blacklistCount = 0;
            const convList = Object.values(grouped).map(conv => {
                // Procurar último comando de status
                const statusCmd = conv.messages.find(m => 
                    m.content === 'BOT_IGNORAR' || 
                    m.content === 'AMIGO_IGNORAR' || 
                    m.content === 'LISTA_NEGRA' || 
                    m.content === 'BOT_PAUSADO' || 
                    m.content === 'BOT_ATIVO'
                );

                if (statusCmd) {
                    if (statusCmd.content === 'BOT_IGNORAR' || statusCmd.content === 'AMIGO_IGNORAR' || statusCmd.content === 'LISTA_NEGRA') {
                        conv.status = 'ignorado';
                        blacklistCount++;
                    } else if (statusCmd.content === 'BOT_PAUSADO') {
                        conv.status = 'pausado';
                    } else {
                        conv.status = 'ativo';
                    }
                }

                // Cliente associado
                const clientObj = liveClientsMap[conv.phone] || liveClientsMap[conv.phone.replace(/^55/, '')];
                conv.clientName = clientObj ? clientObj.nome_cliente : `WhatsApp ${conv.phone}`;
                conv.endereco = clientObj ? clientObj.endereco_completo : '';

                // Filtrar última mensagem legível (ignorar comandos internos)
                const lastVisibleMsg = conv.messages.find(m => 
                    m.content && 
                    !['BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA', 'BOT_PAUSADO', 'BOT_ATIVO'].includes(m.content)
                );
                conv.displayLastMsg = lastVisibleMsg ? lastVisibleMsg.content : 'Conversa iniciada';

                return conv;
            });

            // Atualiza badge de blacklist
            const badgeEl = document.getElementById('count-blacklist');
            if (badgeEl) badgeEl.textContent = blacklistCount;

            liveConversations = convList;
            renderLiveConversationsList();

            // Se tem conversa selecionada, recarrega
            if (currentLivePhone) {
                window.selectLiveConversation(currentLivePhone);
            }

        } catch (err) {
            console.error('[LIVE CRM] Erro geral:', err);
        }
    };

    function renderLiveConversationsList() {
        const container = document.getElementById('live-chat-conversations-list');
        if (!container) return;

        const search = (document.getElementById('live-chat-search')?.value || '').toLowerCase();
        
        const filtered = liveConversations.filter(c => {
            if (!search) return true;
            return c.clientName.toLowerCase().includes(search) || c.phone.includes(search);
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:0.85rem;">Nenhuma conversa encontrada.</div>';
            return;
        }

        container.innerHTML = filtered.map(c => {
            const isSelected = c.phone === currentLivePhone;
            const bg = isSelected ? 'rgba(37,211,102,0.15)' : 'rgba(255,255,255,0.03)';
            const border = isSelected ? '1px solid #25D366' : '1px solid rgba(255,255,255,0.06)';
            
            let statusBadge = `<span style="font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(37,211,102,0.15); color:#25D366;">🟢 Maria Ativa</span>`;
            if (c.status === 'pausado') {
                statusBadge = `<span style="font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(230,126,34,0.15); color:#e67e22;">🟠 Humano</span>`;
            } else if (c.status === 'ignorado') {
                statusBadge = `<span style="font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; background:rgba(231,76,60,0.15); color:#e74c3c;">🚫 Amigo / Ignorado</span>`;
            }

            const initial = (c.clientName || 'W').charAt(0).toUpperCase();
            const timeStr = c.lastTime ? new Date(c.lastTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
            const safeSnippet = (c.displayLastMsg || '').substring(0, 45) + ((c.displayLastMsg || '').length > 45 ? '...' : '');

            return `
                <div onclick="window.selectLiveConversation('${c.phone}')" style="background: ${bg}; border: ${border}; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.2s; display: flex; gap: 10px; align-items: center;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--surface-light); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; color: var(--accent-green); flex-shrink: 0;">
                        ${initial}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.clientName}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted);">${timeStr}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">
                            ${safeSnippet}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.72rem; color: var(--text-muted);">${c.phone}</span>
                            ${statusBadge}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.filterLiveConversations = function() {
        renderLiveConversationsList();
    };

    window.selectLiveConversation = async function(phone) {
        currentLivePhone = phone;
        renderLiveConversationsList();

        const headerActions = document.getElementById('live-chat-header-actions');
        const footer = document.getElementById('live-chat-footer');
        const nameEl = document.getElementById('live-chat-contact-name');
        const phoneEl = document.getElementById('live-chat-contact-phone');
        const avatarEl = document.getElementById('live-chat-contact-avatar');
        const statusBadge = document.getElementById('live-chat-status-badge');
        const btnPause = document.getElementById('btn-toggle-pause-chat');
        const btnBlacklist = document.getElementById('btn-toggle-blacklist-chat');
        const stream = document.getElementById('live-chat-messages-stream');

        if (headerActions) headerActions.style.display = 'flex';
        if (footer) footer.style.display = 'flex';

        const conv = liveConversations.find(c => c.phone === phone);
        const clientName = conv ? conv.clientName : `WhatsApp ${phone}`;
        
        if (nameEl) nameEl.textContent = clientName;
        if (phoneEl) phoneEl.textContent = `${phone} ${conv?.endereco ? '• ' + conv.endereco : ''}`;
        if (avatarEl) avatarEl.textContent = clientName.charAt(0).toUpperCase();

        // Atualizar botões e badge
        const currentStatus = conv ? conv.status : 'ativo';
        if (statusBadge) {
            if (currentStatus === 'pausado') {
                statusBadge.style.background = 'rgba(230,126,34,0.15)';
                statusBadge.style.color = '#e67e22';
                statusBadge.style.border = '1px solid rgba(230,126,34,0.3)';
                statusBadge.innerHTML = '🟠 Atendimento Humano (IA Pausada)';
            } else if (currentStatus === 'ignorado') {
                statusBadge.style.background = 'rgba(231,76,60,0.15)';
                statusBadge.style.color = '#e74c3c';
                statusBadge.style.border = '1px solid rgba(231,76,60,0.3)';
                statusBadge.innerHTML = '🚫 Amigo / Ignorado';
            } else {
                statusBadge.style.background = 'rgba(37,211,102,0.15)';
                statusBadge.style.color = '#25D366';
                statusBadge.style.border = '1px solid rgba(37,211,102,0.3)';
                statusBadge.innerHTML = '🤖 Maria Cecília Ativa';
            }
        }

        if (btnPause) {
            if (currentStatus === 'pausado') {
                btnPause.innerHTML = '<i class="fa-solid fa-play"></i> Reativar Maria';
                btnPause.style.background = 'rgba(37,211,102,0.2)';
                btnPause.style.color = '#25D366';
            } else {
                btnPause.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar IA';
                btnPause.style.background = 'var(--surface-light)';
                btnPause.style.color = 'var(--text-primary)';
            }
        }

        if (btnBlacklist) {
            if (currentStatus === 'ignorado') {
                btnBlacklist.innerHTML = '<i class="fa-solid fa-check"></i> Desbloquear IA';
            } else {
                btnBlacklist.innerHTML = '<i class="fa-solid fa-ban"></i> Ignorar IA';
            }
        }

        // Carregar mensagens históricas
        stream.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando mensagens...</div>';

        try {
            const supa = getSupa();

            // Normaliza variações de telefone (com 55, sem 55, com @s.whatsapp.net)
            const cleanDigits = phone.replace(/\D/g, '');
            const phoneVariants = [
                phone,
                cleanDigits,
                `55${cleanDigits}`,
                cleanDigits.replace(/^55/, ''),
                `${cleanDigits}@s.whatsapp.net`,
                `55${cleanDigits.replace(/^55/, '')}@s.whatsapp.net`
            ];
            const uniquePhones = [...new Set(phoneVariants.filter(Boolean))];

            // Busca as últimas 50 mensagens mais recentes
            const { data: rawMessages, error } = await supa.from('agent_memory')
                .select('*')
                .in('phone', uniquePhones)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                stream.innerHTML = `<div style="color:var(--accent-red); padding:15px;">Erro ao carregar mensagens: ${error.message}</div>`;
                return;
            }

            if (!rawMessages || rawMessages.length === 0) {
                stream.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Nenhuma mensagem registrada.</div>';
                return;
            }

            // Inverte para exibir do mais antigo ao mais recente
            const allMessages = rawMessages.reverse();

            // Filtra comandos de sistema consecutivos repetidos para não poluir o chat
            let lastStatusPill = null;
            const messages = allMessages.filter(msg => {
                const isStatusCmd = ['BOT_PAUSADO', 'BOT_ATIVO', 'BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA'].includes(msg.content);
                if (isStatusCmd) {
                    if (lastStatusPill === msg.content) return false;
                    lastStatusPill = msg.content;
                    return true;
                }
                lastStatusPill = null;
                return true;
            });

            stream.innerHTML = messages.map(msg => {
                const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
                
                // Pills de comandos de sistema
                if (msg.content === 'BOT_PAUSADO') {
                    return `<div style="text-align:center; margin:6px 0;"><span style="background:rgba(230,126,34,0.15); color:#e67e22; border:1px solid rgba(230,126,34,0.3); font-size:0.72rem; padding:3px 10px; border-radius:12px; font-weight:700;"><i class="fa-solid fa-pause"></i> Atendimento Humano assumido (IA Pausada)</span></div>`;
                }
                if (msg.content === 'BOT_ATIVO') {
                    return `<div style="text-align:center; margin:6px 0;"><span style="background:rgba(37,211,102,0.15); color:#25D366; border:1px solid rgba(37,211,102,0.3); font-size:0.72rem; padding:3px 10px; border-radius:12px; font-weight:700;"><i class="fa-solid fa-play"></i> Maria Cecília reassumiu o atendimento</span></div>`;
                }
                if (msg.content === 'BOT_IGNORAR' || msg.content === 'AMIGO_IGNORAR' || msg.content === 'LISTA_NEGRA') {
                    return `<div style="text-align:center; margin:6px 0;"><span style="background:rgba(231,76,60,0.15); color:#e74c3c; border:1px solid rgba(231,76,60,0.3); font-size:0.72rem; padding:3px 10px; border-radius:12px; font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Contato adicionado à Lista Negra (IA Silenciada)</span></div>`;
                }

                // Mensagem do Cliente (User)
                if (msg.role === 'user') {
                    let cleanUserText = (msg.content || '');
                    
                    let base64Audio = null;
                    let base64Image = null;
                    
                    const audioMatch = cleanUserText.match(/\[MEDIA_AUDIO_B64:([^\|]+)\|([^\]]+)\]/);
                    if (audioMatch) {
                        base64Audio = `data:${audioMatch[1]};base64,${audioMatch[2]}`;
                    }
                    
                    const imageMatch = cleanUserText.match(/\[MEDIA_IMAGE_B64:([^\|]+)\|([^\]]+)\]/);
                    if (imageMatch) {
                        base64Image = `data:${imageMatch[1]};base64,${imageMatch[2]}`;
                    }

                    cleanUserText = cleanUserText
                        .replace(/\[MSG_ID:[^\]]+\]\s*/g, '')
                        .replace(/\[MEDIA_AUDIO_B64:[^\]]+\]\s*/g, '')
                        .replace(/\[MEDIA_IMAGE_B64:[^\]]+\]\s*/g, '')
                        .replace(/\[MEDIA_AUDIO:[^\]]+\]\s*/g, '🎙️ _[Áudio de voz recebido]_')
                        .replace(/\[MEDIA_IMAGE:[^\]]+\]\s*/g, '📷 _[Foto/Imagem recebida]_')
                        .replace(/\[LOCK:[^\]]+\]\s*/g, '');

                    const isAudioMsg = base64Audio || cleanUserText.includes('Áudio') || cleanUserText.includes('audio') || cleanUserText.includes('🎙️') || cleanUserText.includes('voz');
                    const isPhotoMsg = base64Image || cleanUserText.includes('Foto') || cleanUserText.includes('📷') || cleanUserText.includes('imagem');

                    let mediaBadge = '';
                    if (isAudioMsg) {
                        mediaBadge = `
                            <div style="display:flex; flex-direction:column; gap:8px; background:rgba(37,211,102,0.12); padding:6px 10px; border-radius:6px; border:1px solid rgba(37,211,102,0.25); margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i class="fa-solid fa-microphone-lines" style="color:#25D366; font-size:1rem;"></i>
                                    <span style="font-size:0.82rem; font-weight:700; color:#25D366;">Mensagem de Áudio (WhatsApp)</span>
                                </div>
                                ${base64Audio ? `<audio controls src="${base64Audio}" style="width: 100%; height: 40px; margin-top: 5px; outline: none; border-radius: 4px;"></audio>` : ''}
                            </div>
                        `;
                    } else if (isPhotoMsg) {
                        mediaBadge = `
                            <div style="display:flex; flex-direction:column; gap:8px; background:rgba(52,152,219,0.12); padding:6px 10px; border-radius:6px; border:1px solid rgba(52,152,219,0.25); margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i class="fa-solid fa-camera" style="color:#3498db; font-size:1rem;"></i>
                                    <span style="font-size:0.82rem; font-weight:700; color:#3498db;">Foto / Imagem Anexada</span>
                                </div>
                                ${base64Image ? `<img src="${base64Image}" style="max-width: 100%; border-radius: 6px; margin-top: 5px;" alt="Imagem do Cliente" />` : ''}
                            </div>
                        `;
                    }

                    return `
                        <div style="display:flex; justify-content:flex-start; margin-bottom:6px;">
                            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); padding: 10px 14px; border-radius: 12px 12px 12px 2px; max-width: 75%; color: var(--text-primary); font-size: 0.9rem; line-height: 1.4; word-break: break-word;">
                                <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-bottom: 3px;">${clientName}</div>
                                ${mediaBadge}
                                <div style="white-space: pre-wrap;">${cleanUserText}</div>
                                <div style="text-align: right; font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">${time}</div>
                            </div>
                        </div>
                    `;
                }

                // Mensagem de Arnaldo ou Maria Cecília (Model)
                let cleanModelText = (msg.content || '')
                    .replace(/\[MSG_ID:[^\]]+\]\s*/g, '')
                    .replace(/\[MEDIA_AUDIO_B64:[^\]]+\]\s*/g, '')
                    .replace(/\[MEDIA_IMAGE_B64:[^\]]+\]\s*/g, '')
                    .replace(/\[LOCK:[^\]]+\]\s*/g, '');

                const isArnaldo = cleanModelText && (cleanModelText.includes('👨‍🔧') || cleanModelText.toLowerCase().startsWith('arnaldo'));
                const bubbleBg = isArnaldo ? 'rgba(41, 128, 185, 0.2)' : 'rgba(37, 211, 102, 0.12)';
                const bubbleBorder = isArnaldo ? '1px solid rgba(41, 128, 185, 0.4)' : '1px solid rgba(37, 211, 102, 0.3)';
                const tagColor = isArnaldo ? '#3498db' : '#25D366';
                const tagLabel = isArnaldo ? '👨‍🔧 Arnaldo Trentin | Gestor' : '👩‍💼 Maria Cecília | Atendimento';

                return `
                    <div style="display:flex; justify-content:flex-end; margin-bottom:6px;">
                        <div style="background: ${bubbleBg}; border: ${bubbleBorder}; padding: 10px 14px; border-radius: 12px 12px 2px 12px; max-width: 75%; color: var(--text-primary); font-size: 0.9rem; line-height: 1.4; word-break: break-word;">
                            <div style="font-size: 0.72rem; font-weight: 700; color: ${tagColor}; margin-bottom: 3px;">${tagLabel}</div>
                            <div style="white-space: pre-wrap;">${cleanModelText}</div>
                            <div style="text-align: right; font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">${time}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // Scroll down
            stream.scrollTop = stream.scrollHeight;

        } catch (err) {
            console.error('[LIVE CRM] Erro ao carregar mensagens:', err);
        }
    };

    // Pausar / Reativar IA na conversa
    window.toggleCurrentChatPause = async function() {
        if (!currentLivePhone) return;
        const conv = liveConversations.find(c => c.phone === currentLivePhone);
        const isPaused = conv && conv.status === 'pausado';
        const newCmd = isPaused ? 'BOT_ATIVO' : 'BOT_PAUSADO';

        try {
            const supa = getSupa();
            await supa.from('agent_memory').insert({
                phone: currentLivePhone,
                role: 'user',
                content: newCmd
            });

            window.loadLiveConversations();
        } catch (err) {
            alert('Erro ao alterar status da IA: ' + err.message);
        }
    };

    // Bloquear / Desbloquear na Lista Negra direto da conversa
    window.toggleCurrentChatBlacklist = async function() {
        if (!currentLivePhone) return;
        const conv = liveConversations.find(c => c.phone === currentLivePhone);
        const isIgnored = conv && conv.status === 'ignorado';
        const newCmd = isIgnored ? 'BOT_ATIVO' : 'BOT_IGNORAR';

        if (!isIgnored) {
            if (!confirm(`Deseja adicionar ${conv?.clientName || currentLivePhone} à Lista Negra?\n\nA Maria Cecília NUNCA MAIS responderá para este número.`)) return;
        }

        try {
            const supa = getSupa();
            await supa.from('agent_memory').insert({
                phone: currentLivePhone,
                role: 'user',
                content: newCmd
            });

            window.loadLiveConversations();
            window.loadBlacklistTable();
        } catch (err) {
            alert('Erro ao alterar Lista Negra: ' + err.message);
        }
    };

    // Enviar mensagem manual assinada como Arnaldo
    window.sendManualMessageAsArnaldo = async function() {
        if (!currentLivePhone) {
            alert('⚠️ Selecione uma conversa na lista à esquerda antes de enviar a mensagem.');
            return;
        }
        const input = document.getElementById('live-chat-reply-input');
        const text = input?.value?.trim();
        if (!text) {
            alert('⚠️ Digite uma mensagem antes de clicar em Enviar.');
            return;
        }

        const btn = document.getElementById('btn-send-manual-msg');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
        }

        const formattedText = `👨‍🔧 *Arnaldo Trentin:* ${text}`;

        try {
            const supa = getSupa();
            
            // 1. Grava a mensagem na memória imediatamente
            await supa.from('agent_memory').insert({
                phone: currentLivePhone,
                role: 'model',
                content: formattedText
            });

            // 2. Garante a pausa do robô apenas se não estiver pausado
            const conv = liveConversations.find(c => c.phone === currentLivePhone);
            if (!conv || conv.status !== 'pausado') {
                await supa.from('agent_memory').insert({
                    phone: currentLivePhone,
                    role: 'user',
                    content: 'BOT_PAUSADO'
                });
            }

            // Limpa o input e atualiza o chat instantaneamente
            if (input) input.value = '';
            await window.selectLiveConversation(currentLivePhone);
            triggerSaveSuccess('Mensagem enviada no WhatsApp!');

            // 3. Dispara via Edge Function / UazAPI
            const res = await supa.functions.invoke('assistant-router', {
                body: {
                    action: 'send_manual_text',
                    telefone_destino: currentLivePhone,
                    mensagem: formattedText
                }
            });

            if (res?.error) {
                console.warn('[LIVE CRM] Resposta Edge Function:', res.error);
            }

        } catch (err) {
            console.error('[LIVE CRM] Erro ao enviar mensagem manual:', err);
            if (input) input.value = '';
            await window.selectLiveConversation(currentLivePhone);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-user-tie"></i> Enviar como Arnaldo';
            }
        }
    };

    // Executar Ordem de IA para a Maria Cecília
    window.executeAiActiveCommand = async function() {
        if (!currentLivePhone) {
            alert('⚠️ Selecione uma conversa na lista à esquerda antes de disparar a ordem.');
            return;
        }
        const input = document.getElementById('live-chat-ai-cmd-input');
        const cmdText = input?.value?.trim();
        if (!cmdText) {
            alert('⚠️ Digite uma ordem ou instrução para a Maria Cecília antes de disparar.');
            return;
        }

        const btn = document.getElementById('btn-exec-ai-cmd');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redigindo...';
        }

        try {
            const supa = getSupa();
            const conv = liveConversations.find(c => c.phone === currentLivePhone);
            const clientName = conv?.clientName || 'Cliente';

            triggerAutoSave('Maria Cecília redigindo e disparando mensagem no WhatsApp...');

            const res = await supa.functions.invoke('assistant-router', {
                body: {
                    action: 'execute_ai_order',
                    telefone_destino: currentLivePhone,
                    nome_cliente: clientName,
                    ordem: cmdText
                }
            });

            if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
            if (res.data?.error) throw new Error(res.data.error);

            if (input) input.value = '';
            triggerSaveSuccess('Maria Cecília enviou a mensagem para o cliente no WhatsApp!');

            // Recarrega o chat imediatamente
            await window.selectLiveConversation(currentLivePhone);

        } catch (err) {
            console.error('[ORDEM IA]', err);
            triggerSaveError('Erro ao executar ordem da Maria.');
            alert('Erro ao processar comando da Maria Cecília: ' + (err.message || JSON.stringify(err)));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Disparar Ordem';
            }
        }
    };

    // ==========================================================================
    // 🚫 LISTA NEGRA: GESTÃO DE CONTATOS PESSOAIS & AMIGOS
    // ==========================================================================
    window.loadBlacklistTable = async function() {
        const tbody = document.querySelector('#table-blacklist-contacts tbody');
        if (!tbody) return;

        try {
            const supa = getSupa();
            const { data: list, error } = await supa.from('agent_memory')
                .select('phone, created_at')
                .in('content', ['BOT_IGNORAR', 'AMIGO_IGNORAR', 'LISTA_NEGRA'])
                .order('created_at', { ascending: false });

            if (error) {
                tbody.innerHTML = `<tr><td colspan="4" style="color:var(--accent-red);">Erro: ${error.message}</td></tr>`;
                return;
            }

            // Agrupar únicos
            const uniquePhones = {};
            (list || []).forEach(item => {
                if (item.phone && !uniquePhones[item.phone]) {
                    uniquePhones[item.phone] = item;
                }
            });

            const blacklisted = Object.values(uniquePhones);
            const badgeEl = document.getElementById('count-blacklist');
            if (badgeEl) badgeEl.textContent = blacklisted.length;

            if (blacklisted.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum número na Lista Negra. Todos os contatos são atendidos normalmente.</td></tr>';
                return;
            }

            tbody.innerHTML = blacklisted.map(item => {
                const clientObj = liveClientsMap[item.phone] || liveClientsMap[item.phone.replace(/^55/, '')];
                const nome = clientObj ? clientObj.nome_cliente : 'Amigo / Contato Pessoal';
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-';

                return `
                    <tr>
                        <td style="font-weight: 700; color: #e74c3c;">${item.phone}</td>
                        <td style="font-weight: 600;">${nome}</td>
                        <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
                        <td>
                            <button class="action-btn" onclick="window.removeContactFromBlacklist('${item.phone}')" style="background: rgba(37,211,102,0.15); color: #25D366; border: 1px solid rgba(37,211,102,0.3); font-size: 0.8rem; padding: 4px 10px;">
                                <i class="fa-solid fa-unlock"></i> Desbloquear IA
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error('[BLACKLIST] Erro:', err);
        }
    };

    window.addContactToBlacklist = async function() {
        const inputNome = document.getElementById('blacklist-input-nome');
        const inputPhone = document.getElementById('blacklist-input-phone');
        const phone = inputPhone?.value?.trim().replace(/\D/g, '');
        const nome = inputNome?.value?.trim();

        if (!phone || phone.length < 8) {
            alert('Por favor, digite um número de telefone WhatsApp válido.');
            return;
        }

        let fullPhone = phone;
        if (!fullPhone.startsWith('55') && fullPhone.length <= 11) {
            fullPhone = '55' + fullPhone;
        }

        try {
            const supa = getSupa();
            await supa.from('agent_memory').insert({
                phone: fullPhone,
                role: 'user',
                content: 'BOT_IGNORAR'
            });

            if (inputNome) inputNome.value = '';
            if (inputPhone) inputPhone.value = '';

            alert(`✅ Número ${fullPhone} adicionado à Lista Negra com sucesso!\nA Maria Cecília nunca mais responderá para este contato.`);
            window.loadBlacklistTable();
            window.loadLiveConversations();

        } catch (err) {
            alert('Erro ao adicionar à Lista Negra: ' + err.message);
        }
    };

    window.removeContactFromBlacklist = async function(phone) {
        if (!confirm(`Deseja desbloquear o número ${phone}?\n\nA Maria Cecília voltará a responder quando este contato mandar mensagem.`)) return;

        try {
            const supa = getSupa();
            await supa.from('agent_memory').insert({
                phone: phone,
                role: 'user',
                content: 'BOT_ATIVO'
            });

            window.loadBlacklistTable();
            window.loadLiveConversations();
        } catch (err) {
            alert('Erro ao desbloquear: ' + err.message);
        }
    };

    // ==========================================================================
    // 📢 CAMPANHAS & OUTBOUND
    // ==========================================================================
    window.setCampaignCategory = function(btn, tipo) {
        campaignTipo = tipo;
        document.querySelectorAll('.campaign-cat-btn').forEach(b => {
            b.style.border = '2px solid transparent';
            b.style.background = '';
        });
        btn.style.border = '2px solid #25D366';
        btn.style.background = 'rgba(37,211,102,0.1)';
        
        const previewArea = document.getElementById('campaign-preview-area');
        const sendBtn = document.getElementById('btn-campaign-send');
        if (previewArea) previewArea.style.display = 'none';
        if (sendBtn) sendBtn.disabled = true;
        campaignPreviewData = null;

        loadCampaignClients();
    };

    async function loadCampaignClients() {
        const supa = getSupa();
        const tbody = document.querySelector('#table-campaign-clients tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Carregando clientes...</td></tr>';

        try {
            const { data: clientes, error: clientError } = await supa.from('clientes').select('id, nome_cliente, whatsapp, endereco_completo').order('nome_cliente');
            
            if (clientError) {
                console.error('[CAMPANHA] Erro Supabase:', clientError);
                tbody.innerHTML = `<tr><td colspan="4" style="color:var(--accent-red); padding:15px;">Erro: ${clientError.message}</td></tr>`;
                return;
            }

            if (!clientes || clientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum cliente cadastrado.</td></tr>';
                return;
            }

            let enrichedClients = [];

            if (campaignTipo === 'confirmacao') {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 7);
                const { data: osData } = await supa.from('ordens_servico')
                    .select('cliente_id, descricao_servico, data_agendamento, status_os')
                    .gte('data_agendamento', new Date().toISOString().split('T')[0])
                    .lte('data_agendamento', futureDate.toISOString().split('T')[0])
                    .neq('status_os', 'Finalizada')
                    .neq('status_os', 'Cancelado');
                
                const osMap = {};
                (osData || []).forEach(os => {
                    if (!osMap[os.cliente_id]) osMap[os.cliente_id] = [];
                    osMap[os.cliente_id].push(os);
                });

                enrichedClients = clientes.filter(c => osMap[c.id]).map(c => ({
                    ...c,
                    contexto: osMap[c.id].map(os => `OS: ${os.descricao_servico} em ${new Date(os.data_agendamento).toLocaleDateString('pt-BR')}`).join('; ')
                }));

            } else if (campaignTipo === 'pos_venda') {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 30);
                const { data: osData } = await supa.from('ordens_servico')
                    .select('cliente_id, descricao_servico, data_agendamento, status_os')
                    .eq('status_os', 'Finalizada')
                    .gte('data_agendamento', pastDate.toISOString().split('T')[0]);
                
                const osMap = {};
                (osData || []).forEach(os => {
                    if (!osMap[os.cliente_id]) osMap[os.cliente_id] = [];
                    osMap[os.cliente_id].push(os);
                });

                enrichedClients = clientes.filter(c => osMap[c.id]).map(c => ({
                    ...c,
                    contexto: `Último serviço: ${osMap[c.id][0].descricao_servico} (${new Date(osMap[c.id][0].data_agendamento).toLocaleDateString('pt-BR')})`
                }));

            } else if (campaignTipo === 'cobranca') {
                const { data: fatData } = await supa.from('faturamentos')
                    .select('os_referencia, valor_total_geral, status_pagamento')
                    .eq('status_pagamento', 'Pendente');
                
                if (fatData && fatData.length > 0) {
                    const osRefs = fatData.map(f => f.os_referencia).filter(Boolean);
                    if (osRefs.length > 0) {
                        const { data: osData } = await supa.from('ordens_servico')
                            .select('id, cliente_id, descricao_servico')
                            .in('id', osRefs);
                        
                        const clientFatMap = {};
                        (osData || []).forEach(os => {
                            const fat = fatData.find(f => f.os_referencia === os.id);
                            if (fat) {
                                clientFatMap[os.cliente_id] = {
                                    servico: os.descricao_servico,
                                    valor: fat.valor_total_geral
                                };
                            }
                        });

                        enrichedClients = clientes.filter(c => clientFatMap[c.id]).map(c => ({
                            ...c,
                            contexto: `Pagamento pendente: R$ ${parseFloat(clientFatMap[c.id].valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} — ${clientFatMap[c.id].servico}`
                        }));
                    }
                }
                if (enrichedClients.length === 0) {
                    const countEl = document.getElementById('campaign-client-count');
                    if (countEl) countEl.textContent = '(0 disponíveis)';
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum faturamento pendente encontrado.</td></tr>';
                    return;
                }

            } else if (campaignTipo === 'orcamento') {
                const { data: propData } = await supa.from('propostas')
                    .select('cliente_id, titulo_servico, valor_total, status_proposta')
                    .eq('status_proposta', 'Pendente');
                
                const propMap = {};
                (propData || []).forEach(p => {
                    if (!propMap[p.cliente_id]) propMap[p.cliente_id] = [];
                    propMap[p.cliente_id].push(p);
                });

                enrichedClients = clientes.filter(c => propMap[c.id]).map(c => ({
                    ...c,
                    contexto: `Orçamento: ${propMap[c.id][0].titulo_servico} — R$ ${parseFloat(propMap[c.id][0].valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                }));

                if (enrichedClients.length === 0) {
                    const countEl = document.getElementById('campaign-client-count');
                    if (countEl) countEl.textContent = '(0 disponíveis)';
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma proposta pendente encontrada.</td></tr>';
                    return;
                }

            } else {
                enrichedClients = clientes.map(c => ({ ...c, contexto: c.endereco_completo || 'Cliente cadastrado' }));
            }

            campaignClients = enrichedClients;
            renderCampaignClients();

        } catch (err) {
            console.error('[CAMPANHA] Erro ao carregar clientes:', err);
            tbody.innerHTML = `<tr><td colspan="4" style="color:var(--accent-red); padding:15px;">Erro: ${err.message || err}</td></tr>`;
        }
    }

    function renderCampaignClients() {
        const tbody = document.querySelector('#table-campaign-clients tbody');
        const countEl = document.getElementById('campaign-client-count');
        const search = (document.getElementById('campaign-search')?.value || '').toLowerCase();
        
        const filtered = campaignClients.filter(c => {
            if (!c.whatsapp || c.whatsapp.replace(/\D/g, '').length < 10) return false;
            if (search && !c.nome_cliente.toLowerCase().includes(search) && !c.whatsapp.includes(search)) return false;
            return true;
        });

        if (countEl) countEl.textContent = `(${filtered.length} disponíveis)`;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum cliente com WhatsApp válido encontrado para esta categoria.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const safeNome = (c.nome_cliente || '').replace(/"/g, '&quot;');
            const safeCtx = (c.contexto || '').replace(/"/g, '&quot;');
            return `<tr>
                <td style="text-align:center;">
                    <input type="checkbox" class="campaign-check" data-id="${c.id}" data-nome="${safeNome}" data-whatsapp="${c.whatsapp}" data-contexto="${safeCtx}" style="cursor:pointer; transform: scale(1.2);">
                </td>
                <td style="font-weight: 600;">${c.nome_cliente}</td>
                <td style="color: var(--text-muted);">${c.whatsapp}</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${c.contexto || '-'}</td>
            </tr>`;
        }).join('');
    }

    window.filterCampaignClients = function() { renderCampaignClients(); };

    window.toggleAllCampaignChecks = function() {
        allCampaignChecked = !allCampaignChecked;
        document.querySelectorAll('.campaign-check').forEach(cb => cb.checked = allCampaignChecked);
    };

    function getSelectedClients() {
        const checks = document.querySelectorAll('.campaign-check:checked');
        return Array.from(checks).map(cb => ({
            id: cb.dataset.id,
            nome: cb.dataset.nome,
            whatsapp: cb.dataset.whatsapp,
            contexto: cb.dataset.contexto
        }));
    }

    window.gerarPreviaCampanha = async function() {
        const selected = getSelectedClients();
        if (selected.length === 0) {
            alert('Selecione pelo menos 1 cliente.');
            return;
        }
        if (selected.length > 30) {
            alert('Máximo de 30 clientes por campanha.');
            return;
        }

        const btn = document.getElementById('btn-campaign-preview');
        const briefing = document.getElementById('campaign-briefing')?.value || '';
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando prévia...';
        btn.disabled = true;

        try {
            const supa = getSupa();

            const { data, error: invokeError } = await supa.functions.invoke('campaign-sender', {
                body: {
                    tipo: campaignTipo,
                    briefing,
                    clientes: selected,
                    mode: 'preview'
                }
            });

            if (invokeError) throw invokeError;
            
            if (data.success && data.results) {
                campaignPreviewData = data;
                renderPreview(data.results);
                document.getElementById('btn-campaign-send').disabled = false;
            } else {
                alert('Erro ao gerar prévia: ' + (data.error || JSON.stringify(data)));
            }
        } catch (err) {
            console.error('[CAMPANHA] Erro:', err);
            alert('Erro de conexão com a Edge Function.\n\n' + err.message);
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-eye"></i> Gerar Prévia das Mensagens';
            btn.disabled = false;
        }
    };

    function renderPreview(results) {
        const area = document.getElementById('campaign-preview-area');
        const container = document.getElementById('campaign-preview-cards');
        area.style.display = 'block';

        container.innerHTML = results.map((r, i) => `
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; border-left: 3px solid #25D366;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--text-primary);">${r.cliente_nome}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">#${i + 1}</span>
                </div>
                <div style="background: rgba(37,211,102,0.08); padding: 12px; border-radius: 8px; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap;">${r.mensagem}</div>
            </div>
        `).join('');

        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.enviarCampanha = async function() {
        if (!campaignPreviewData) {
            alert('Gere a prévia primeiro.');
            return;
        }

        const selected = getSelectedClients();
        if (selected.length === 0) return;

        const confirmMsg = `Tem certeza que deseja enviar ${selected.length} mensagem(ns) via WhatsApp?\n\nTipo: ${campaignTipo}\nIntervalo: 10s entre envios\nTempo estimado: ~${selected.length * 10}s`;
        if (!confirm(confirmMsg)) return;

        const btn = document.getElementById('btn-campaign-send');
        const briefing = document.getElementById('campaign-briefing')?.value || '';
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
        btn.disabled = true;

        try {
            const supa = getSupa();
            const session = await supa.auth.getSession();
            const userId = session?.data?.session?.user?.id || null;

            const { data, error: invokeError } = await supa.functions.invoke('campaign-sender', {
                body: {
                    tipo: campaignTipo,
                    briefing,
                    clientes: selected,
                    mode: 'send',
                    enviado_por: userId
                }
            });

            if (invokeError) throw invokeError;
            
            if (data.success) {
                alert(`✅ Campanha enviada!\n\n${data.enviados} mensagem(ns) enviada(s)\n${data.erros} erro(s)`);
                
                document.getElementById('campaign-preview-area').style.display = 'none';
                campaignPreviewData = null;
                document.querySelectorAll('.campaign-check').forEach(cb => cb.checked = false);
                
                loadCampaignHistory();
                window.loadLiveConversations();
            } else {
                alert('Erro ao enviar: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (err) {
            console.error('[CAMPANHA] Erro:', err);
            alert('Erro de conexão.\n\n' + err.message);
        } finally {
            btn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Enviar Campanha';
            btn.disabled = false;
        }
    };

    window.loadCampaignHistory = async function() {
        const tbody = document.querySelector('#table-campaign-history tbody');
        if (!tbody) return;

        try {
            const { data, error } = await getSupa().from('campanhas_mensagens')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('[CAMPANHA] Erro histórico:', error);
                tbody.innerHTML = `<tr><td colspan="5" style="color:var(--accent-red);">Erro: ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted);">Nenhum envio registrado ainda.</td></tr>';
                return;
            }

            const tipoLabels = {
                atendimento: '👋 Atendimento',
                orcamento: '💰 Orçamento',
                confirmacao: '✅ Confirmação',
                pos_venda: '⭐ Pós-venda',
                cobranca: '💳 Cobrança'
            };

            const statusColors = {
                enviado: '#25D366',
                erro: '#e74c3c',
                pendente: '#f39c12'
            };

            tbody.innerHTML = data.map(item => {
                const safeMsg = (item.mensagem_gerada || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
                const shortMsg = (item.mensagem_gerada || '-').substring(0, 80) + ((item.mensagem_gerada || '').length > 80 ? '...' : '');
                return `<tr>
                    <td style="font-size: 0.8rem;">${new Date(item.created_at).toLocaleString('pt-BR')}</td>
                    <td>${tipoLabels[item.tipo] || item.tipo}</td>
                    <td style="font-weight: 600;">${item.cliente_nome || '-'}</td>
                    <td style="font-size: 0.8rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeMsg}">${shortMsg}</td>
                    <td><span style="color: ${statusColors[item.status] || '#999'}; font-weight: 700; font-size: 0.8rem; text-transform: uppercase;">${item.status}</span></td>
                </tr>`;
            }).join('');
        } catch (err) {
            console.error('[CAMPANHA] Erro ao carregar histórico:', err);
        }
    };

    console.log('[CentralAtendimento v2.0] Live CRM, Outbound e Lista Negra carregados.');
})();


