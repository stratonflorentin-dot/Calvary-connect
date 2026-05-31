const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, '..', 'patch-payroll-table.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

const config = {
  host: 'db.qaqonhjeqtlatqsrqcnx.supabase.co',
  port: 6543, // Transaction pooler port
  user: 'postgres',
  password: 'Tony@5002',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
};

async function run() {
  console.log("Connecting to Supabase PostgreSQL at:", config.host);
  
  // Try port 6543 first, fallback to 5432
  let client;
  try {
    client = new Client(config);
    await client.connect();
    console.log("Connected successfully using port 6543!");
  } catch (err) {
    console.warn("Failed connecting on port 6543, trying port 5432 (direct)...");
    config.port = 5432;
    try {
      client = new Client(config);
      await client.connect();
      console.log("Connected successfully using port 5432!");
    } catch (err2) {
      console.error("Database connection failed completely:");
      console.error(err2.message);
      process.exit(1);
    }
  }

  try {
    console.log("Executing SQL migration script...");
    const res = await client.query(sqlContent);
    console.log("Migration executed successfully!");
    
    // Print output of queries if available
    if (Array.isArray(res)) {
      for (const subRes of res) {
        if (subRes.rows && subRes.rows.length > 0) {
          console.log("Row output:", subRes.rows[0]);
        }
      }
    } else if (res.rows && res.rows.length > 0) {
      console.log("Row output:", res.rows[0]);
    }
  } catch (error) {
    console.error("SQL Error during migration:");
    console.error(error.message);
    console.error(error.detail || "No details available");
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();
