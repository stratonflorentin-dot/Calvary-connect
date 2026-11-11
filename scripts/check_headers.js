const http = require('https');

const url = 'https://qaqonhjeqtlatqsrqcnx.supabase.co/rest/v1/';

http.get(url, {
  headers: {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
}, (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", JSON.stringify(res.headers, null, 2));
  
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("Body:", body);
  });
}).on('error', err => {
  console.error("Error:", err.message);
});
