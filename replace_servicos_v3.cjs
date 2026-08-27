require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `Elétrica;Ponto Teto (Gesso/Laje);un;170,00
Elétrica;Ponto Parede (Alvenaria);un;230,00
Elétrica;Ponto Potência (Chuveiro/Ar);un;350,00
Elétrica;Rasgo Extra Alvenaria;metro;60,00
Elétrica;Ponto Alimentação Marcenaria;un;95,00
Elétrica;Ponto TV Sala (Completo);un;930,00
Elétrica;QDC Pequeno (Até 12 posições);un;600,00
Elétrica;QDC Médio (Até 24 posições);un;900,00
Elétrica;QDC Grande (Até 36 posições);un;1300,00
Elétrica;Disjuntor Avulso;un;60,00
Iluminação;Spot Embutir (Alinhamento);un;120,00
Iluminação;Spot Sobrepor (Laje);un;85,00
Iluminação;Arandela (Parede);un;170,00
Iluminação;Perfil LED Embutido;metro;93,00
Iluminação;Perfil LED Sobreposto;metro;80,00
Iluminação;Sanca Sala (Execução e adequação);un;650,00
Hidráulica Premium (PPR/PEX);Troca de Registro (com quebra);un;380,00
Hidráulica Premium (PPR/PEX);Ponto Novo / Deslocamento;un;380,00
Hidráulica Premium (PPR/PEX);Instalação Monocomando;un;750,00
Hidráulica Premium (PPR/PEX);Isolamento de Ponto (Decréscimo);un;180,00
Hidráulica Gás (PEX);Troca de Registro Gás;un;480,00
Hidráulica Gás (PEX);Ponto Novo / Deslocamento Gás;un;500,00
Hidráulica Gás (PEX);Teste de Estanqueidade (Ar);un;350,00
Hidráulica Básica (PVC/CPVC);Ponto Novo / Registro (CPVC);un;280,00
Hidráulica Básica (PVC/CPVC);Instalação Monocomando (CPVC);un;550,00
Hidráulica Básica (PVC/CPVC);Ponto Novo / Registro (PVC Fria);un;200,00
Ar-Condicionado;Infraestrutura Cobre (Até 3m);un;450,00
Ar-Condicionado;Metro Adicional de Infra;metro;90,00
Ar-Condicionado;Infra de Dreno PVC (Por Ponto);un;200,00
Ar-Condicionado;Instalação de Máquina (Infra Pronta);un;650,00
Ar-Condicionado;Limpeza/Higienização (1 Máq);un;250,00
Taxas e Visitas;Visita Técnica (Diagnóstico);un;150,00
Taxas e Visitas;Minivisita (Reparo Rápido até 40m);un;150,00`;

const items = rawData.split('\n').filter(Boolean).map(line => {
    const [categoria, nome_servico, unidade_medida, preco_str] = line.split(';');
    return {
        categoria: categoria.trim(),
        nome_servico: nome_servico.trim(),
        descricao: Cobrança por: ,
        valor_base: parseFloat(preco_str.replace(',', '.'))
    };
});

async function run() {
    try {
        console.log('Limpando dependencias (os_servicos_executados)...');
        await supabase.from('os_servicos_executados').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Apagando tabela atual...');
        // To delete all records while bypassing RLS, since we use anon key,
        // Wait, anon key might be blocked from bulk delete due to RLS!
        // We will try.
        const { error: delError } = await supabase.from('servicos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (delError) {
            console.error('Erro ao deletar:', delError);
            throw delError;
        }

        console.log('Inserindo nova tabela...');
        const { error: insError } = await supabase.from('servicos').insert(items);
        if (insError) {
            console.error('Erro ao inserir:', insError);
            throw insError;
        }

        console.log('Tabela atualizada com sucesso!');
    } catch (e) {
        console.error(e);
    }
}

run();
