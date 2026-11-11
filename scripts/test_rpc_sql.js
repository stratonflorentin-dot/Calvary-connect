const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const commonSqlRpcs = [
  'exec_sql',
  'run_sql',
  'execute_sql',
  'sql',
  'execute_query',
  'run_query'
];

async function testRpc(rpcName) {
  try {
    const { data, error } = await supabase.rpc(rpcName, { sql: 'SELECT 1 as test' });
    if (error && error.message.includes('does not exist')) {
      return { rpcName, exists: false };
    }
    return { rpcName, exists: true, data, error };
  } catch (err) {
    return { rpcName, exists: false, error: err.message };
  }
}

async function run() {
  console.log("Checking for SQL execution RPCs on Supabase...");
  for (const rpc of commonSqlRpcs) {
    const res = await testRpc(rpc);
    if (res.exists) {
      console.log(`[FOUND] RPC '${rpc}' exists! Data:`, res.data, "Error:", res.error);
    } else {
      console.log(`[NOT FOUND] RPC '${rpc}' does not exist.`);
    }
  }
}

run();
