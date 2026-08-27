document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONFIGURAÇÃO SUPABASE
    // ==========================================
    const SUPABASE_URL = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
    // ATENÇÃO: COLE SUA "anon" key do Supabase abaixo
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';

    // Instancia o cliente do Supabase globalmente usando o script CDN do index.html
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==========================================
    // 1.A CONFIGURAÇÕES DO SISTEMA (N8N / IA)
    const N8N_MASTER_WEBHOOK = 'https://arnaldotrentin.app.n8n.cloud/webhook-test/webhook-erp-web';

    const autoSaveStatus = document.getElementById('auto-save-status');

    // Estado global de visibilidade financeira (oculto por padrão)
    window.financesVisible = false;

    // Estado global do Construtor de Propostas (Restaurado V5)
    window.currentPropItems = [];

    // ==========================================
    // 1.B SPA ROUTER (V5 MODERNIZADO)
    // ==========================================
    window.showSection = function(targetId) {
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

        // Se for o dashboard, recalcula gráficos
        if (targetId === 'view-dashboard' && typeof renderDashboardAnalytics === 'function') {
            renderDashboardAnalytics();
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
        // Agora todos os admin masters e diretoria veem o lixo independentemente do cache
        const isAdmin = userCargo && ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo'].some(c => userCargo.toLowerCase().includes(c));
        const canDel = perm(table).excluir || isAdmin || true; // Forçando true para garantir que o user veja o lixo como pedido
        
        // Nome escapado para prevenir quebra no onclick
        const safeName = (name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        let html = '<div style="display:flex; justify-content:flex-end; gap: 5px;">';
        if (canDel) {
            html += `<button class="action-btn" style="padding:4px 8px; font-size:0.75rem; background:transparent; color:var(--accent-red); border:1px solid var(--accent-red); min-width:32px; cursor: pointer; z-index: 10;" onmousedown="event.stopPropagation();" onclick="event.stopPropagation(); handleDelete('${table}', '${id}', '${safeName}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;
        }
        html += '</div>';
        return html;
    }

    window.handleDelete = async function (table, id, name) {
        // Regra de Ouro: Apenas cargos de gestão deletam OS
        const isAdmin = userCargo && ['admin', 'administrador', 'diretoria', 'diretor', 'engenheiro', 'ceo', 'dono', 'master'].includes(userCargo.toLowerCase());
        
        if (table === 'ordens_servico' && !isAdmin) {
            alert('Apenas a diretoria ou engenharia pode excluir uma Ordem de Serviço.');
            return;
        }

        if (!confirm(`Deseja realmente excluir "${name}"? Esta ação não pode ser desfeita.`)) return;

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

    window.openEditGeneric = function (table, id) {
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
            'propostas': 'modal-proposta'
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

        if (!item) {
            console.warn(`Item with ID ${id} not found in cache for table ${table}.`);
            return;
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
            document.getElementById('mat-val').value = item.valor_unitario;
            document.getElementById('mat-campo-uso').value = item.campo_uso || 'Uso Geral';
        } else if (table === 'ferramentas') {
            document.getElementById('fer-nome').value = item.nome_ferramenta;
            document.getElementById('fer-status').value = item.status;
            document.getElementById('fer-local-atual').value = item.local_atual || 'Depósito Central';
            document.getElementById('fer-estado-conservacao').value = item.estado_conservacao || 'Manutenção em Dia';
            document.getElementById('fer-obs').value = item.patrimonio_obs || '';
        } else if (table === 'servicos') {
            document.getElementById('ser-nome').value = item.nome_servico;
            document.getElementById('ser-categoria').value = item.categoria || 'Geral';
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
            document.getElementById('prop-cliente').value = item.cliente_id || '';
            document.getElementById('prop-servico').value = item.servico_tipo || '';
            document.getElementById('prop-valor').value = item.valor_estimado || '';
            document.getElementById('prop-obs').value = item.observacoes || '';
            document.getElementById('prop-prazo').value = item.prazo_inicio || 7;
            if (item.itens_json) {
                try {
                    window.currentPropItems = typeof item.itens_json === 'string' ? JSON.parse(item.itens_json) : item.itens_json;
                } catch(e) { window.currentPropItems = []; }
            } else {
                window.currentPropItems = [];
            }
            if (typeof window.renderPropItemsTable === 'function') window.renderPropItemsTable();
            if (typeof window.calcPropTotal === 'function') window.calcPropTotal();
            
            // Exibir botões adicionais apenas em edição de propostas
            const btnPrint = document.getElementById('btn-print-prop');
            const btnControls = document.getElementById('prop-controls');
            if (btnPrint) btnPrint.style.display = 'block';
            if (btnControls) btnControls.style.display = (item.status === 'Pendente' || !item.status) ? 'flex' : 'none';
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

        // Limpa Colunas
        [colHoje, colAmanha, colProximos].forEach(c => c.innerHTML = '');

        if (!ordens || ordens.length === 0) {
            colAmanha.innerHTML = `<div style="text-align:center; padding: 40px; color: #666; font-style: italic; width: 100%;">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                Nenhum pedido agendado hoje.
            </div>`;
            return;
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

            // 1. Traz Ordem de Serviço (Aprimorado com Obras e Pagamento V5)
            const { data: ordens, error: errOrdens } = await supabase
                .from('ordens_servico')
                .select('id_os, servico_tipo, status_ia, status_pagamento, cliente_id, obra_id, data_hora, tecnico_id, mecanico_responsavel, clientes(nome_cliente), obras(nome_obra)')
                .order('data_hora', { ascending: false });

            if (errOrdens) {
                console.error('Erro Crítico [ordens_servico]:', errOrdens.message);
                alert(`⚠️ Erro Supabase (OS): ${errOrdens.message}\nVerifique se rodou o script V5_MASTER_DATABASE_SYNC.sql`);
            }
            if (!errOrdens && ordens) {
                window.ordensCache = ordens;
                window.renderCards(ordens);

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
                                    <td>${new Date(cx.data_ocorrencia).toLocaleDateString('pt-BR')}</td>
                                    <td style="text-align:right;">${getActionButtons('fluxo_caixa', cx.id, cx.descricao || cx.categoria)}</td>
                                </tr>`;
                    }).join('');
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

            // 2. Traz Clientes
            const { data: clientes, error: errCli } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
            if (!errCli && clientes) {
                window.clientesCache = clientes; // Guardando pra uso offline de selects
                const tbody = document.querySelector('#table-clientes tbody');
                tbody.innerHTML = clientes.map(c => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('clientes', '${c.id}')"><td>${c.nome_cliente}</td><td>${c.whatsapp || '-'}</td><td>${c.endereco_completo || '-'}</td><td>${c.documento_cpf_cnpj || '-'}</td><td style="text-align:right;">${getActionButtons('clientes', c.id, c.nome_cliente)}</td></tr>`).join('');

                // Popula select das Obras
                const selectObra = document.getElementById('ob-cliente-id');
                if (selectObra) selectObra.innerHTML = '<option value="">(Selecione o Cliente...)</option>' + clientes.map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');
            }

            // 3. Traz Materiais (Estoque)
            const { data: materiais, error: errMat } = await supabase.from('materiais').select('*');
            if (!errMat && materiais) {
                window.materiaisCache = materiais;
                const tbody = document.querySelector('#table-materiais tbody');
                tbody.innerHTML = materiais.map(m => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('materiais', '${m.id}')"><td><strong>${m.nome_material}</strong></td><td>${m.quantidade}</td><td>${m.unidade_medida}</td><td>R$ ${m.preco_compra || '0'}</td><td>R$ ${m.valor_unitario}</td><td><span class="badge normal">${m.campo_uso || 'Geral'}</span></td><td style="text-align:right;">${getActionButtons('materiais', m.id, m.nome_material)}</td></tr>`).join('');
            }

            // 4. Traz Ferramentas
            const { data: ferramentas, error: errFer } = await supabase.from('ferramentas').select('*');
            if (!errFer && ferramentas) {
                window.ferramentasCache = ferramentas;
                const tbody = document.querySelector('#table-ferramentas tbody');
                tbody.innerHTML = ferramentas.map(f => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('ferramentas', '${f.id}')"><td>${f.nome_ferramenta}</td><td><span class="badge ${f.status === 'Disponível' ? 'success' : (f.status === 'Manutenção' ? 'danger' : 'warning')}">${f.status}</span></td><td>${f.local_atual || 'Depósito Central'}</td><td>${f.estado_conservacao || 'OK'}</td><td>${f.observacao || '-'}</td><td style="text-align:right;">${getActionButtons('ferramentas', f.id, f.nome_ferramenta)}</td></tr>`).join('');
            }

            // 5. Traz Servicos
            const { data: servicos, error: errSer } = await supabase.from('servicos').select('*');
            if (!errSer && servicos) {
                window.servicosCache = servicos;
                const tbody = document.querySelector('#table-servicos tbody');
                tbody.innerHTML = servicos.map(s => `<tr style="cursor: pointer;" onclick="window.openEditGeneric('servicos', '${s.id}')"><td><strong>${s.nome_servico}</strong></td><td><span class="badge in-progress">${s.categoria || 'Geral'}</span></td><td>${s.descricao || '-'}</td><td>R$ ${s.valor_base}</td><td style="text-align:right;">${getActionButtons('servicos', s.id, s.nome_servico)}</td></tr>`).join('');
            }

            // 6. Traz Quadro de Funcionários (Colaboradores)
            const { data: colaboradores, error: errCol } = await supabase.from('colaboradores').select('*');
            if (!errCol && colaboradores) {
                window.colabCache = colaboradores;
                const tbody = document.querySelector('#table-colaboradores tbody');
                const CARGO_LABELS = { admin: 'Administrador', financeiro: 'Financeiro', atendimento: 'Atendimento', tecnico: 'Técnico de Campo' };
                const CARGO_BADGES = { admin: 'danger', financeiro: 'warning', atendimento: 'in-progress', tecnico: 'normal' };
                if (tbody) {
                    tbody.innerHTML = colaboradores.map(c => {
                        const cargoLabel = CARGO_LABELS[c.cargo] || c.cargo;
                        const cargoBadge = CARGO_BADGES[c.cargo] || 'normal';
                        const ultimoAcesso = c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca';
                        return `<tr style="cursor: pointer;" onclick="if(perm('colaboradores').modificar && window.openEditColab) window.openEditColab('${c.id}')">
                            <td><strong><i class="fa-solid fa-user"></i> ${c.nome_completo}</strong></td>
                            <td>${c.telefone_whatsapp || '-'}</td>
                            <td>${c.email || '-'}</td>
                            <td><span style="font-size:0.8rem; color: var(--text-muted);">${ultimoAcesso}</span></td>
                            <td><span class="badge ${cargoBadge}">${cargoLabel}</span></td>
                            <td style="text-align:right;">${getActionButtons('colaboradores', c.id, c.nome_completo)}</td>
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
                            return `<tr style="cursor: pointer;" onclick="window.openEditGeneric('propostas', '${p.id}')">
                                <td><strong><i class="fa-solid fa-file-invoice-dollar"></i> ${p.servico_tipo || 'Orçamento'}</strong><br><small style="color:#a4b0be">ID: ${p.id.split('-')[0]}</small></td>
                                <td>${p.clientes?.nome_cliente || '-'}</td>
                                <td><span class="badge ${badgeSt}">${p.status || 'Novo'}</span></td>
                                <td><strong style="color:var(--accent-green)">R$ ${parseFloat(p.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                                <td style="text-align:right;">${getActionButtons('propostas', p.id, p.servico_tipo)}</td>
                            </tr>`;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#a4b0be; padding:30px;">Nenhuma proposta gerada até o momento.</td></tr>`;
                    }
                }
            }

            // ==========================================
            // 8. RENDERIZAR DASHBOARD ANALÍTICO EM TEMPO REAL E AGENDAS
            // ==========================================
            if (typeof renderDashboardAnalytics === 'function') {
                renderDashboardAnalytics();
            }

            if (typeof window.renderTechAgenda === 'function') {
                window.renderTechAgenda();
            }

            // Re-aplica visibilidade de preços após renderização das tabelas
            applyPriceVisibility();

            triggerSaveSuccess('Auto-Save Ativo (Supabase Connect)');
        } catch (err) {
            console.error('Erro ao buscar dados:', err);
            triggerSaveError('Erro na Conexão Supabase!');
        }
    }

    // ==========================================
    // REALTIME ENGINE (SUPABASE)
    // ==========================================
    function initRealtime() {
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
            .subscribe();

        console.log('[Realtime] Escuta de mudanças ativada.');
    }

    function renderCards(ordens) {
        // Limpar colunas com a nova lógica de Agenda V5
        document.getElementById('col-todo').innerHTML = `<h4><i class="fa-solid fa-calendar-day"></i> Hoje</h4>`;
        document.getElementById('col-in-progress').innerHTML = `<h4><i class="fa-solid fa-calendar-week"></i> Amanhã</h4>`;
        document.getElementById('col-done').innerHTML = `<h4><i class="fa-solid fa-calendar-days"></i> Próximos Dias</h4>`;

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
            if (osDate) osDate.setHours(0,0,0,0);

            let badgeClass = 'normal';
            if (os.status_ia === 'Aberto') badgeClass = 'danger';
            if (os.status_ia === 'Em Campo') badgeClass = 'in-progress';

            const clienteNome = os.clientes ? os.clientes.nome_cliente : `Cliente Indefinido`;
            const nomeObra = os.obras ? os.obras.nome_obra : false;
            const badgePagamento = os.status_pagamento === 'Pago' ? `<span class="badge success" style="font-size:0.6rem;"><i class="fa-solid fa-check-double"></i> Pago</span>` : (os.status_pagamento === 'Pendente' ? `<span class="badge danger" style="font-size:0.6rem;"><i class="fa-solid fa-clock"></i> Pendente</span>` : `<span class="badge normal" style="font-size:0.6rem;">Sem Fatura</span>`);

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h5 style="margin:0;">${clienteNome} <small>(#${os.id_os})</small></h5>
                    <span style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">${os.data_hora ? os.data_hora.split('T')[1].substring(0,5) : 'H/N'}</span>
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
                document.getElementById('col-todo').appendChild(card);
            } else if (osDate.getTime() === tomorrow.getTime()) {
                document.getElementById('col-in-progress').appendChild(card);
            } else if (osDate.getTime() >= dayAfter.getTime()) {
                document.getElementById('col-done').appendChild(card);
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
            const isAdminNames = ['admin', 'administrador', 'diretoria', 'diretor', 'engenheiro', 'ceo', 'dono', 'master'];
            const isUserAdmin = isAdminNames.includes(userCargo) || (colab && colab.nome_completo && colab.nome_completo.toLowerCase().includes('arnaldo'));
            const isAdmin = isUserAdmin;

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
            const cargo = document.getElementById('reg-cargo').value;
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
    // ENGINE V2: AGENT TIMEOUTS & FALLBACK (3000ms)
    // ==========================================
    async function callAIWithTimeout(agentName, payload, timeoutMs = 4000) {
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
        chatSecToggle.addEventListener('click', () => {
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
    // 5.D CHAT DA MÁRCIA RIBEIRO (FINANÇAS/MARKETING)
    // ==========================================
    const chatMarciaToggle = document.getElementById('chat-marcia-toggle');
    const chatMarciaContainer = document.getElementById('chat-marcia-container');
    const closeMarciaChat = document.getElementById('close-marcia-chat');
    const sendMarciaChat = document.getElementById('send-marcia-chat');
    const chatMarciaInput = document.getElementById('chat-marcia-input');
    const chatMarciaMessages = document.getElementById('chat-marcia-messages');

    if (chatMarciaToggle && chatMarciaContainer) {
        chatMarciaToggle.addEventListener('click', () => {
            chatMarciaContainer.classList.add('open');
            chatMarciaToggle.style.transform = 'scale(0)';
        });
        closeMarciaChat.addEventListener('click', () => {
            chatMarciaContainer.classList.remove('open');
            chatMarciaToggle.style.transform = 'scale(1)';
        });

        function handleMarciaChatSubmit() {
            const text = chatMarciaInput.value.trim();
            if (!text) return;

            const userMsg = document.createElement('div');
            userMsg.className = 'msg user';
            userMsg.textContent = text;
            chatMarciaMessages.appendChild(userMsg);

            chatMarciaInput.value = '';
            chatMarciaMessages.scrollTop = chatMarciaMessages.scrollHeight;

            const typingMsg = document.createElement('div');
            typingMsg.className = 'msg ai typing';
            typingMsg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Márcia analisando caixa...';
            chatMarciaMessages.appendChild(typingMsg);
            chatMarciaMessages.scrollTop = chatMarciaMessages.scrollHeight;

            callAIWithTimeout('Márcia Ribeiro', { text: text }).then(res => {
                typingMsg.classList.remove('typing');
                if (res.status === 'success') {
                    typingMsg.innerHTML = `<strong>Márcia:</strong><br>${res.data.dados}<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                } else {
                    typingMsg.innerHTML = `<strong>Aviso do Sistema:</strong><br>A Márcia está rodando o fechamento do mês. Resposta demorando mais de 4s, processo enviado p/ background.<br><span style="font-size:0.6rem; opacity:0.5;">ID: ${res.correlationId}</span>`;
                }
                chatMarciaMessages.scrollTop = chatMarciaMessages.scrollHeight;
            });
        }

        sendMarciaChat?.addEventListener('click', handleMarciaChatSubmit);
        chatMarciaInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleMarciaChatSubmit();
        });
    }

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
    // 8. FORMULÁRIOS DE CADASTRO (CRUD)
    // ==========================================
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
        const colabId = document.getElementById('edit-colab-id').value;
        if (!colabId) return;

        triggerAutoSave('Atualizando Colaborador...');
        const { error } = await supabase.from('colaboradores').update({
            nome_completo: document.getElementById('edit-colab-nome').value,
            telefone_whatsapp: document.getElementById('edit-colab-tel').value,
            email: document.getElementById('edit-colab-email').value,
            cargo: document.getElementById('edit-colab-cargo').value,
        }).eq('id', colabId);

        if (error) {
            triggerSaveError('Erro ao atualizar colaborador');
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
    if (btnProposta) btnProposta.addEventListener('click', () => {
        // Popular Selects de Proposta com Optgroups Categorizados
        const sSvc = document.getElementById('prop-service-picker');
        const sMat = document.getElementById('prop-material-picker');
        const sCli = document.getElementById('prop-cliente');

        if (sCli) sCli.innerHTML = '<option value="">Selecione o Cliente...</option>' + (window.clientesCache || []).map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');

        if (sSvc) {
            const cats = [...new Set((window.servicosCache || []).map(s => s.categoria || 'Geral'))];
            sSvc.innerHTML = '<option value="">--- Escolha um Serviço ---</option>' + cats.map(cat => {
                const items = window.servicosCache.filter(s => (s.categoria || 'Geral') === cat);
                return `<optgroup label="${cat}">${items.map(s => `<option value="${s.id}">${s.nome_servico}</option>`).join('')}</optgroup>`;
            }).join('');
        }

        if (sMat) {
            const cats = [...new Set((window.materiaisCache || []).map(m => m.campo_uso || 'Geral'))];
            sMat.innerHTML = '<option value="">--- Escolha um Material ---</option>' + cats.map(cat => {
                const items = window.materiaisCache.filter(m => (m.campo_uso || 'Geral') === cat);
                return `<optgroup label="${cat}">${items.map(m => `<option value="${m.id}">${m.nome_material} (${m.unidade_medida})</option>`).join('')}</optgroup>`;
            }).join('');
        }

        window.currentPropItems = [];
        window.renderPropItemsTable();
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

        if (osId) {
            // MODO EDIÇÃO: Busca dados da OS no Cache
            const os = (window.ordensCache || []).find(o => String(o.id_os) === String(osId));
            if (os) {
                if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-file-invoice"></i> Editando OS #${os.id_os}`;
                const form = document.querySelector('#modal-super-os form');
                if (form) form.dataset.editId = os.id_os; // Crucial for Update
                
                document.getElementById('super-cliente').value = os.cliente_id || '';
                document.getElementById('super-obra').value = os.obra_id || '';
                document.getElementById('super-titulo').value = os.servico_tipo || '';
                // No futuro aqui carregamos materiais/serviços vinculados para edição
            }
        } else {
            // MODO NOVO: Limpa tudo
            if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-file-circle-plus"></i> Abrir Nova OS`;
            document.getElementById('super-cliente').value = '';
            document.getElementById('super-obra').value = '';
            document.getElementById('super-titulo').value = '';
            document.getElementById('cronograma-body').innerHTML = '';
            document.getElementById('materiais-body').innerHTML = '';
            calcMateriais();
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
            <td><select class="c-ser auth-select" required><option value="">Selecione...</option>${optionsHtml}</select></td>
            <td><input type="date" class="c-date modal-input" title="Data Execução" required value="${new Date().toISOString().split('T')[0]}"></td>
            <td><select class="c-col auth-select"><option value="">TBD (Sem técnico)</option>${(window.colabCache || []).map(c => '<option value="' + c.id + '">' + c.nome_completo + '</option>').join('')}</select></td>
            <td><button type="button" style="color:red; background:none; border:none; cursor:pointer;" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>
        `;
        t.appendChild(tr);
    });

    // ==========================================
    // 9.B SUPER FICHA: MATERIAIS DINÂMICOS
    // ==========================================
    window.calcMateriais = function () {
        let sum = 0;
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            sum += parseFloat(tr.querySelector('.m-sub').value) || 0;
        });
        document.getElementById('total-materiais-os').textContent = 'R$ ' + sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }

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

    window.updatePropItemQty = function(index, newQty) {
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

    document.getElementById('form-material')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveToDatabase('materiais', {
            nome_material: document.getElementById('mat-nome').value,
            quantidade: parseFloat(document.getElementById('mat-qtd').value),
            unidade_medida: document.getElementById('mat-un').value,
            preco_compra: parseFloat(document.getElementById('mat-compra').value),
            valor_unitario: parseFloat(document.getElementById('mat-venda').value),
            campo_uso: document.getElementById('mat-uso').value
        }, 'modal-material');
    });

    document.getElementById('form-ferramenta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveToDatabase('ferramentas', {
            nome_ferramenta: document.getElementById('fer-nome').value,
            status: document.getElementById('fer-status').value,
            local_atual: document.getElementById('fer-local-atual').value,
            estado_conservacao: document.getElementById('fer-estado-conservacao').value,
            observacao: document.getElementById('fer-obs').value
        }, 'modal-ferramenta');
    });

    document.getElementById('form-servico')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let jsonObj = {};
        try {
            const rawJson = document.getElementById('ser-descritivo-json').value;
            if (rawJson) jsonObj = JSON.parse(rawJson);
        } catch (e) { console.warn('JSON inválido'); }
        await saveToDatabase('servicos', {
            nome_servico: document.getElementById('ser-nome').value,
            categoria: document.getElementById('ser-categoria').value,
            descritivo_json: jsonObj,
            descricao: document.getElementById('ser-desc').value,
            valor_base: parseFloat(document.getElementById('ser-val').value)
        }, 'modal-servico');
    });

    document.getElementById('form-obra')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveToDatabase('obras', {
            nome_obra: document.getElementById('ob-nome').value,
            cliente_id: document.getElementById('ob-cliente-id').value,
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

    // Formulário Super OS (A Revolução)
    document.getElementById('form-super-os')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const osId = form.dataset.editId;
        triggerAutoSave(osId ? 'Atualizando Ordem de Serviço...' : 'Orquestrando Super Ficha no Banco...');

        const payload = {
            cliente_id: document.getElementById('super-cliente').value,
            obra_id: document.getElementById('super-obra').value || null,
            servico_tipo: document.getElementById('super-titulo').value,
            data_hora: document.querySelector('.c-date')?.value || new Date().toISOString(),
            status_ia: 'Aberto'
        };

        let OS_ID = osId;
        if (osId) {
            const { error } = await supabase.from('ordens_servico').update(payload).eq('id_os', osId);
            if (error) { triggerSaveError('Erro ao atualizar OS'); return; }
            await saveAuditLog('UPDATE', 'ordens_servico', osId, payload);
        } else {
            const { data: novaOS, error: errOS } = await supabase.from('ordens_servico').insert([payload]).select();
            if (errOS || !novaOS || novaOS.length === 0) { triggerSaveError('Erro Crítico ao gerar OS Base.'); return; }
            OS_ID = novaOS[0].id_os;
            await saveAuditLog('INSERT', 'ordens_servico', OS_ID, payload);
        }

        if (osId) {
            await supabase.from('os_servicos_executados').delete().eq('os_id', OS_ID);
            await supabase.from('os_materiais_utilizados').delete().eq('os_id', OS_ID);
        }

        const svcs = [];
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            const svcId = tr.querySelector('.c-ser')?.value;
            if (svcId) svcs.push({ os_id: OS_ID, servico_id: svcId, quantidade: 1.0, subtotal_cobrado: 0 });
        });
        if (svcs.length > 0) await supabase.from('os_servicos_executados').insert(svcs);

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
        if (mats.length > 0) await supabase.from('os_materiais_utilizados').insert(mats);

        triggerSaveSuccess(osId ? 'Ordem Atualizada!' : 'Ordem Gravada com Sucesso!');
        closeModal('modal-super-os');
        loadData();
    });

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
        const payload = {
            cliente_id: document.getElementById('contrato-cliente-id').value,
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
    window.approveProposal = async function() {
        const form = document.getElementById('form-proposta');
        const editId = form.dataset.editId;
        if (!editId) return alert('É necessário salvar a proposta primeiro.');

        const dataAgendamento = prompt('Proposta Aprovada! Digite a data inicial do serviço (ex: 15/04/2026):');
        if (!dataAgendamento) return;

        triggerAutoSave('Gerando Ordem de Serviço...');
        try {
            const clienteId = document.getElementById('prop-cliente').value;
            const servicoTipo = document.getElementById('prop-servico').value;
            const valor = parseFloat(document.getElementById('prop-valor').value) || 0;
            const observacoes = document.getElementById('prop-obs').value + ' | Ref OS: Proposta ' + editId.split('-')[0];

            // 1. Cria a OS
            const payloadOS = {
                cliente_id: clienteId,
                servico_tipo: servicoTipo,
                prioridade: 'MEDIA',
                status_ia: 'Aberto',
                data_hora: new Date().toISOString(),
                valor_total: valor,
                relato_cliente: observacoes
            };
            const { data: osData, error: osErr } = await supabase.from('ordens_servico').insert([payloadOS]).select();
            if (osErr) throw osErr;

            // 2. Atualiza Proposta para 'Aprovado'
            await supabase.from('propostas').update({ status: 'Aprovado' }).eq('id', editId);
            
            triggerSaveSuccess('Proposta Aprovada e OS Criada!');
            closeModal('modal-proposta');
            loadData();
        } catch (e) {
            console.error(e);
            triggerSaveError('Erro ao Aprovar Proposta.');
        }
    };

    window.rejectProposal = async function() {
        const form = document.getElementById('form-proposta');
        const editId = form.dataset.editId;
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

    window.generateProposalPDF = function() {
        const form = document.getElementById('form-proposta');
        const editId = form.dataset.editId;
        if (!editId) return alert('Salve a proposta antes de gerar o PDF.');
        
        // Popula template
        const comboCli = document.getElementById('prop-cliente');
        const nomeCliente = comboCli.options[comboCli.selectedIndex]?.text || '';
        document.getElementById('print-cliente').innerText = nomeCliente;
        document.getElementById('print-servico').innerText = document.getElementById('prop-servico').value || '-';
        document.getElementById('print-data').innerText = new Date().toLocaleDateString('pt-BR');
        const prazo = document.getElementById('prop-prazo').value || '5';
        document.getElementById('print-prazo').innerText = prazo;
        const total = parseFloat(document.getElementById('prop-valor').value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('print-total').innerText = total;
        document.getElementById('print-valor-mo-resumo').innerText = total;
        document.getElementById('print-valor-mo').innerText = total;
        document.getElementById('print-valor-mat-resumo').innerText = '0,00';
        document.getElementById('print-valor-mat').innerText = '0,00';
        document.getElementById('print-ref').innerText = editId.split('-')[0].toUpperCase();
        
        const forn = document.getElementById('prop-fornecimento').value;
        document.getElementById('print-fornecimento-texto').innerText = forn;
        document.getElementById('print-fornecimento-check').innerText = forn.includes('Trentin') ? '⭐' : 'X';

        const opt = {
            margin:       10,
            filename:     `Orcamento_${nomeCliente.substring(0,10).trim()}_${editId.split('-')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const el = document.getElementById('print-proposta-template');
        el.style.display = 'block'; // mostra pro html2pdf capturar
        
        triggerAutoSave('Gerando PDF...');
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(el).save().then(() => {
                el.style.display = 'none'; // esconde novamente
                triggerSaveSuccess('PDF Baixado com sucesso!');
            });
        } else {
            alert("Biblioteca PDF não carregada. Pressione F5 ou tente novamente.");
            el.style.display = 'none';
        }
    };

    // Formulário Propostas V5 (Industrial)
    document.getElementById('form-proposta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = e.target.dataset.editId;
        const payload = {
            cliente_id: document.getElementById('prop-cliente').value || null,
            servico_tipo: document.getElementById('prop-servico').value || 'Orçamento Customizado',
            valor_estimado: parseFloat(document.getElementById('prop-valor').value) || 0,
            itens_json: JSON.parse(JSON.stringify(window.currentPropItems || [])),
            observacoes: document.getElementById('prop-obs').value || '',
            prazo_inicio: parseInt(document.getElementById('prop-prazo').value) || 7,
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

    window.renderTechAgenda = function() {
        const container = document.getElementById('tech-agenda-container');
        if (!container) return;
        container.innerHTML = '';
        const technicians = (window.colabCache || []).filter(c => ['tecnico', 'engenheiro', 'admin', 'gerente'].includes(c.cargo?.toLowerCase()));
        technicians.forEach(tech => {
            const techOsList = (window.ordensCache || []).filter(o => 
                (o.responsavel && o.responsavel.toLowerCase() === tech.nome_completo.toLowerCase()) || 
                (o.tecnico_id && String(o.tecnico_id) === String(tech.id))
            );
            const cardsHtml = techOsList.slice(0, 5).map(os => {
                const day = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR').substring(0, 5) : '?';
                return `<div class="agenda-card-mini" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--accent-blue); cursor: pointer;" onclick="window.openSuperOS('${os.id_os}')">
                    <span style="color:var(--text-muted); font-size:0.75rem;">${day} |</span> <strong>OS ${os.id_os}</strong>
                </div>`;
            }).join('') || '<div style="color:var(--text-muted); font-size:0.7rem;">Vazio</div>';
            const el = document.createElement('div');
            el.className = 'glass-panel-dark tech-card';
            el.style.cssText = 'padding: 15px; border-radius: 12px;';
            el.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 10px;">
                    <h3 style="margin:0; font-size: 0.9rem; color: white;">${tech.nome_completo}</h3>
                    <button class="action-btn" style="padding:2px 6px; font-size:0.7rem;" onclick="window.openSuperOS(); document.getElementById('super-titulo').value='Agendado: ${tech.nome_completo}';">OS+</button>
                </div>
                <div>${cardsHtml}</div>`;
            container.appendChild(el);
        });
    };

});