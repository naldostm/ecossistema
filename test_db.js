import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing anon query on servicos...');
  const { data, error } = await supabase.from('servicos').select('*');
  console.log('Data count:', data ? data.length : null);
  if (error) console.error('Error:', error.message);

  console.log('Testing anon query on parque_equipamentos...');
  const resEq = await supabase.from('parque_equipamentos').select('id');
  console.log('Parque count:', resEq.data ? resEq.data.length : null);
  if (resEq.error) console.error('Error Parque:', resEq.error.message);
}

testQuery();
