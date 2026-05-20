require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ status: 'active' })
    .in('status', ['invited', 'Invited', 'pending']);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Successfully updated pending users to active!");
  }
}

fix();
