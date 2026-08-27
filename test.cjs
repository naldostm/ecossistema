const fs = require('fs');

async function test() {
    try {
        const appJs = fs.readFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', 'utf8');
        const urlMatch = appJs.match(/const SUPABASE_URL = ['"]([^'"]+)['"]/);
        const keyMatch = appJs.match(/const SUPABASE_ANON_KEY = ['"]([^'"]+)['"]/);

        const url = urlMatch[1] + '/rest/v1/ordens_servico?select=id_os,servico_tipo,status_ia,status_pagamento,cliente_id,obra_id,data_hora,tecnico_id,mecanico_responsavel,clientes(nome_cliente),obras(nome_obra)&limit=1';
        const key = keyMatch[1];
        const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };

        const res = await fetch(url, { headers });
        const text = await res.text();
        fs.writeFileSync('c:/ecossistema arnaldo trentin/debug_out.txt', "Status: " + res.status + "\nBody: " + text);
    } catch(e) {
        fs.writeFileSync('c:/ecossistema arnaldo trentin/debug_out.txt', "Error: " + e.message);
    }
}
test();
