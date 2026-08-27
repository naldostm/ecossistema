import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
  const { data, error } = await supabase.from('ferramentas').select('*').limit(1);
  if (data) {
     console.log('Columns in ferramentas:', data.length > 0 ? Object.keys(data[0]) : 'no data to check, fetching via rpc...');
  }
}
checkCols();
