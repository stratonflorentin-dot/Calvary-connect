'use server';
/**
 * Calvary Connect — Predictive Maintenance AI Flow
 *
 * Uses fleet history, maintenance records, and odometer data to predict:
 * - Failure probability in the next N days
 * - Recommended service date
 * - Predicted issues
 * - Estimated repair cost
 *
 * Called asynchronously (returns jobId immediately, polls for result).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const PredictiveMaintenanceInputSchema = z.object({
  truckId: z.string().describe('ID of the fleet vehicle to analyse.'),
  truckName: z.string().describe('Human-readable name/plate of the truck.'),
  currentOdometerKm: z.number().describe('Current odometer reading in km.'),
  lastServiceOdometerKm: z.number().describe('Odometer reading at last service.'),
  lastServiceDate: z.string().describe('ISO date of last maintenance service.'),
  fuelType: z.string().describe('Fuel type (e.g., Diesel, Petrol).'),
  recentMaintenanceCount: z.number().describe('Number of maintenance events in last 90 days.'),
  averageDailyKm: z.number().describe('Average km driven per day over last 30 days.'),
  currentCondition: z.string().describe('Current condition rating: Good | Fair | Poor.'),
  openIssuesCount: z.number().describe('Number of open/unresolved maintenance requests.'),
  daysAhead: z.number().default(30).describe('Days to forecast ahead.'),
});

export type PredictiveMaintenanceInput = z.infer<typeof PredictiveMaintenanceInputSchema>;

// ─── Output Schema ────────────────────────────────────────────────────────────

const PredictiveMaintenanceOutputSchema = z.object({
  failureProbability: z.number().min(0).max(1).describe('Probability of breakdown in daysAhead (0.0–1.0).'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).describe('Risk classification.'),
  recommendedServiceDate: z.string().describe('ISO date for recommended next service.'),
  predictedIssues: z.array(z.string()).describe('List of likely issues based on usage patterns.'),
  estimatedRepairCostUSD: z.number().describe('Rough estimate of repair/service costs in USD.'),
  reasoning: z.string().describe('Short explanation of the prediction (2–3 sentences).'),
  preventiveActions: z.array(z.string()).describe('Immediate actions to reduce breakdown risk.'),
});

export type PredictiveMaintenanceOutput = z.infer<typeof PredictiveMaintenanceOutputSchema>;

// ─── Flow ─────────────────────────────────────────────────────────────────────

const predictiveMaintenanceFlow = ai.defineFlow(
  {
    name: 'predictiveMaintenanceFlow',
    inputSchema: PredictiveMaintenanceInputSchema,
    outputSchema: PredictiveMaintenanceOutputSchema,
  },
  async (input) => {
    const kmSinceService = input.currentOdometerKm - input.lastServiceOdometerKm;
    const daysSinceService = Math.floor(
      (Date.now() - new Date(input.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const { output } = await ai.generate({
      prompt: `You are a senior fleet maintenance engineer with 20 years of experience in heavy logistics.

Analyse this vehicle data and predict maintenance needs for the next ${input.daysAhead} days:

Vehicle: ${input.truckName} (ID: ${input.truckId})
Current odometer: ${input.currentOdometerKm.toLocaleString()} km
km since last service: ${kmSinceService.toLocaleString()} km
Days since last service: ${daysSinceService} days
Average daily km: ${input.averageDailyKm} km/day
Fuel type: ${input.fuelType}
Current condition: ${input.currentCondition}
Recent maintenance events (90 days): ${input.recentMaintenanceCount}
Open unresolved issues: ${input.openIssuesCount}

Based on standard ${input.fuelType} diesel fleet maintenance intervals (every 10,000–15,000 km or 3 months),
provide a precise maintenance prediction. Output valid JSON matching the schema exactly.

IMPORTANT: failureProbability must be between 0.0 and 1.0. estimatedRepairCostUSD must be a realistic number.`,
      output: { schema: PredictiveMaintenanceOutputSchema },
    });

    if (!output) throw new Error('Predictive maintenance AI failed to generate output.');
    return output;
  }
);

/**
 * Public function — call from Server Actions or API routes.
 */
export async function getPredictiveMaintenance(
  input: PredictiveMaintenanceInput
): Promise<PredictiveMaintenanceOutput> {
  return predictiveMaintenanceFlow(input);
}
