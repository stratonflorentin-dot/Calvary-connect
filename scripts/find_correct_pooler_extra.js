const { Client } = require('pg');

const projectRef = 'qaqonhjeqtlatqsrqcnx';
const password = 'Tony@5002';

const extraRegions = [
  'ap-northeast-3', 'eu-south-1', 'me-central-1', 'me-south-1', 
  'af-south-1', 'ap-east-1', 'ap-southeast-3', 'ap-southeast-4', 
  'eu-central-2', 'eu-south-2', 'il-central-1'
];

async function tryConnect(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`[SUCCESS] Connected to region: ${region} (${host})`);
    await client.end();
    return { region, success: true };
  } catch (err) {
    console.log(`[FAILED] Region ${region}: ${err.message}`);
    return { region, success: false, error: err.message };
  }
}

async function run() {
  console.log("Testing credentials across extra regions on port 6543...");
  const promises = extraRegions.map(r => tryConnect(r));
  const results = await Promise.all(promises);
  
  const successful = results.find(r => r.success);
  if (successful) {
    console.log(`\nFound the matching region: ${successful.region}`);
  } else {
    console.log("\nCould not connect to any extra region.");
  }
}

run();
