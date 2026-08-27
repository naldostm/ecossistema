require('dotenv').config({ path: 'v5/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if(!sbUrl || !sbKey) {
  console.log("No Supabase URL or KEY found!");
  process.exit(1);
}
const supabase = createClient(sbUrl, sbKey);

async function test() {
   console.log("Fetching an OS...");
   const { data: oslist, error: err1 } = await supabase.from('ordens_servico').select('id_os').limit(1);
   if (err1) { console.error("Error fetching OS:", err1); return; }
   if (!oslist.length) { console.log("No OS found"); return; }
   
   const os_id = oslist[0].id_os;
   console.log("Using OS ID:", os_id);
   
   const { data: svcList } = await supabase.from('servicos').select('id').limit(1);
   const servico_id = svcList && svcList.length ? svcList[0].id : null;
   
   if (!servico_id) { console.log("No servico found"); return; }
   
   console.log("Inserting into os_servicos_executados...");
   const payload = {
       os_id: os_id,
       servico_id: servico_id,
       quantidade: 1.0,
       subtotal_cobrado: 15.0
   };
   
   const { data, error } = await supabase.from('os_servicos_executados').insert(payload).select();
   if (error) {
       console.error("❌ INSERT FAILED:", error);
   } else {
       console.log("✅ INSERT SUCCESS:", data);
   }
   
   console.log("Inserting into os_materiais_utilizados...");
   const { data: matList } = await supabase.from('materiais').select('id').limit(1);
   const material_id = matList && matList.length ? matList[0].id : null;
   if(material_id) {
       const matPayload = {
           os_id: os_id,
           material_id: material_id,
           quantidade_usada: 2,
           valor_unitario_cobrado: 10,
           subtotal_material: 20
       };
       const { data: data2, error: err2 } = await supabase.from('os_materiais_utilizados').insert(matPayload).select();
       if(err2) console.error("❌ INSERT MAT FAILED:", err2);
       else console.log("✅ INSERT MAT SUCCESS:", data2);
   }
}

test();
