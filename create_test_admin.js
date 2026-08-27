import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmpwmtpdxcvulglkahcg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log('Criando admin test...');
  // 1. Create auth user
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: 'admin_test@arnaldotrentin.com.br',
    password: 'Password123!'
  });
  
  if (authErr) {
    console.log('Signup error (might already exist):', authErr.message);
  }
  
  // Try login to get the id
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin_test@arnaldotrentin.com.br',
    password: 'Password123!'
  });
  
  if (loginErr) {
      console.error('Login Error:', loginErr.message);
      return;
  }
  
  const userId = loginData.user.id;
  console.log('User ID:', userId);
  
  // 2. Insert into colaboradores
  const { error: insertErr } = await supabase.from('colaboradores').upsert({
    id: userId,
    nome_completo: 'Admin Test AI',
    cargo: 'admin'
  });
  
  if (insertErr) {
    console.error('Insert colab error:', insertErr.message);
  } else {
    console.log('Colaborador Admin criado com sucesso!');
  }
}

createAdmin();
