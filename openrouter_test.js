const fs = require('fs');
(async () => {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const m = env.split(/\r?\n/).find(l => l.startsWith('OPENROUTER_API_KEY='));
        const key = m ? m.split('=')[1].trim() : '';
        if (!key) { console.error('NO_KEY'); process.exit(2); }
        const body = { model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'ping' }], max_tokens: 10 };
        const endpoints = [
            'https://openrouter.ai/v1/chat/completions',
            'https://api.openrouter.ai/v1/chat/completions'
        ];
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify(body),
                });
                console.log('TRIED', url, 'STATUS', res.status);
                const text = await res.text();
                if (!res.ok) {
                    console.warn('Non-OK, continuing to next endpoint');
                    console.log('BODY_START', text.slice(0, 500));
                    continue;
                }
                console.log('BODY_START', text.slice(0, 2000));
                return;
            } catch (e) {
                console.error('ERR ON', url, e && e.message ? e.message : e);
            }
        }
    } catch (err) {
        console.error('ERR', err && err.message ? err.message : err);
        process.exit(1);
    }
})();
