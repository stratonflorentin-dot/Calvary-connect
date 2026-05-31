const dns = require('dns');

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
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.co',
    'aws-0-us-east-1.pooler.supabase.net'
  ];
  
  for (const h of hosts) {
    const res = await check(h);
    console.log(`Lookup ${h}:`, res.success ? `SUCCESS (${res.addresses[0].address})` : `FAILED (${res.error})`);
  }
}

run();
