const http = require('http');

function getGeoIp(ip) {
  return new Promise((resolve) => {
    http.get(`http://ip-api.com/json/${ip}`, (res) => {
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
  const ip = '2a05:d018:d40:d200:a8d4:cc41:291f:972e';
  console.log(`Querying GeoIP details for IP: ${ip}...`);
  const geo = await getGeoIp(ip);
  console.log("GeoIP Info:", JSON.stringify(geo, null, 2));
}

run();
