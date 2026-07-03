const http = require('https');

const url = 'https://qaqonhjeqtlatqsrqcnx.supabase.co/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcW9uaGplcXRsYXRxc3JxY254Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA5NDEwMCwiZXhwIjoyMDg5NjcwMTAwfQ.msCOdHgRxIw7EGVQ_PVVqmhB7Q99NboJPe-f3AdqNEs';

const options = {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
};

http.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      console.log("Response JSON:", spec);
      console.log("Keys in OpenAPI spec:", Object.keys(spec));
      if (spec.paths) {
        const rpcPaths = Object.keys(spec.paths).filter(p => p.startsWith('/rpc/'));
        console.log("Available RPC endpoints:");
        rpcPaths.forEach(p => {
          console.log(`- ${p}`);
          const pathInfo = spec.paths[p];
          if (pathInfo.post && pathInfo.post.parameters) {
            console.log("  Parameters:", JSON.stringify(pathInfo.post.parameters, null, 2));
          }
        });
      }
    } catch (e) {
      console.error("Failed to parse OpenAPI JSON:", e.message);
      console.log("Raw Response size:", data.length);
      console.log(data.slice(0, 1000));
    }
  });
}).on('error', err => {
  console.error("Error fetching OpenAPI:", err.message);
});
