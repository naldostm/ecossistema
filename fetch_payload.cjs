const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching agent_memory...");
    // Let's get the most recent rows from agent_memory that might contain JSON with 'fileURL' or 'base64'
    const { data, error } = await supabase
        .from('agent_memory')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching:", error);
        return;
    }
    
    let found = false;
    for (const row of data) {
        if (row.content && row.content.includes('{')) {
            try {
                const parsed = JSON.parse(row.content);
                if (parsed.event || parsed.data || parsed.fileURL || (parsed.messageType && parsed.messageType.includes('audio'))) {
                    console.log("--- FOUND PAYLOAD ---");
                    console.log(JSON.stringify(parsed, null, 2));
                    found = true;
                    break;
                }
            } catch (e) {
                // not JSON
            }
        }
    }
    
    if (!found) {
        console.log("No detailed JSON payloads found in recent agent_memory. User needs to trigger one with ?rawlog=1");
    }
}
run();
