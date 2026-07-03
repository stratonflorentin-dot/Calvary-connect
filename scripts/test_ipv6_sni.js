const { Client } = require('pg');

const config = {
  host: '2a05:d018:d40:d200:a8d4:cc41:291f:972e',
  port: 6543,
  user: 'postgres',
  password: 'Tony@5002',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
    servername: 'db.qaqonhjeqtlatqsrqcnx.supabase.co'
  },
  connectionTimeoutMillis: 10000,
};

async function run() {
  console.log("Connecting using IPv6 address and SNI servername...");
  const client = new Client(config);
  try {
    await client.connect();
    console.log("SUCCESSFULLY CONNECTED!");
    const res = await client.query("SELECT 1 as test");
    console.log("Query result:", res.rows);
  } catch (err) {
    console.error("Connection failed:", err.message);
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
