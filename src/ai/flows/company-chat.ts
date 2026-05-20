'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MessageData } from 'genkit';

const CompanyChatInputSchema = z.object({
  message: z.string().describe('The user query or question.'),
  context: z.object({
    fleetSize: z.number(),
    activeTrips: z.number(),
    revenue: z.string(),
    expenses: z.string(),
    profit: z.string(),
    utilization: z.string(),
    crossBorder: z.number(),
    coldChain: z.number(),
  }).describe('Company financial and operational context.')
});

export async function askCompanyAI(
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  context: {
    fleetSize: number;
    activeTrips: number;
    revenue: string;
    expenses: string;
    profit: string;
    utilization: string;
    crossBorder: number;
    coldChain: number;
  }
): Promise<string> {
  try {
    const formattedHistory: MessageData[] = history.map((msg) => ({
      role: msg.role,
      content: [{ text: msg.text }],
    }));

    const response = await ai.generate({
      system: `You are the executive AI Operations Analyst for Calvary Connect, a premium logistics and transport management firm.
      
      You have direct, real-time visibility into the company's operational metrics:
      - Total Fleet Size: ${context.fleetSize} vehicles
      - Active Trips In-Transit: ${context.activeTrips} trips
      - Monthly Revenue: ${context.revenue}
      - Monthly Expenses: ${context.expenses}
      - Net Profit: ${context.profit}
      - Fleet Utilization Rate: ${context.utilization}
      - Cross-Border Operations: ${context.crossBorder} active runs
      - Cold-Chain Cargo (Reefer): ${context.coldChain} active runs
      
      Your goal is to perform full company logistics analysis, write detailed operations strategies, and answer queries from the board/executives.
      Use real values from the context when explaining operations. Provide actionable recommendations on resource allocations, cost-cutting measures, and margin optimization.
      Keep your replies professional, precise, and formatted in markdown tables or bullet points where helpful.`,
      messages: [...formattedHistory, { role: 'user', content: [{ text: message }] }],
    });

    return response.text || "I was unable to analyze that data. Please try again.";
  } catch (error: any) {
    console.error('Genkit chat flow error:', error);
    return `Error generating analysis: ${error.message || 'Unknown server error'}`;
  }
}
