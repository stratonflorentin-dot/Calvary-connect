const dns = require('dns');

const host = 'db.qaqonhjeqtlatqsrqcnx.supabase.co';

function resolveRecord(host, type) {
  return new Promise((resolve) => {
    dns.resolve(host, type, (err, records) => {
      if (err) {
        resolve({ type, success: false, error: err.message });
      } else {
        resolve({ type, success: true, records });
      }
    });
  });
}

async function run() {
  console.log(`Resolving DNS records for ${host}...`);
  const types = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT', 'SRV'];
  const promises = types.map(t => resolveRecord(host, t));
  const results = await Promise.all(promises);
  
  results.forEach(r => {
    if (r.success) {
      console.log(`[${r.type}]:`, JSON.stringify(r.records, null, 2));
    } else {
      console.log(`[${r.type}]: Failed (${r.error})`);
    }
  });
}

run();
