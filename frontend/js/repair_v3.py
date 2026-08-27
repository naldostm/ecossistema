import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Marcadores extremamente específicos
start_marker = \"// Formulário Caixa Central\"
end_marker = \"// ==========================================\\n    // AGENDA TÉCNICA DINÂMICA\"

# Tenta encontrar com quebras de linha variadas
start_idx = content.find(start_marker)
end_idx = content.find(\"// AGENDA TÉCNICA DINÂMICA\")

if start_idx != -1 and end_idx != -1:
    # O marcador final deve começar um pouco antes de \"// AGENDA TÉCNICA DINÂMICA\"
    # para pegar os separadores visualmente.
    actual_end_idx = content.rfind(\"// ========================================== \", 0, end_idx)
    if actual_end_idx == -1: actual_end_idx = end_idx

    new_block = \"\"\"// Formulário Caixa Central
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
            OS_ID = data[0].id_os;
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

    // Gráficos e Analytics
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
            (window.fluxoCaixaCache || []).forEach(cx => {
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
    }

    \"\"\"
    
    new_content = content[:start_idx] + new_block + content[actual_end_idx:]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(\"Sucesso: App.js restaurado.\")
else:
    print(f\"Erro: Marcadores nao encontrados. Start: {start_idx}, End: {end_idx}\")
