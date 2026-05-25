const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueries() {
  console.log("Running diagnostics on table structures and relationships...");

  // Query 5: Bank Accounts with transactions relationship
  console.log("\n--- Query 5: Bank Accounts with transactions relation ---");
  const { data: q5, error: e5 } = await supabase
    .from("bank_accounts")
    .select("*, transactions:bank_statements(*)");
  if (e5) console.error("Error Q5:", e5.message, e5.details, e5.hint, e5.code);
  else console.log("Q5 Success:", q5);

  // Check columns of 'trips' table
  console.log("\n--- Query 6: Columns of trips table ---");
  const { data: q6, error: e6 } = await supabase
    .rpc('get_table_columns', { table_name: 'trips' }); // Might not exist, let's try direct query or just fetching one row
  
  if (e6) {
    // Fallback: Fetch a single row or try another way
    const { data: row, error: eRow } = await supabase.from('trips').select('*').limit(1);
    if (eRow) {
      console.error("Error fetching trips row:", eRow.message);
    } else {
      console.log("trips table columns/keys:", row.length > 0 ? Object.keys(row[0]) : "No rows in trips table to inspect");
    }
  } else {
    console.log("trips table columns:", q6);
  }

  // Also let's check one row from vehicles just in case
  const { data: vRow } = await supabase.from('vehicles').select('*').limit(1);
  console.log("vehicles columns:", vRow && vRow.length > 0 ? Object.keys(vRow[0]) : "No rows");
}

testQueries();
