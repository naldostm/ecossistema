const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const rawData = `PEX Monocamada (Água);Tubo PEX Monocamada 15mm (Rolo 50m);rolo;220,00;286,00
PEX Monocamada (Água);Tubo PEX Monocamada 22mm (Rolo 50m);rolo;380,00;494,00
PEX Monocamada (Água);Joelho 90 PEX 15mm (Deslizante);un;18,00;23,40
PEX Monocamada (Água);Joelho 90 PEX 22mm (Deslizante);un;25,00;32,50
PEX Monocamada (Água);Tê PEX 15mm (Deslizante);un;24,00;31,20
PEX Monocamada (Água);Tê PEX 22mm (Deslizante);un;35,00;45,50
PEX Monocamada (Água);Luva de Emenda PEX 15mm;un;15,00;19,50
PEX Monocamada (Água);Luva de Emenda PEX 22mm;un;22,00;28,60
PEX Multicamada (Gás);Tubo PEX Multicamada 16mm (Rolo 50m);rolo;350,00;455,00
PEX Multicamada (Gás);Tubo PEX Multicamada 20mm (Rolo 50m);rolo;480,00;624,00
PEX Multicamada (Gás);Joelho 90 PEX Gás 16mm (Prensado);un;28,00;36,40
PEX Multicamada (Gás);Tê PEX Gás 16mm (Prensado);un;38,00;49,40
PEX Multicamada (Gás);Luva de Transição PEX Gás 16mm x 1/2;un;32,00;41,60
PPR (Água Quente/Fria);Tubo PPR 22mm (Barra 3m);barra;35,00;45,50
PPR (Água Quente/Fria);Tubo PPR 25mm (Barra 3m);barra;48,00;62,40
PPR (Água Quente/Fria);Joelho 90 PPR 22mm;un;4,50;5,85
PPR (Água Quente/Fria);Joelho 90 PPR 25mm;un;6,00;7,80
PPR (Água Quente/Fria);Tê PPR 22mm;un;6,50;8,45
PPR (Água Quente/Fria);Luva de Transição PPR 22mm x 1/2 (Macho);un;22,00;28,60
PPR (Água Quente/Fria);Luva de Transição PPR 22mm x 1/2 (Fêmea);un;24,00;31,20
CPVC (Aquatherm);Tubo CPVC 22mm (Barra 3m);barra;38,00;49,40
CPVC (Aquatherm);Tubo CPVC 28mm (Barra 3m);barra;55,00;71,50
CPVC (Aquatherm);Joelho 90 CPVC 22mm;un;5,50;7,15
CPVC (Aquatherm);Joelho 45 CPVC 22mm;un;6,50;8,45
CPVC (Aquatherm);Tê CPVC 22mm;un;8,00;10,40
CPVC (Aquatherm);Luva de Transição CPVC 22mm x 1/2;un;18,00;23,40
PVC (Água Fria 20mm);Tubo PVC Marrom 20mm (Barra 3m);barra;12,00;15,60
PVC (Água Fria 20mm);Joelho 90 PVC 20mm;un;1,20;1,56
PVC (Água Fria 20mm);Joelho 45 PVC 20mm;un;1,50;1,95
PVC (Água Fria 20mm);Tê PVC 20mm;un;1,80;2,34
PVC (Água Fria 20mm);Luva PVC 20mm;un;1,00;1,30
PVC (Água Fria 20mm);Adaptador PVC Curto 20mm x 1/2;un;1,50;1,95
PVC (Água Fria 25mm);Tubo PVC Marrom 25mm (Barra 3m);barra;15,00;19,50
PVC (Água Fria 25mm);Joelho 90 PVC 25mm;un;1,50;1,95
PVC (Água Fria 25mm);Joelho 45 PVC 25mm;un;2,00;2,60
PVC (Água Fria 25mm);Tê PVC 25mm;un;2,50;3,25
PVC (Água Fria 25mm);Luva PVC 25mm;un;1,20;1,56
PVC (Água Fria 25mm);Luva de Correr PVC 25mm;un;9,00;11,70
PVC (Água Fria 25mm);Adaptador PVC Curto 25mm x 3/4;un;2,00;2,60
PVC (Água Fria 25mm);Registro de Esfera VS PVC 25mm;un;18,00;23,40
PVC (Água Fria 32mm);Tubo PVC Marrom 32mm (Barra 3m);barra;24,00;31,20
PVC (Água Fria 32mm);Joelho 90 PVC 32mm;un;3,00;3,90
PVC (Água Fria 32mm);Joelho 45 PVC 32mm;un;3,50;4,55
PVC (Água Fria 32mm);Tê PVC 32mm;un;4,50;5,85
PVC (Água Fria 32mm);Luva PVC 32mm;un;2,50;3,25
PVC (Água Fria 32mm);Bucha de Redução PVC 32mm x 25mm;un;2,00;2,60
PVC (Água Fria 32mm);Registro de Esfera VS PVC 32mm;un;28,00;36,40
PVC (Água Fria 40mm);Tubo PVC Marrom 40mm (Barra 3m);barra;35,00;45,50
PVC (Água Fria 40mm);Joelho 90 PVC 40mm;un;5,00;6,50
PVC (Água Fria 40mm);Joelho 45 PVC 40mm;un;6,00;7,80
PVC (Água Fria 40mm);Tê PVC 40mm;un;7,50;9,75
PVC (Água Fria 40mm);Luva PVC 40mm;un;4,00;5,20
PVC (Água Fria 40mm);Bucha de Redução PVC 40mm x 32mm;un;3,00;3,90
PVC (Água Fria 40mm);Registro de Esfera VS PVC 40mm;un;42,00;54,60
PVC (Esgoto 40mm);Tubo PVC Esgoto 40mm (Barra 3m);barra;20,00;26,00
PVC (Esgoto 40mm);Joelho 90 PVC Esgoto 40mm;un;2,50;3,25
PVC (Esgoto 40mm);Joelho 45 PVC Esgoto 40mm;un;3,00;3,90
PVC (Esgoto 40mm);Tê PVC Esgoto 40mm;un;4,50;5,85
PVC (Esgoto 40mm);Junção Y PVC Esgoto 40mm;un;6,00;7,80
PVC (Esgoto 40mm);Luva PVC Esgoto 40mm;un;2,50;3,25
PVC (Esgoto 50mm);Tubo PVC Esgoto 50mm (Barra 3m);barra;28,00;36,40
PVC (Esgoto 50mm);Joelho 90 PVC Esgoto 50mm;un;4,00;5,20
PVC (Esgoto 50mm);Joelho 45 PVC Esgoto 50mm;un;4,50;5,85
PVC (Esgoto 50mm);Tê PVC Esgoto 50mm;un;6,50;8,45
PVC (Esgoto 50mm);Junção Y PVC Esgoto 50mm;un;8,00;10,40
PVC (Esgoto 50mm);Luva PVC Esgoto 50mm;un;3,50;4,55
PVC (Esgoto 50mm);Bucha de Redução Esgoto 50mm x 40mm;un;3,00;3,90
PVC (Esgoto 75mm);Tubo PVC Esgoto 75mm (Barra 3m);barra;42,00;54,60
PVC (Esgoto 75mm);Joelho 90 PVC Esgoto 75mm;un;7,00;9,10
PVC (Esgoto 75mm);Joelho 45 PVC Esgoto 75mm;un;8,00;10,40
PVC (Esgoto 75mm);Curva Longa 90 PVC Esgoto 75mm;un;14,00;18,20
PVC (Esgoto 75mm);Tê PVC Esgoto 75mm;un;12,00;15,60
PVC (Esgoto 75mm);Junção Y PVC Esgoto 75mm;un;15,00;19,50
PVC (Esgoto 75mm);Bucha de Redução Esgoto 75mm x 50mm;un;6,00;7,80
PVC (Esgoto 100mm);Tubo PVC Esgoto 100mm (Barra 3m);barra;55,00;71,50
PVC (Esgoto 100mm);Joelho 90 PVC Esgoto 100mm;un;9,00;11,70
PVC (Esgoto 100mm);Joelho 45 PVC Esgoto 100mm;un;10,00;13,00
PVC (Esgoto 100mm);Curva Longa 90 PVC Esgoto 100mm;un;18,00;23,40
PVC (Esgoto 100mm);Tê PVC Esgoto 100mm;un;16,00;20,80
PVC (Esgoto 100mm);Junção Y PVC Esgoto 100mm;un;22,00;28,60
PVC (Esgoto 100mm);Bucha de Redução Esgoto 100mm x 50mm;un;8,00;10,40
PVC (Esgoto 100mm);Bucha de Redução Esgoto 100mm x 75mm;un;10,00;13,00
PVC (Caixas e Ralos);Caixa Sifonada 150x150x50mm;un;35,00;45,50
PVC (Caixas e Ralos);Caixa Sifonada 100x100x50mm;un;22,00;28,60
PVC (Caixas e Ralos);Ralo Seco 100x40mm;un;12,00;15,60
Conexões de Latão;Prolongador de Latão 1/2 (Curto - 10mm);un;8,00;10,40
Conexões de Latão;Prolongador de Latão 1/2 (Médio - 20mm);un;12,00;15,60
Conexões de Latão;Prolongador de Latão 1/2 (Longo - 30mm);un;18,00;23,40
Conexões de Latão;Bucha de Redução Latão 3/4 x 1/2;un;14,00;18,20
Conexões de Latão;Bucha de Redução Latão 1 x 3/4;un;22,00;28,60
Elétrica (Cabos Flexíveis);Cabo Flexível 1,5mm (Sil/Corfio);metro;1,40;1,82
Elétrica (Cabos Flexíveis);Cabo Flexível 2,5mm (Sil/Corfio);metro;2,10;2,73
Elétrica (Cabos Flexíveis);Cabo Flexível 4,0mm (Sil/Corfio);metro;3,40;4,42
Elétrica (Cabos Flexíveis);Cabo Flexível 6,0mm (Sil/Corfio);metro;5,10;6,63
Elétrica (Cabos Flexíveis);Cabo Flexível 10,0mm (Sil/Corfio);metro;8,50;11,05
Elétrica (Conectores);Conector Wago 221 (2 Vias);un;2,80;3,64
Elétrica (Conectores);Conector Wago 221 (3 Vias);un;3,50;4,55
Elétrica (Conectores);Conector Wago 221 (5 Vias);un;5,00;6,50
Elétrica (Conectores);Fita Isolante 3M Alta Performance (20m);un;12,00;15,60
Elétrica (Quadros QDC);Quadro de Distribuição Embutir Tigre/Amanco (12 a 16 DIN);un;90,00;117,00
Elétrica (Quadros QDC);Quadro de Distribuição Sobrepor Tigre/Amanco (12 a 16 DIN);un;95,00;123,50
Elétrica (Quadros QDC);Quadro de Distribuição Embutir Tigre/Amanco (24 DIN);un;140,00;182,00
Elétrica (Quadros QDC);Quadro de Distribuição Sobrepor Tigre/Amanco (24 DIN);un;150,00;195,00
Elétrica (Quadros QDC);Quadro de Distribuição Embutir Tigre/Amanco (36 DIN);un;220,00;286,00
Elétrica (Quadros QDC);Quadro de Distribuição Sobrepor Tigre/Amanco (36 DIN);un;235,00;305,50
Elétrica (Barramentos);Barramento Pente Monofásico DIN (1 metro);un;45,00;58,50
Elétrica (Barramentos);Barramento Pente Bifásico DIN (1 metro);un;85,00;110,50
Elétrica (Barramentos);Barramento Pente Trifásico DIN (1 metro);un;130,00;169,00
Elétrica (Barramentos);Barramento Neutro/Terra (10 a 12 Furos);un;25,00;32,50
Elétrica (Proteção - Disjuntores);Disjuntor DIN Monopolar 10A a 20A (Schneider/Steck);un;18,00;23,40
Elétrica (Proteção - Disjuntores);Disjuntor DIN Monopolar 25A a 32A (Schneider/Steck);un;20,00;26,00
Elétrica (Proteção - Disjuntores);Disjuntor DIN Monopolar 40A a 50A (Schneider/Steck);un;25,00;32,50
Elétrica (Proteção - Disjuntores);Disjuntor DIN Bipolar 16A a 32A (Schneider/Steck);un;45,00;58,50
Elétrica (Proteção - Disjuntores);Disjuntor DIN Bipolar 40A a 63A (Schneider/Steck);un;55,00;71,50
Elétrica (Proteção - IDR Bipolar);Interruptor IDR Bipolar 25A 30mA (Schneider/Steck);un;140,00;182,00
Elétrica (Proteção - IDR Bipolar);Interruptor IDR Bipolar 40A 30mA (Schneider/Steck);un;160,00;208,00
Elétrica (Proteção - IDR Bipolar);Interruptor IDR Bipolar 63A 30mA (Schneider/Steck);un;190,00;247,00
Elétrica (Proteção - IDR Tetrapolar);Interruptor IDR Tetrapolar 25A 30mA (Schneider/Steck);un;180,00;234,00
Elétrica (Proteção - IDR Tetrapolar);Interruptor IDR Tetrapolar 40A 30mA (Schneider/Steck);un;210,00;273,00
Elétrica (Proteção - IDR Tetrapolar);Interruptor IDR Tetrapolar 63A 30mA (Schneider/Steck);un;250,00;325,00
Elétrica (Proteção - IDR Tetrapolar);Interruptor IDR Tetrapolar 80A 30mA (Schneider/Steck);un;320,00;416,00
Elétrica (Proteção - DPS);DPS 175V 20kA (Clamper/Steck);un;45,00;58,50
Elétrica (Proteção - DPS);DPS 275V 20kA (Clamper/Steck);un;50,00;65,00
Elétrica (Proteção - DPS);DPS 275V 45kA (Clamper/Steck);un;65,00;84,50`;

const toInsert = rawData.split('\n').filter(l => l.trim()).map(line => {
    const [categoriaRaw, nome_material, unidade_medida, custoStr, vendaStr] = line.split(';');
    
    // Converter "Elétrica (Cabos Flexíveis)" para Categoria: "Elétrica", Subcategoria: "Cabos Flexíveis"
    let cat = categoriaRaw.trim();
    let subCat = "Geral";
    
    const match = cat.match(/(.+?)\s\((.+)\)/);
    if (match) {
        cat = match[1].trim();     // Elétrica
        subCat = match[2].trim();  // Cabos Flexíveis
    } else {
        // e.g., "Conexões de Latão" -> no parenthesis, use it as subCategory and "Geral" or "Hidráulica"?
        // It's mostly Hidráulica judging by the names "PVC", "PEX", "PPR". Let's just use the literal text.
        if (cat.includes('PEX') || cat.includes('PVC') || cat.includes('PPR')) {
             subCat = cat;
             cat = 'Hidráulica';
        } else if (cat.includes('Conexões')) {
             subCat = cat;
             cat = 'Hidráulica';
        }
    }
    
    const precoCompra = parseFloat(custoStr.replace(',', '.'));
    const valorUnitario = parseFloat(vendaStr.replace(',', '.'));
    
    // Como combinamos no formato Pipe
    const campo_uso_pipe = `${cat} | ${subCat}`;

    return {
        nome_material: nome_material.trim(),
        quantidade: 999, // default quantity per catalog
        unidade_medida: unidade_medida.trim(),
        preco_compra: precoCompra,
        valor_unitario: valorUnitario,
        campo_uso: campo_uso_pipe
    };
});

async function run() {
    console.log('Limpando dependencias (os_materiais_utilizados)...');
    
    // Hack para deletar contornando limites do PG
    const { data: mats } = await supabase.from('materiais').select('id');
    const ids = (mats || []).map(m => m.id);
    
    // Deleta em chunks da tabela relacional
    for (let i = 0; i < ids.length; i += 200) {
        let chunk = ids.slice(i, i + 200);
        await supabase.from('os_materiais_utilizados').delete().in('material_id', chunk);
    }

    console.log('Apagando tabela atual...');
    // Delete chunks (workaround for "delete must not be unconstrained")
    for (let i = 0; i < ids.length; i += 200) {
        let chunk = ids.slice(i, i + 200);
        await supabase.from('materiais').delete().in('id', chunk);
    }
    
    console.log('Inserindo nova tabela...', toInsert.length, 'itens');
    const { data, error } = await supabase.from('materiais').insert(toInsert);
    
    if (error) {
        console.error('ERRO:', error);
    } else {
        console.log('Tabela de materiais atualizada com sucesso!');
    }
}

run();
