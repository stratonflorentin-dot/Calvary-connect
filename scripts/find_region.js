const dns = require('dns');

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-central-1', 'sa-east-1', 'me-central-1', 'af-south-1'
];

async function checkHost(host) {
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
  console.log("Checking direct host...");
  const direct = await checkHost('db.qaqonhjeqtlatqsrqcnx.supabase.co');
  console.log("Direct host resolution:", direct);

  console.log("\nChecking pooler regions...");
  const promises = regions.map(r => checkHost(`aws-0-${r}.pooler.supabase.com`));
  const results = await Promise.all(promises);

  const successful = results.filter(r => r.success);
  console.log(`\nFound ${successful.length} active pooler region(s):`);
  successful.forEach(s => {
    console.log(`- ${s.host} (IPs: ${s.addresses.map(a => a.address).join(', ')})`);
  });
}

run();
