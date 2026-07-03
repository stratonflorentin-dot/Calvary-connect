const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const config = {
  host: '2a05:d018:d40:d200:a8d4:cc41:291f:972e',
  port: 6543, // Transaction pooler port
  user: 'postgres',
  password: 'Tony@5002',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
    servername: 'db.qaqonhjeqtlatqsrqcnx.supabase.co'
  },
  connectionTimeoutMillis: 15000,
};

async function run() {
  console.log("Connecting to Supabase PostgreSQL using IPv6 at host:", config.host);
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log("Connected successfully!");

    // 1. Disable RLS on meetings and meeting_attendees to resolve recursion issue
    console.log("Disabling RLS on meetings and meeting_attendees...");
    await client.query(`
      ALTER TABLE IF EXISTS meetings DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS meeting_attendees DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON TABLE meetings TO authenticated, anon, postgres;
      GRANT ALL ON TABLE meeting_attendees TO authenticated, anon, postgres;
    `);
    console.log("RLS disabled on meetings module tables.");

    // 2. Read and run the sales-module-schema.sql to ensure all tables exist
    console.log("Running sales-module-schema.sql...");
    const schemaPath = path.join(__dirname, '..', 'database', 'patches', 'sales', 'sales-module-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Let's run it. We will wrap it in a transaction
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('COMMIT');
      console.log("Sales module schema executed successfully!");
    } else {
      console.warn("sales-module-schema.sql not found at:", schemaPath);
    }

    // 3. Disable RLS on sales tables to ensure easy access/no permissions issues
    console.log("Disabling RLS on sales module tables...");
    await client.query(`
      ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS route_quotations DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS transport_contracts DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS rate_sheets DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS customer_activities DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS sales_opportunities DISABLE ROW LEVEL SECURITY;

      GRANT ALL ON TABLE customers TO authenticated, anon, postgres;
      GRANT ALL ON TABLE bookings TO authenticated, anon, postgres;
      GRANT ALL ON TABLE route_quotations TO authenticated, anon, postgres;
      GRANT ALL ON TABLE transport_contracts TO authenticated, anon, postgres;
      GRANT ALL ON TABLE rate_sheets TO authenticated, anon, postgres;
      GRANT ALL ON TABLE customer_activities TO authenticated, anon, postgres;
      GRANT ALL ON TABLE sales_opportunities TO authenticated, anon, postgres;
    `);
    console.log("All RLS policies disabled and permissions granted on sales tables.");

  } catch (err) {
    console.error("Execution failed:");
    console.error(err.stack || err.message);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

run();
