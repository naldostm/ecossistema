import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Marcadores de início e fim da zona de desastre
start_marker = \"document.getElementById('form-caixa')?.addEventListener('submit', async (e) => {\"
end_marker = \"// MÓDULO 2: Gráfico de Caixa (Barras Receitas vs Despesas)\"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    restored_block = \"\"\"document.getElementById('form-caixa')?.addEventListener('submit', async (e) => {
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
        const osId = form.dataset.editId; // Suporte a edição

        triggerAutoSave(osId ? 'Atualizando Ordem de Serviço...' : 'Orquestrando Super Ficha no Banco...');

        const cliente = document.getElementById('super-cliente').value;
        const obra = document.getElementById('super-obra').value || null;
        const resumo = document.getElementById('super-titulo').value;
        const dataOS = document.querySelector('.c-date')?.value || new Date().toISOString();

        const payload = {
            cliente_id: cliente,
            obra_id: obra,
            servico_tipo: resumo,
            data_hora: dataOS,
            status_ia: 'Aberto'
        };

        let OS_ID = osId;

        if (osId) {
            // UPDATE
            const { error } = await supabase.from('ordens_servico').update(payload).eq('id_os', osId);
            if (error) { triggerSaveError('Erro ao atualizar OS'); return; }
            await saveAuditLog('UPDATE', 'ordens_servico', osId, payload);
        } else {
            // INSERT
            const { data: novaOS, error: errOS } = await supabase.from('ordens_servico').insert([payload]).select();
            if (errOS || !novaOS || novaOS.length === 0) {
                triggerSaveError('Erro Crítico ao gerar OS Base.');
                return;
            }
            OS_ID = novaOS[0].id_os;
            await saveAuditLog('INSERT', 'ordens_servico', OS_ID, payload);
        }

        // Limpar e reconstruir itens
        if (osId) {
            await supabase.from('os_servicos_executados').delete().eq('os_id', OS_ID);
            await supabase.from('os_materiais_utilizados').delete().eq('os_id', OS_ID);
        }

        // 2. Transborda as Tarefas
        const svcs = [];
        document.querySelectorAll('#cronograma-body tr').forEach(tr => {
            const svcId = tr.querySelector('.c-ser').value;
            if (svcId) {
                svcs.push({
                    os_id: OS_ID,
                    servico_id: svcId,
                    quantidade: 1.0,
                    subtotal_cobrado: 0 
                });
            }
        });

        if (svcs.length > 0) {
            await supabase.from('os_servicos_executados').insert(svcs);
        }

        // 3. Transborda Materiais
        const mats = [];
        document.querySelectorAll('#materiais-body tr').forEach(tr => {
            const matId = tr.querySelector('.m-id').value;
            if (matId) {
                mats.push({
                    os_id: OS_ID,
                    material_id: matId,
                    quantidade_usada: parseFloat(tr.querySelector('.m-qt').value),
                    valor_unitario_cobrado: parseFloat(tr.querySelector('.m-val').value),
                    subtotal_material: parseFloat(tr.querySelector('.m-sub').value)
                });
            }
        });

        if (mats.length > 0) {
            await supabase.from('os_materiais_utilizados').insert(mats);
        }

        triggerSaveSuccess(osId ? 'Ordem Atualizada!' : 'Ordem Gravada com Sucesso!');
        closeModal('modal-super-os');
        loadData();
    });

    // ==========================================
    // 8.5 LÓGICA DE MODAIS - JURÍDICO PMOC E PROPOSTAS
    // ==========================================
    const btnNovoContrato = document.getElementById('btn-novo-contrato');
    const modalContrato = document.getElementById('modal-contrato');
    const btnFecharContrato = document.getElementById('fechar-modal-contrato');
    const formContrato = document.getElementById('form-contrato');

    if (btnNovoContrato && modalContrato) {
        btnNovoContrato.addEventListener('click', () => {
            const selectCli = document.getElementById('contrato-cliente-id');
            selectCli.innerHTML = '<option value=\"\">Selecione o Cliente...</option>';
            if (window.clientesCache) {
                window.clientesCache.forEach(c => {
                    selectCli.innerHTML += \<option value=\"\"></option>\;
                });
            }
            modalContrato.style.display = 'flex';
        });
        btnFecharContrato.addEventListener('click', () => modalContrato.style.display = 'none');
    }

    if (formContrato) {
        formContrato.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = formContrato.dataset.editId;
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
                triggerAutoSave('Atualizando Orrato...');
                const { error } = await supabase.from('contratos_pmoc').update(payload).eq('id', editId);
                if (error) { triggerSaveError('Erro ao atualizar contrato'); }
                else { triggerSaveSuccess('Contrato Atualizado!'); delete formContrato.dataset.editId; modalContrato.style.display = 'none'; formContrato.reset(); loadData(); }
            } else {
                triggerAutoSave('Minutando Contrato no Supabase...');
                const { error: errJuridico } = await supabase.from('contratos_pmoc').insert([payload]);
                if (errJuridico) { triggerSaveError('Falha no Jurídico Supabase.'); }
                else { triggerSaveSuccess('Contrato da Júlia Salvo!'); modalContrato.style.display = 'none'; formContrato.reset(); loadData(); }
            }
        });
    }

    // Formulário Propostas V5 (Industrial)
    document.getElementById('form-proposta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = e.target.dataset.editId;
        
        const payload = {
            cliente_id: document.getElementById('prop-cliente').value || null,
            servico_tipo: document.getElementById('prop-servico').value || 'Orçamento Customizado',
            valor_proposta: parseFloat(document.getElementById('prop-valor').value) || 0,
            itens_json: JSON.parse(JSON.stringify(window.currentPropItems)),
            observacoes: document.getElementById('prop-obs').value || '',
            prazo_estimado: document.getElementById('prop-prazo').value || '7',
            status_ia: 'Pendente'
        };

        if (editId) {
            triggerAutoSave('Atualizando Orçamento...');
            const { error } = await supabase.from('propostas').update(payload).eq('id', editId);
            if (error) { triggerSaveError('Erro ao salvar propostas'); }
            else { await saveAuditLog('UPDATE', 'propostas', editId, payload); triggerSaveSuccess('Orçamento Atualizado!'); closeModal('modal-proposta'); loadData(); }
        } else {
            triggerAutoSave('Gerando Nova Proposta Industrial...');
            const { data: inserted, error } = await supabase.from('propostas').insert([payload]).select();
            if (error) { triggerSaveError('Falha no Supabase Propostas'); }
            else {
                const newId = inserted[0]?.id || 'N/A';
                await saveAuditLog('INSERT', 'propostas', newId, payload);
                triggerSaveSuccess('Orçamento Salvo!');
                closeModal('modal-proposta');
                loadData();
            }
        }
    });

    // ==========================================
    // 10. LÓGICA DE RENDERIZAÇÃO DO CHART.JS (DASHBOARD)
    // ==========================================
    let graficos = {}; 

    window.renderDashboardAnalytics = function () {
        if (typeof Chart === 'undefined') return;

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'Inter';

        // MÓDULO 1: Gráfico de OS (Pizza status)
        const ctxOS = document.getElementById('chartOS');
        if (ctxOS) {
            const ordens = window.ordensCache || [];
            if (graficos['chartOS']) graficos['chartOS'].destroy();

            const countAbertas = ordens.filter(o => o.status_ia === 'Aberto').length;
            const countEmCampo = ordens.filter(o => o.status_ia === 'Em Campo').length;
            const countFinalizadas = ordens.filter(o => o.status_ia === 'Finalizado' || o.status_ia === 'Validado').length;

            graficos['chartOS'] = new Chart(ctxOS, {
                type: 'doughnut',
                data: {
                    labels: ['Aberto (Fila)', 'Em Campo (Ian)', 'Concluído'],
                    datasets: [{
                        data: [countAbertas, countEmCampo, countFinalizadas],
                        backgroundColor: ['rgba(231, 76, 60, 0.8)', 'rgba(52, 152, 219, 0.8)', 'rgba(46, 204, 113, 0.8)'],
                        borderColor: 'transparent',
                        borderWidth: 2
                    }]
                },
                options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });
        }

        \"\"\"
    
    new_content = content[:start_idx] + restored_block + content[end_idx:]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(\"Sucesso: App.js restaurado e corrigido.\")
else:
    print(\"Erro: Marcadores não encontrados.\")
