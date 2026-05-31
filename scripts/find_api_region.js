const dns = require('dns');
const http = require('https');

async function lookupDns(host) {
  return new Promise((resolve) => {
    dns.resolve(host, 'ANY', (err, records) => {
      if (err) {
        dns.lookup(host, { all: true }, (err2, addresses) => {
          if (err2) {
            resolve({ host, success: false, error: err2.message });
          } else {
            resolve({ host, success: true, type: 'lookup', addresses });
          }
        });
      } else {
        resolve({ host, success: true, type: 'resolve', records });
      }
    });
  });
}

function getGeoIp(ip) {
  return new Promise((resolve) => {
    http.get(`https://ipapi.co/${ip}/json/`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed to parse GeoIP JSON' });
        }
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function run() {
  const host = 'qaqonhjeqtlatqsrqcnx.supabase.co';
  console.log("Performing DNS lookup for:", host);
  const dnsRes = await lookupDns(host);
  console.log("DNS Result:", JSON.stringify(dnsRes, null, 2));

  let ip = null;
  if (dnsRes.success) {
    if (dnsRes.addresses && dnsRes.addresses.length > 0) {
      ip = dnsRes.addresses[0].address;
    } else if (dnsRes.records && dnsRes.records.length > 0) {
      // Find an A record IP
      const aRecord = dnsRes.records.find(r => r.type === 'A' || r.address);
      if (aRecord) ip = aRecord.address;
    }
  }

  if (ip) {
    console.log(`\nQuerying GeoIP details for IP: ${ip}...`);
    const geo = await getGeoIp(ip);
    console.log("GeoIP Info:", JSON.stringify(geo, null, 2));
  } else {
    console.log("\nCould not retrieve an IP address for geographic lookup.");
  }
}

run();
