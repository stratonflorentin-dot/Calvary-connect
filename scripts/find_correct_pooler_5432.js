const { Client } = require('pg');

const projectRef = 'qaqonhjeqtlatqsrqcnx';
const password = 'Tony@5002';

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-central-1', 'sa-east-1'
];

async function tryConnect(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 5432, // Session Mode Port
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`[SUCCESS] Connected to region: ${region} (${host}) on port 5432`);
    await client.end();
    return { region, success: true };
  } catch (err) {
    console.log(`[FAILED] Region ${region}: ${err.message}`);
    return { region, success: false, error: err.message };
  }
}

async function run() {
  console.log("Testing credentials across regions on port 5432...");
  const promises = regions.map(r => tryConnect(r));
  const results = await Promise.all(promises);
  
  const successful = results.find(r => r.success);
  if (successful) {
    console.log(`\nFound the matching region: ${successful.region}`);
  } else {
    console.log("\nCould not connect to any region on port 5432.");
  }
}

run();
