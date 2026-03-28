#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Fleet Management System - Complete Setup Assistant');
console.log('==================================================');
console.log('');

// Step 1: Check if we have setup files
const setupFiles = [
    'complete-existing-setup.sql',
    'ready-to-copy.sql',
    'QUICK-SETUP.md',
    'DEPLOYMENT-GUIDE.md'
];

console.log('📋 Checking setup files...');
setupFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
    }
});

console.log('');
console.log('🔐 Step 2: Environment Setup');
console.log('=============================');

// Create .env.local template if it doesn't exist
const envPath = '.env.local';
if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env.local template...');
    const envTemplate = `# Supabase Configuration
# Get these from your Supabase project: https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Instructions:
# 1. Replace the values above with your real Supabase credentials
# 2. Save this file
# 3. Run: npm run dev
# 4. Open: http://localhost:9002
# 5. Login with: stratonflorentin@gmail.com / Tony@5002
`;
    
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ .env.local created - Please add your Supabase credentials');
} else {
    console.log('✅ .env.local already exists');
}

console.log('');
console.log('🗃️ Step 3: Database Setup');
console.log('==========================');

console.log('📊 You have 2 options for database setup:');
console.log('');
console.log('Option A: Quick Setup');
console.log('  1. Go to your Supabase project');
console.log('  2. Open SQL Editor');
console.log('  3. Copy contents of: ready-to-copy.sql');
console.log('  4. Paste and run');
console.log('');
console.log('Option B: Complete Setup');
console.log('  1. Use: complete-existing-setup.sql');
console.log('  2. Already has sample data included');
console.log('');

console.log('📝 Step 4: What to do next');
console.log('=============================');
console.log('');
console.log('1. Get Supabase Credentials:');
console.log('   - Go to https://supabase.com');
console.log('   - Create new project or use existing');
console.log('   - Get URL and Anon Key from Settings > API');
console.log('');
console.log('2. Update .env.local:');
console.log('   - Add your real NEXT_PUBLIC_SUPABASE_URL');
console.log('   - Add your real NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('');
console.log('3. Setup Database:');
console.log('   - Use ready-to-copy.sql in Supabase SQL Editor');
console.log('   - OR use complete-existing-setup.sql for sample data');
console.log('');
console.log('4. Start Application:');
console.log('   - npm run dev (development)');
console.log('   - npm run deploy (production)');
console.log('');
console.log('5. Access System:');
console.log('   - http://localhost:9002');
console.log('   - Login: stratonflorentin@gmail.com');
console.log('   - Password: Tony@5002');
console.log('');

console.log('🎯 Ready to launch your Fleet Management System!');
console.log('==============================================');

// Check if .env.local has real credentials
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('your-supabase-url-here')) {
        console.log('⚠️  ACTION NEEDED: Please update .env.local with real Supabase credentials');
    } else {
        console.log('✅ Supabase credentials configured');
    }
}

console.log('');
console.log('📚 Documentation available:');
console.log('   - DEPLOYMENT-GUIDE.md - Full deployment guide');
console.log('   - QUICK-SETUP.md - Quick setup instructions');
console.log('');
