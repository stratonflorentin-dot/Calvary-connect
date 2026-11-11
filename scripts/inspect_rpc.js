const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function tryCall(rpcName, params) {
  try {
    const { data, error } = await supabase.rpc(rpcName, params);
    return { success: !error, data, error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function run() {
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql', 'sql', 'execute_query', 'run_query'];
  const testParams = [
    {},
    { sql: 'SELECT 1 as test' },
    { query: 'SELECT 1 as test' },
    { query_text: 'SELECT 1 as test' },
    { sql_text: 'SELECT 1 as test' },
    { sql_query: 'SELECT 1 as test' }
  ];

  for (const rpc of rpcs) {
    console.log(`\n--- Testing RPC: ${rpc} ---`);
    for (const p of testParams) {
      const res = await tryCall(rpc, p);
      if (res.success || (res.error && !res.error.message.includes('does not exist') && !res.error.message.includes('schema cache'))) {
        console.log(`  Params: ${JSON.stringify(p)} -> SUCCESS/OTHER ERROR`);
        console.log(`  Data:`, res.data);
        console.log(`  Error:`, res.error);
      }
    }
  }
}

run();
