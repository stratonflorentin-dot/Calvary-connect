#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Fleet Management System - Production Deployment');
console.log('=====================================');

// Check if .env.local exists and has real Supabase credentials
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ ERROR: .env.local file not found!');
    console.log('Please create .env.local with your Supabase credentials:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
if (envContent.includes('your-supabase-url-here') || envContent.includes('demo-key')) {
    console.error('❌ ERROR: Please update .env.local with real Supabase credentials!');
    console.log('See DEPLOYMENT-GUIDE.md for instructions');
    process.exit(1);
}

console.log('✅ Environment configuration found');

// Install dependencies
console.log('📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
}

// Build application
console.log('🔨 Building application...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully');
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

// Start production server
console.log('🌐 Starting production server...');
console.log('📋 Your Fleet Management System will be available at:');
console.log('   http://localhost:9002');
console.log('');
console.log('🔐 Login Credentials:');
console.log('   Email: stratonflorentin@gmail.com');
console.log('   Password: Tony@5002');
console.log('');
console.log('🎉 Ready for production use!');

try {
    execSync('npm start', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
}
