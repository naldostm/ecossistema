const url = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';
const headers = { apikey: key, Authorization: 'Bearer ' + key };

async function check() {
    try {
        const mems = await fetch(url + '/rest/v1/agent_memory?select=*&order=created_at.desc&limit=20', { headers }).then(r => r.json());
        require('fs').writeFileSync('memory_out.json', JSON.stringify(mems, null, 2));
    } catch(e) {
        console.error(e);
    }
}
check();
