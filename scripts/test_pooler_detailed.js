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
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    await client.connect();
    console.log(`[SUCCESS] Region: ${region}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`[FAILED] Region ${region}: code=${err.code}, message="${err.message}"`);
    return false;
  }
}

async function run() {
  console.log("Starting connections...");
  for (const r of regions) {
    const ok = await tryConnect(r);
    if (ok) {
      console.log(`FOUND! Region is ${r}`);
      break;
    }
  }
  console.log("Done.");
}

run();
