const http = require('https');

const url = 'https://qaqonhjeqtlatqsrqcnx.supabase.co/rest/v1/';

http.get(url, {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcW9uaGplcXRsYXRxc3JxY254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTQxMDAsImV4cCI6MjA4OTY3MDEwMH0.xQmnJmGyZK-yTMS2MYIzerxzpYikipnhbEq-sXoP8jE'
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
