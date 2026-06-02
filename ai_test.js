(async () => {
    try {
        const url = 'http://localhost:3000/api/ai/ask-company';
        const payload = {
            message: "Analyze the company's cost breakdown and propose the top 3 cost-reduction actions with estimated monthly savings. Keep answer concise (<=120 words). Use live metrics and DB context on the server.",
            history: [],
            liveMetrics: {
                fleetSize: 12,
                monthlyTrips: 420,
                avgRate: 32.5,
                monthlyFuelCost: 12000,
                monthlyMaintenanceCost: 4500,
                monthlyPayroll: 30000
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            // no redirect, short timeout handled by node if needed
        });

        const text = await res.text();
        console.log('STATUS', res.status);
        console.log('RESPONSE', text);
    } catch (err) {
        console.error('ERROR', err && err.message ? err.message : err);
        process.exit(1);
    }
})();
