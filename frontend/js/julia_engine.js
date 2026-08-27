/**
 * JÚLIA JURÍDICA ENGINE (v1.0)
 * Responsável pela geração de minutas, contratos PMOC e análise de conformidade.
 * Integrado ao n8n Master Webhook.
 */

const JuliaEngine = {
    async gerarMinutaContrato(dados) {
        console.log('[Julia] Iniciando geração de minuta...', dados);
        triggerAutoSave('Júlia está redigindo os termos do contrato...');
        
        try {
            const prompt = `Gere uma minuta de contrato de manutenção ${dados.tipo} para o cliente ${dados.cliente_id}. 
            Vigência: ${dados.vigencia} meses. Valor: R$ ${dados.valor}. 
            Cláusulas extras: ${dados.clausulas || 'Nenhuma'}`;

            const res = await callAIWithTimeout('Julia', { 
                action: 'gerar_contrato',
                prompt: prompt,
                payload: dados
            });

            if (res.status === 'success') {
                triggerSaveSuccess('Minuta gerada com sucesso pela Júlia!');
                return res.data;
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            console.error('[Julia Error]', err);
            triggerSaveError('Júlia encontrou um erro jurídico. Verifique sua conexão.');
            return null;
        }
    },

    async gerarFolhaPMOC(contratoId) {
        console.log('[Julia] Preparando Folha PMOC para contrato:', contratoId);
        triggerAutoSave('Júlia está estruturando a Folha de Rosto do PMOC...');

        try {
            const { data: contrato } = await supabase.from('contratos_pmoc').select('*, clientes(*)').eq('id', contratoId).single();
            const { data: equipamentos } = await supabase.from('equipamentos').select('*').eq('contrato_id', contratoId);

            const payload = {
                action: 'gerar_folha_pmoc',
                contrato,
                parque_maquinas: equipamentos
            };

            const res = await callAIWithTimeout('Julia', { 
                prompt: `Gere a folha de rosto e cronograma PMOC para o contrato ${contratoId}`,
                payload: payload
            });

            if (res.status === 'success') {
                triggerSaveSuccess('Documentação PMOC pronta para exportação!');
                return res.data; // Markdown ou link do PDF geado no n8n
            }
        } catch (err) {
            triggerSaveError('Erro ao gerar Folha PMOC.');
            return null;
        }
    }
};

window.JuliaEngine = JuliaEngine;
