const fs = require('fs');
const appJs = fs.readFileSync('frontend/js/app.js', 'utf8');
const urlMatch = appJs.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
const keyMatch = appJs.match(/const supabaseKey = ['"]([^'"]+)['"]/);
if (!urlMatch || !keyMatch) { console.log('Env not found'); process.exit(1); }

// we can just fetch via native fetch rather than npm package if not installed
const url = urlMatch[1] + '/rest/v1/ordens_servico';
const key = keyMatch[1];
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function check() {
    console.log("Testing insert...");
    try {
        const payload = { 
            servico_tipo: 'SYSTEM_TEST_DELETE', 
            status_ia: 'Aberto', 
            prioridade: 'BAIXA',
            tecnico_id: null,
            mecanico_responsavel: null
        };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await res.text();
        console.log("Status:", res.status);
        if(!res.ok) console.error("Error:", text);
        else {
            console.log("Success:", JSON.parse(text)[0]);
            // delete
            await fetch(url + '?servico_tipo=eq.SYSTEM_TEST_DELETE', { method: 'DELETE', headers });
        }
    } catch(e) {
        console.error("Crash:", e.message);
    }
}
check();
