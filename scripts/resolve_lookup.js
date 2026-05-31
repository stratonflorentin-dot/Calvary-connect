const dns = require('dns');

const host = 'db.qaqonhjeqtlatqsrqcnx.supabase.co';

function lookupFamily(family) {
  return new Promise((resolve) => {
    dns.lookup(host, { all: true, family }, (err, addresses) => {
      if (err) {
        resolve({ family, success: false, error: err.message });
      } else {
        resolve({ family, success: true, addresses });
      }
    });
  });
}

async function run() {
  console.log(`Performing OS resolution lookup for: ${host}`);
  const res4 = await lookupFamily(4);
  const res6 = await lookupFamily(6);
  
  console.log("IPv4 Lookup:", JSON.stringify(res4, null, 2));
  console.log("IPv6 Lookup:", JSON.stringify(res6, null, 2));
}

run();
