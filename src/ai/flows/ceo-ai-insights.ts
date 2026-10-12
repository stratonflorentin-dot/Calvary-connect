/**
 * @fileOverview An AI agent for the CEO dashboard providing insights into fleet operations.
 *
 * - getCeoAiInsights - A function that fetches AI-generated insights based on fleet data.
 * - CeoAiInsightsInput - The input type for the getCeoAiInsights function.
 * - CeoAiInsightsOutput - The return type for the getCeoAiInsights function.
 */

import { generateStructuredAI } from '@/lib/ai-provider';
import { z } from 'zod';

export const CeoAiInsightsInputSchema = z.object({
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

async function createCeoAiInsightsFlow() {
  return async (input: CeoAiInsightsInput) => {
    const { output, provider } = await generateStructuredAI({
      system: 'You are a senior logistics operations analyst. Analyze the supplied live fleet metrics only; do not invent data. Provide 2-3 key highlights, 2-3 concerns, and 2-3 actionable recommendations. Keep the response under 250 words and return JSON matching the required schema.',
      messages: [{ role: 'user', content: [{ text: JSON.stringify(input) }] }],
    }, CeoAiInsightsOutputSchema);
    return { output, provider };
  };
}

export async function getCeoAiInsights(input: CeoAiInsightsInput): Promise<CeoAiInsightsOutput> {
  const ceoAiInsightsFlow = await createCeoAiInsightsFlow();
  return (await ceoAiInsightsFlow(input)).output;
}

export async function getCeoAiInsightsWithMeta(input: CeoAiInsightsInput) {
  const ceoAiInsightsFlow = await createCeoAiInsightsFlow();
  return ceoAiInsightsFlow(input);
}
