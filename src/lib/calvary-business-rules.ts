export const CALVARY_KNOWLEDGE = {
    companyInfo: {
        name: 'CALVARY INVESTMENT CO. LTD',
        reg: '151679986',
        tin: '151-679-986',
        address: 'P.O. Box 12929 Kinondoni Road Dar es Salaam',
        vehicleType: 'C28 trucks and trailers'
    },
    routes: [
        { destination: 'Kigali, Rwanda', rate20ft: 3100, rate40ft: 0, freeDays: 5, returnDays: 20, paymentAtLoading: false },
        { destination: 'Lusaka, Zambia', rate20ft: 4000, rate40ft: 0, freeDays: 5, returnDays: 30, paymentAtLoading: false },
        { destination: 'Solwezi, Zambia', rate20ft: 4800, rate40ft: 0, freeDays: 5, returnDays: 30, paymentAtLoading: false },
        { destination: 'Bujumbura, Burundi', rate20ft: 3200, rate40ft: 0, freeDays: 5, returnDays: 20, paymentAtLoading: false },
        { destination: 'Lilongwe, Malawi', rate20ft: 4000, rate40ft: 0, freeDays: 5, returnDays: 20, paymentAtLoading: false },
        { destination: 'Blantyre, Malawi', rate20ft: 4400, rate40ft: 0, freeDays: 5, returnDays: 20, paymentAtLoading: false },
        { destination: 'Kitwe, Zambia', rate20ft: 4000, rate40ft: 0, freeDays: 5, returnDays: 30, paymentAtLoading: false },
        { destination: 'Goma, DRC', rate20ft: 4400, rate40ft: 0, freeDays: 8, returnDays: 45, paymentAtLoading: true },
        { destination: 'Bukavu, DRC', rate20ft: 4800, rate40ft: 0, freeDays: 8, returnDays: 45, paymentAtLoading: true },
        { destination: 'Lubumbashi, DRC', rate20ft: 6400, rate40ft: 0, freeDays: 8, returnDays: 45, paymentAtLoading: true },
        { destination: 'Kolwezi, DRC', rate20ft: 7200, rate40ft: 0, freeDays: 8, returnDays: 45, paymentAtLoading: true },
        { destination: 'Likasi, DRC', rate20ft: 8500, rate40ft: 0, freeDays: 8, returnDays: 45, paymentAtLoading: true }
    ],
    operationalRules: {
        waitingCharge: 100,
        waitingChargeAfterDays: 3,
        lateDeliveryPenalty: 200,
        gpsUpdates: 'twice daily (AM & PM)',
        paymentTerms: '100% on delivery (DRC: payment at loading)',
        paymentCurrency: 'TZS',
        alcoholTest: 'mandatory before every journey',
        driverRequirements: 'Valid C28 licence + full PPE',
        rateConfirmation: 'Must be by email before loading'
    },
    paymentDocuments: {
        standard: ['POD', 'empty container interchange', 'Tax Invoice (EFD)'],
        drc: ['OCC', 'whiskey parking fees & receipts', 'IM4 entry', 'customs release order']
    }
};

export function getRateForDestination(destination: string, rateSheets: any[] = []) {
    if (Array.isArray(rateSheets) && rateSheets.length > 0) {
        // search active rate sheets for a matching route
        for (const sheet of rateSheets) {
            const rates = Array.isArray(sheet.rates) ? sheet.rates : [];
            const found = rates.find((r: any) => (r.destination || '').toLowerCase() === destination.toLowerCase());
            if (found) return found;
        }
    }

    // fallback to static knowledge
    const route = CALVARY_KNOWLEDGE.routes.find(r => r.destination.toLowerCase() === destination.toLowerCase());
    if (!route) return null;
    return { from: 'Dar Port', destination: route.destination, container_20ft: route.rate20ft, container_40ft: route.rate40ft };
}

export default CALVARY_KNOWLEDGE;
