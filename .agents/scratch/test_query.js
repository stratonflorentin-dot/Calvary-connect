const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function run() {
  console.log('Connecting to Supabase:', supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('\n--- Attempting Sign In with stratonflorentin@gmail.com ---');
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'stratonflorentin@gmail.com',
      password: 'Tony@5002'
    });

    if (authError) {
      console.error('Sign in failed:', authError.message);
      return;
    }

    console.log('Sign in successful! User ID:', authData.user.id);

    // Now query as authenticated user
    console.log('\n--- Querying user_profiles as authenticated user ---');
    const { data: users, error: queryError } = await supabase
      .from('user_profiles')
      .select('*');

    if (queryError) {
      console.error('Authenticated query failed:', queryError.message, queryError.details);
    } else {
      console.log('Authenticated query returned', users.length, 'rows');
      users.forEach(u => {
        console.log(`- ${u.name} (${u.email}) : ${u.role}`);
      });
    }

  } catch (e) {
    console.error('Exception:', e);
  }
}

run();
