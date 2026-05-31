const http = require('https');

function queryDoh(name, type) {
  return new Promise((resolve) => {
    http.get(`https://dns.google/resolve?name=${name}&type=${type}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Parse error' });
        }
      });
    }).on('error', err => {
      resolve({ error: err.message });
    });
  });
}

async function run() {
  const host = 'db.qaqonhjeqtlatqsrqcnx.supabase.co';
  console.log(`Resolving ${host} via Google DoH...`);
  
  const aRes = await queryDoh(host, 'A');
  const aaaaRes = await queryDoh(host, 'AAAA');
  const cnameRes = await queryDoh(host, 'CNAME');

  console.log('--- A Records ---');
  console.log(JSON.stringify(aRes, null, 2));
  
  console.log('--- AAAA Records ---');
  console.log(JSON.stringify(aaaaRes, null, 2));

  console.log('--- CNAME Records ---');
  console.log(JSON.stringify(cnameRes, null, 2));
}

run();
