const { Client } = require('pg');

const ipv6 = '2a05:d018:135e:16b8:fb16:4f73:eaf0:22f7';
const password = 'Tony@5002';

async function run() {
  console.log(`Connecting directly to IPv6 address: [${ipv6}] on port 5432...`);
  const client = new Client({
    host: ipv6,
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("[SUCCESS] Connected directly to database!");
    const res = await client.query('SELECT 1 as test');
    console.log("Query test output:", res.rows);
    await client.end();
  } catch (err) {
    console.error("[FAILED] Connection failed:", err.message);
  }
}

run();
