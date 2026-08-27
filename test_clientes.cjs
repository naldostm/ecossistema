const url = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';
const headers = { apikey: key, Authorization: 'Bearer ' + key };

async function check() {
    try {
        const req = await fetch(url + '/rest/v1/clientes?select=*&limit=1', { headers });
        const data = await req.json();
        console.log("COLUMNS:", Object.keys(data[0]));
    } catch(e) {
        console.error(e);
    }
}
check();
