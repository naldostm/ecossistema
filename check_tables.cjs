const fs = require('fs');
const testCjs = fs.readFileSync('c:/ecossistema arnaldo trentin/test.cjs', 'utf-8');
const urlMatch = testCjs.match(/const SUPABASE_URL = '(.*?)'/);
const keyMatch = testCjs.match(/const SUPABASE_ANON_KEY = '(.*?)'/);

if (urlMatch && keyMatch) {
    const url = urlMatch[1];
    const key = keyMatch[1];
    const headers = { apikey: key, Authorization: 'Bearer ' + key };

    async function check() {
        try {
            const s1 = await fetch(url + '/rest/v1/os_servicos?select=*&limit=1', { headers }).then(r => r.json());
            console.log('os_servicos:', s1);
            
            const s2 = await fetch(url + '/rest/v1/os_materiais?select=*&limit=1', { headers }).then(r => r.json());
            console.log('os_materiais:', s2);
        } catch(e) {
            console.error(e);
        }
    }
    check();
} else {
    console.log('Could not find keys');
}
