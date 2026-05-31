const dns = require('dns');

const projectRef = 'qaqonhjeqtlatqsrqcnx';

function check(host) {
  return new Promise((resolve) => {
    dns.lookup(host, { all: true }, (err, addresses) => {
      if (err) {
        resolve({ host, success: false, error: err.message });
      } else {
        resolve({ host, success: true, addresses });
      }
    });
  });
}

async function run() {
  const hosts = [
    `db.${projectRef}.supabase.co`,
    `db.${projectRef}.supabase.net`,
    `db.${projectRef}.supabase.com`,
    `db.${projectRef}.supabase.io`
  ];
  
  for (const h of hosts) {
    const res = await check(h);
    console.log(`Lookup ${h}:`, res.success ? `SUCCESS (${res.addresses.map(a => a.address).join(', ')})` : `FAILED (${res.error})`);
  }
}

run();
