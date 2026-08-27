require('dotenv').config({ path: 'v5/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!sbUrl || !sbKey) {
  console.log("No Supabase URL or KEY found!");
  process.exit(1);
}
const supabase = createClient(sbUrl, sbKey);

async function run() {
   console.log("Adding column responsavel...");
   const { data, error } = await supabase.rpc('exec_sql', { query: 'ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS responsavel text;' });
   if (error) {
       console.log("RPC exec_sql not found or failed. Trying a different approach.");
       
       // Alternatively, since we can't easily alter table without RPC, I can just REMOVE it from the select query in JS so the system stops crashing.
       // The user requested the column, but if we can't create it, we can't create it programmatically without psql.
       console.log(error.message);
   } else {
       console.log("Column added or RPC successful");
   }
}

run();
