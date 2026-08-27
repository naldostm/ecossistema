const fs = require('fs');
const content = \        }

        await saveToDatabase('servicos', {
            nome_servico: document.getElementById('ser-nome').value,
            categoria: document.getElementById('ser-categoria').value,
            descritivo_json: jsonObj,
            descricao: document.getElementById('ser-desc').value,
            valor_base: parseFloat(document.getElementById('ser-val').value)
        }, 'modal-servico');
    });

    // Formulário Obras
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

    // Formulário Caixa Central
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
        triggerAutoSave(osId ? 'Atualizando OS...' : 'Gerando Nova OS...');

        const payload = {
            cliente_id: document.getElementById('super-cliente').value,
            obra_id: document.getElementById('super-obra').value || null,
            servico_tipo: document.getElementById('super-titulo').value,
            data_hora: document.querySelector('.c-date')?.value || new Date().toISOString(),
            status_ia: 'Aberto'
        };

        let OS_ID = osId;
        if (osId) {
            await supabase.from('ordens_servico').update(payload).eq('id_os', osId);
        } else {
            const { data } = await supabase.from('ordens_servico').insert([payload]).select();
            if (data && data.length > 0) OS_ID = data[0].id_os;
        }

        if (osId) {
            await supabase.from('os_servicos_executados').delete().eq('os_id', OS_ID);
            await supabase.from('os_materiais_utilizados').delete().eq('os_id', OS_ID);
        }

        const svcs = [];
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            const sid = tr.querySelector('.c-ser').value;
            if (sid) svcs.push({ os_id: OS_ID, servico_id: sid, quantidade: 1, subtotal_cobrado: 0 });
        });
        if (svcs.length) await supabase.from('os_servicos_executados').insert(svcs);

        const mats = [];
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            const mid = tr.querySelector('.m-id').value;
            if (mid) mats.push({
                os_id: OS_ID,
                material_id: mid,
                quantidade_usada: parseFloat(tr.querySelector('.m-qt').value),
                valor_unitario_cobrado: parseFloat(tr.querySelector('.m-val').value),
                subtotal_material: parseFloat(tr.querySelector('.m-sub').value)
            });
        });
        if (mats.length) await supabase.from('os_materiais_utilizados').insert(mats);

        triggerSaveSuccess();
        closeModal('modal-super-os');
        loadData();
    });

    // Formulário Propostas
    document.getElementById('form-proposta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = e.target.dataset.editId;
        const payload = {
            cliente_id: document.getElementById('prop-cliente').value || null,
            servico_tipo: document.getElementById('prop-servico').value || 'Orçamento',
            valor_proposta: parseFloat(document.getElementById('prop-valor').value) || 0,
            itens_json: window.currentPropItems,
            observacoes: document.getElementById('prop-obs').value || '',
            prazo_estimado: document.getElementById('prop-prazo').value || '7',
            status_ia: 'Pendente'
        };
        if (editId) await supabase.from('propostas').update(payload).eq('id', editId);
        else await supabase.from('propostas').insert([payload]);
        triggerSaveSuccess();
        closeModal('modal-proposta');
        loadData();
    });

    // Analytics Dashboard
    let graficos = {};
    window.renderDashboardAnalytics = function () {
        if (typeof Chart === 'undefined') return;
        
        const ctxOS = document.getElementById('chartOS');
        if (ctxOS) {
            if (graficos['chartOS']) graficos['chartOS'].destroy();
            const ordens = window.ordensCache || [];
            const cA = ordens.filter(o => o.status_ia === 'Aberto').length;
            const cE = ordens.filter(o => o.status_ia === 'Em Campo').length;
            const cF = ordens.filter(o => o.status_ia === 'Finalizado').length;
            graficos['chartOS'] = new Chart(ctxOS, {
                type: 'doughnut',
                data: {
                    labels: ['Aberto', 'Em Campo', 'Concluído'],
                    datasets: [{
                        data: [cA, cE, cF],
                        backgroundColor: ['#e74c3c', '#3498db', '#2ecc71']
                    }]
                },
                options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });
        }
        
        const ctxCaixa = document.getElementById('chartCaixa');
        if (ctxCaixa) {
            if (graficos['chartCaixa']) graficos['chartCaixa'].destroy();
            let ent = 0; let sai = 0;
            const caixa = window.fluxoCaixaCache || [];
            caixa.forEach(cx => {
                if (cx.tipo_movimento === 'Entrada') ent += parseFloat(cx.valor || 0);
                else sai += parseFloat(cx.valor || 0);
            });
            graficos['chartCaixa'] = new Chart(ctxCaixa, {
                type: 'bar',
                data: {
                    labels: ['Financeiro'],
                    datasets: [
                        { label: 'Entradas', data: [ent], backgroundColor: '#2ecc71' },
                        { label: 'Saídas', data: [sai], backgroundColor: '#e74c3c' }
                    ]
                }
            });
        }
    };

    // Agenda Técnica
    window.renderTechAgenda = function() {
        const container = document.getElementById('tech-agenda-container');
        if (!container || !window.colabCache || !window.ordensCache) return;
        container.innerHTML = '';
        const technicians = window.colabCache.filter(c => ['tecnico', 'engenheiro', 'admin'].includes(c.cargo));
        technicians.forEach(tech => {
            const techOsList = window.ordensCache.filter(o => o.responsavel === tech.nome_completo || o.tecnico_id === tech.id);
            const cardsHtml = techOsList.slice(0,4).map(os => {
                const day = os.data_hora ? new Date(os.data_hora).toLocaleDateString('pt-BR').substring(0, 5) : '?';
                return \<div style="background:rgba(255,255,255,0.05); padding:5px; border-radius:4px; margin-bottom:5px; font-size:0.8rem;">\ | OS \ - \</div>\;
            }).join('');
            const el = document.createElement('div');
            el.style.cssText = \ackground: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent-blue);\;
            el.innerHTML = \<h3 style="margin:0 0 10px 0; font-size:1rem;">\</h3><div>\</div>\;
            container.appendChild(el);
        });
    };

});\;

fs.writeFileSync('rescue_tail_v2.txt', content, 'utf8');
