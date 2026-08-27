import os

file_path = os.path.join("C:\\ecossistema arnaldo trentin", "frontend", "js", "app.js")

with open(file_path, 'r', encoding='utf-16-le') as f:
    content = f.read()

# Replace Modal Map
map_target = """            'contratos_pmoc': 'modal-contrato',
            'colaboradores': 'modal-edit-colab',
            'propostas': 'modal-proposta'
        };"""
map_replacement = """            'contratos_pmoc': 'modal-contrato',
            'colaboradores': 'modal-edit-colab',
            'propostas': 'modal-proposta',
            'faturamentos': 'modal-faturamento',
            'comissoes': 'modal-comissao'
        };"""
content = content.replace(map_target, map_replacement, 1)

# Replace Cache checks
cache_target = """        if (table === 'contratos_pmoc') item = (window.contratosCache || []).find(findId);
        if (table === 'colaboradores') item = (window.colabCache || []).find(findId);
        if (table === 'propostas') item = (window.propostasCache || []).find(findId);

        if (!item) {"""
cache_replacement = """        if (table === 'contratos_pmoc') item = (window.contratosCache || []).find(findId);
        if (table === 'colaboradores') item = (window.colabCache || []).find(findId);
        if (table === 'propostas') item = (window.propostasCache || []).find(findId);
        if (table === 'faturamentos') item = (window.faturamentosCache || []).find(findId);
        if (table === 'comissoes') item = (window.comissoesCache || []).find(findId);

        if (!item) {"""
content = content.replace(cache_target, cache_replacement, 1)

# Replace Populating fields
populate_target = """            const btnControls = document.getElementById('prop-controls');
            if (btnPrint) btnPrint.style.display = 'block';
            if (btnControls) btnControls.style.display = (item.status === 'Pendente' || !item.status) ? 'flex' : 'none';
        }

        openModal(modalId, true);"""
populate_replacement = """            const btnControls = document.getElementById('prop-controls');
            if (btnPrint) btnPrint.style.display = 'block';
            if (btnControls) btnControls.style.display = (item.status === 'Pendente' || !item.status) ? 'flex' : 'none';
        } else if (table === 'faturamentos') {
            document.getElementById('fat-id').value = item.id;
            
            const selectOS = document.getElementById('fat-os-id');
            selectOS.innerHTML = '<option value="">Faturamento Manual / Sem OS</option>' + (window.ordensCache || []).map(o => `<option value="${o.id_os}">OS #${o.id_os} - ${o.clientes?.nome_cliente || ''}</option>`).join('');
            selectOS.value = item.os_id || '';
            
            document.getElementById('fat-valor').value = item.valor_geral || 0;
            document.getElementById('fat-status').value = item.status || 'Pendente';
        } else if (table === 'comissoes') {
            document.getElementById('com-id').value = item.id;
            
            const selectCol = document.getElementById('com-colaborador-id');
            selectCol.innerHTML = '<option value="">Selecione o Colaborador...</option>' + (window.colabCache || []).map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');
            selectCol.value = item.colaborador_id || '';
            
            document.getElementById('com-perc').value = item.percentual_acordado || 0;
            document.getElementById('com-valor').value = item.valor_pagar || 0;
            document.getElementById('com-status').value = item.status_pagamento || 'Pendente';
        }

        openModal(modalId, true);"""
content = content.replace(populate_target, populate_replacement, 1)


# Inject Event Listeners at bottom
bottom_target = """                // Se cancelou, volta pra primeira opção
                e.target.selectedIndex = 0;
            }
        }
    });

});"""
bottom_replacement = """                // Se cancelou, volta pra primeira opção
                e.target.selectedIndex = 0;
            }
        }
    });

    // ==========================================
    // 9. LÓGICA DE FATURAMENTO E COMISSÕES
    // ==========================================
    const btnNovoFaturamento = document.getElementById('btn-novo-faturamento');
    if (btnNovoFaturamento) {
        btnNovoFaturamento.addEventListener('click', () => {
            const form = document.getElementById('form-faturamento');
            if(form) {
                form.reset();
                form.dataset.editId = '';
            }
            const fatIdEl = document.getElementById('fat-id');
            if(fatIdEl) fatIdEl.value = '';
            
            const selectOS = document.getElementById('fat-os-id');
            if(selectOS) {
                selectOS.innerHTML = '<option value="">Faturamento Manual / Sem OS</option>' + (window.ordensCache || []).map(o => `<option value="${o.id_os}">OS #${o.id_os} - ${o.clientes?.nome_cliente || ''}</option>`).join('');
            }
            openModal('modal-faturamento', true);
        });
    }

    const formFaturamento = document.getElementById('form-faturamento');
    if (formFaturamento) {
        formFaturamento.addEventListener('submit', async (e) => {
            e.preventDefault();
            triggerAutoSave('Gravando Faturamento...');
            const idForm = document.getElementById('fat-id').value || null;
            
            const payload = {
                os_id: document.getElementById('fat-os-id').value || null,
                valor_geral: parseFloat(document.getElementById('fat-valor').value),
                status: document.getElementById('fat-status').value
            };
            
            let query = supabase.from('faturamentos');
            if (idForm) {
                query = query.update(payload).eq('id', idForm);
            } else {
                query = query.insert([payload]);
            }
            
            const { error } = await query;
            if (error) {
                console.error(error);
                triggerSaveError(error.message);
            } else {
                triggerSaveSuccess();
                closeModal('modal-faturamento');
                if (typeof window.loadFaturamentos === 'function') window.loadFaturamentos();
            }
        });
    }

    const btnNovaComissao = document.getElementById('btn-nova-comissao');
    if (btnNovaComissao) {
        btnNovaComissao.addEventListener('click', () => {
            const form = document.getElementById('form-comissao');
            if(form) {
                form.reset();
                form.dataset.editId = '';
            }
            const comIdEl = document.getElementById('com-id');
            if(comIdEl) comIdEl.value = '';
            
            const selectCol = document.getElementById('com-colaborador-id');
            if(selectCol) {
                selectCol.innerHTML = '<option value="">Selecione o Colaborador...</option>' + (window.colabCache || []).map(c => `<option value="${c.id}">${c.nome_completo}</option>`).join('');
            }
            openModal('modal-comissao', true);
        });
    }

    const formComissao = document.getElementById('form-comissao');
    if (formComissao) {
        formComissao.addEventListener('submit', async (e) => {
            e.preventDefault();
            triggerAutoSave('Gravando Comissão...');
            const idForm = document.getElementById('com-id').value || null;
            
            const payload = {
                colaborador_id: document.getElementById('com-colaborador-id').value,
                percentual_acordado: parseFloat(document.getElementById('com-perc').value || 0),
                valor_pagar: parseFloat(document.getElementById('com-valor').value),
                status_pagamento: document.getElementById('com-status').value
            };
            
            let query = supabase.from('comissoes');
            if (idForm) {
                query = query.update(payload).eq('id', idForm);
            } else {
                query = query.insert([payload]);
            }
            
            const { error } = await query;
            if (error) {
                console.error(error);
                triggerSaveError(error.message);
            } else {
                if (payload.status_pagamento === 'Pago' && document.getElementById('com-auto-caixa') && document.getElementById('com-auto-caixa').checked) {
                    await supabase.from('fluxo_caixa').insert([{
                        tipo_movimento: 'Saida',
                        categoria: 'Comissão Vendedor',
                        descricao: `Comissão Automática ID Colaborador: ${payload.colaborador_id}`,
                        valor: payload.valor_pagar
                    }]);
                }
                triggerSaveSuccess();
                closeModal('modal-comissao');
                if (typeof window.loadComissoes === 'function') window.loadComissoes();
            }
        });
    }

});"""
content = content.replace(bottom_target, bottom_replacement, 1)

with open(file_path, 'w', encoding='utf-16-le') as f:
    f.write(content)

print("done")
