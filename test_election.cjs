const { createClient } = require('@supabase/supabase-js');

const url = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';
const supabase = createClient(url, key);

async function check() {
    const fifteenSecondsAgo = new Date(Date.now() - 15000000000).toISOString();
    const { data: leaderElection, error } = await supabase.from('agent_memory')
          .select('id, created_at')
          .eq('phone', '5511994710667')
          .eq('content', 'Mensagem do Cliente (Lucis): Arnaldo')
          .gte('created_at', fifteenSecondsAgo)
          .order('created_at', { ascending: true }) // O mais antigo ganha a eleição
          .limit(1)
          .single();

    console.log("LEADER:", leaderElection);
    console.log("ERROR:", error);
}
check();
