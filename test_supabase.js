import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tmpwmtpdxcvulglkahcg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcHdtdHBkeGN2dWxnbGthaGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTg0MDMsImV4cCI6MjA4OTYzNDQwM30.GRcj8PoXCMcWPEN5maZYD3kxndqpWfcegryLYANgggE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('clientes').select('count', { count: 'exact', head: true })
  if (error) {
    console.error('Connection Error:', error.message)
    process.exit(1)
  } else {
    console.log('Connection Successful! Count:', data)
    process.exit(0)
  }
}

test()
