const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qaqonhjeqtlatqsrqcnx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcW9uaGplcXRsYXRxc3JxY254Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA5NDEwMCwiZXhwIjoyMDg5NjcwMTAwfQ.msCOdHgRxIw7EGVQ_PVVqmhB7Q99NboJPe-f3AdqNEs';

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
