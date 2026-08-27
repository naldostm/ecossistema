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
            const role = (window.userCargo || 'visitante').toLowerCase();
            const isAdmin = ['admin', 'administrador', 'diretoria', 'engenheiro', 'master', 'dono', 'arnaldo'].some(c => role.includes(c));
            if (!isAdmin) {
                alert('Acesso Negado: Apenas administradores podem promover ou alterar registro de colaboradores.');
                return;
            }
            document.getElementById('edit-colab-id').value = item.id;
            document.getElementById('edit-colab-nome').value = item.nome_completo;
            document.getElementById('edit-colab-email').value = item.email || '';
            document.getElementById('edit-colab-tel').value = item.telefone_whatsapp || '';
            document.getElementById('edit-colab-cargo').value = item.cargo || 'visitante';
        }

        openModal(modalId, true);
    };