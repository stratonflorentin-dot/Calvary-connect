const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  console.log('Connecting to Supabase:', supabaseUrl);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n--- Listing Auth Users (auth.users) ---');
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error('Error listing auth users:', error.message);
    } else {
      console.log(`Found ${users.length} auth users:`);
      users.forEach(u => {
        console.log(`- ID: ${u.id}, Email: ${u.email}, Metadata Role: ${u.user_metadata?.role}, Created: ${u.created_at}`);
      });
    }
  } catch (e) {
    console.error('Exception:', e);
  }
}

run();
