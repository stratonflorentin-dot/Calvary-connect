'use server';
/**
 * @fileOverview An AI agent for the CEO dashboard providing insights into fleet operations.
 *
 * - getCeoAiInsights - A function that fetches AI-generated insights based on fleet data.
 * - CeoAiInsightsInput - The input type for the getCeoAiInsights function.
 * - CeoAiInsightsOutput - The return type for the getCeoAiInsights function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CeoAiInsightsInputSchema = z.object({
  activeTripsCount: z.number().describe('Current number of active trips.'),
  fleetBreakdown: z.object({
    available: z.number().describe('Number of available fleet vehicles.'),
    inUse: z.number().describe('Number of fleet vehicles currently in use.'),
    maintenance: z.number().describe('Number of fleet vehicles under maintenance.'),
  }).describe('Breakdown of fleet vehicles by status.'),
  revenueThisMonth: z.number().describe('Total revenue generated this month.'),
  expensesThisMonth: z.number().describe('Total expenses incurred this month.'),
  netProfit: z.number().describe('Net profit for the current month.'),
  fuelConsumptionLiters: z.number().describe('Total fuel consumed in liters this month.'),
  pendingMaintenanceCount: z.number().describe('Number of pending maintenance requests.'),
  lowStockCount: z.number().describe('Number of inventory items currently at low stock.'),
  onlineDriverCount: z.number().describe('Number of drivers currently online.'),
  completedDeliveriesThisMonth: z.number().describe('Total deliveries completed this month.'),
}).describe('Input data for CEO AI insights, comprising various real-time fleet metrics.');
export type CeoAiInsightsInput = z.infer<typeof CeoAiInsightsInputSchema>;

const CeoAiInsightsOutputSchema = z.object({
  keyHighlights: z.array(z.string()).describe('2-3 bullet points highlighting positive aspects or achievements.'),
  areasOfConcern: z.array(z.string()).describe('2-3 bullet points outlining potential risks, issues, or areas needing attention.'),
  actionableRecommendations: z.array(z.string()).describe('2-3 specific, immediate actions that can be taken.'),
}).describe('AI-generated insights for the CEO dashboard, categorized into highlights, concerns, and recommendations.');
export type CeoAiInsightsOutput = z.infer<typeof CeoAiInsightsOutputSchema>;

export async function getCeoAiInsights(input: CeoAiInsightsInput): Promise<CeoAiInsightsOutput> {
  return ceoAiInsightsFlow(input);
}

const ceoAiInsightsPrompt = ai.definePrompt({
  name: 'ceoAiInsightsPrompt',
  input: { schema: CeoAiInsightsInputSchema },
  output: { schema: CeoAiInsightsOutputSchema },
  prompt: `You are a senior logistics operations analyst.

Analyze this FleetCommand data, presented as a JSON object:

${'```json'}
{{{json this}}}
${'```'}

Provide:
1. KEY HIGHLIGHTS (2-3 bullets of what is going well)
2. AREAS OF CONCERN (2-3 bullets of risks/issues)
3. ACTIONABLE RECOMMENDATIONS (2-3 specific actions for today)

Use real numbers from the data. The total response should be under 250 words total. The output should be a JSON object conforming to the CeoAiInsightsOutputSchema.`,
});

const ceoAiInsightsFlow = ai.defineFlow(
  {
    name: 'ceoAiInsightsFlow',
    inputSchema: CeoAiInsightsInputSchema,
    outputSchema: CeoAiInsightsOutputSchema,
  },
  async (input) => {
    const { output } = await ceoAiInsightsPrompt(input);
    if (!output) {
      throw new Error('Failed to generate AI insights.');
    }
    return output;
  }
);
