/**
 * Calvary Connect — Fuel Investigation AI Flow
 *
 * Turns a fuel transaction's already-computed deterministic findings
 * (fuel-fraud-detection.ts's rule outputs, vehicle/driver baselines,
 * combined risk score, escalation tier) into an evidence-grounded
 * investigation report: possible explanations, confidence, recommended
 * action. Every number it reasons over was calculated in TypeScript before
 * this flow ever runs — it explains and correlates, it never computes a
 * score or asserts fraud itself. That determination stays a human decision
 * routed through fuelAnomalyMachine (src/lib/workflow/state-machines.ts).
 */

import { createGenkit } from '@/ai/genkit';
import { z } from 'zod';

const FindingSchema = z.object({
  ruleCode: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  confidence: z.enum(['high', 'medium', 'low']),
  expectedValue: z.number().nullable(),
  actualValue: z.number().nullable(),
  deviationPct: z.number().nullable(),
  description: z.string(),
  evidence: z.record(z.any()),
});

export const FuelInvestigationInputSchema = z.object({
  vehiclePlate: z.string(),
  driverName: z.string().nullable(),
  findings: z.array(FindingSchema).describe('Every non-dismissed fuel_anomalies row for this fuel_log_id.'),
  combinedScore: z.number().describe('0-100 deterministic combined risk score across all findings.'),
  band: z.enum(['normal', 'low', 'medium', 'high', 'critical']),
  escalationTier: z.enum(['observation', 'warning', 'investigation', 'high_risk_case']).nullable()
    .describe('How often this driver+rule combination has recurred recently — null when there is no driver on the transaction.'),
  escalationOccurrences: z.number().nullable(),
  driverBaseline: z.object({ mean: z.number(), stddev: z.number(), sampleSize: z.number() }).nullable(),
  vehicleBaseline: z.object({ mean: z.number(), stddev: z.number(), sampleSize: z.number() }).nullable(),
  previousFuelLog: z.object({ fuelDate: z.string(), litres: z.number(), efficiencyKmL: z.number().nullable() }).nullable(),
  nextFuelLog: z.object({ fuelDate: z.string(), litres: z.number(), efficiencyKmL: z.number().nullable() }).nullable(),
  maintenanceStatus: z.object({ openIssuesCount: z.number(), overdueService: z.boolean() }).nullable(),
  tripSummary: z.object({ origin: z.string(), destination: z.string() }).nullable(),
  dataQualityNotes: z.array(z.string()).describe('Things that could not be verified for this transaction — e.g. no GPS capture, insufficient history.'),
});
export type FuelInvestigationInput = z.infer<typeof FuelInvestigationInputSchema>;

const FuelInvestigationOutputSchema = z.object({
  narrative: z.string().describe('2-4 sentence plain-English summary of what the evidence shows.'),
  possibleExplanations: z.array(z.string()).describe('Plausible, non-accusatory hypotheses for the anomaly — innocent and concerning alike.'),
  reasoningCategory: z.enum(['consumption_anomaly', 'location_anomaly', 'card_anomaly', 'odometer_anomaly', 'price_anomaly', 'duplicate_or_frequency', 'data_quality_insufficient', 'multiple_signals']),
  confidence: z.enum(['high', 'medium', 'low']).describe('How confident this investigation is, given the evidence actually available — not the fraud likelihood.'),
  requiresInvestigation: z.boolean().describe('Whether a human should act on this, vs. it likely being explainable/benign.'),
  recommendedAction: z.string().describe('One concrete next step for the reviewer — never "confirm fraud" or "lock card" outright; those are separate authorized human actions.'),
});
export type FuelInvestigationOutput = z.infer<typeof FuelInvestigationOutputSchema>;

async function createFuelInvestigationFlow() {
  const ai = await createGenkit();
  return ai.defineFlow(
    {
      name: 'fuelInvestigationFlow',
      inputSchema: FuelInvestigationInputSchema,
      outputSchema: FuelInvestigationOutputSchema,
    },
    async (input: FuelInvestigationInput) => {
      const { output } = await ai.generate({
        prompt: `You are a fraud investigation analyst for Calvary Investment Co. Ltd, a road freight company in Tanzania. You are reviewing ONE flagged fuel transaction. Every number below was already calculated deterministically by the application — do not recompute or second-guess the arithmetic, only interpret it.

HARD RULES — do not break these:
1. Never state that fraud is "confirmed". At most, say this is a "high-risk anomaly requiring investigation". Only a human, through the existing approval workflow, can confirm fraud.
2. Do not invent evidence. If dataQualityNotes lists something as unverified, say so plainly in your narrative rather than assuming the worst or the best.
3. A single anomalous transaction is an observation, not a pattern — only call something a real pattern when the escalation data below actually shows repetition.
4. Always include at least one innocent explanation among possibleExplanations when the evidence doesn't rule one out (e.g. unfamiliar vehicle, genuine long-haul trip, GPS/data-entry error, legitimate load variation).

Vehicle: ${input.vehiclePlate}
Driver: ${input.driverName ?? 'Unassigned'}

Combined deterministic risk score: ${input.combinedScore}/100 (${input.band})
Findings (${input.findings.length}):
${input.findings.map((f, i) => `${i + 1}. [${f.ruleCode}] ${f.description} — expected ${f.expectedValue ?? 'n/a'}, actual ${f.actualValue ?? 'n/a'}${f.deviationPct !== null ? `, deviation ${f.deviationPct}%` : ''} (confidence: ${f.confidence})`).join('\n')}

${input.escalationTier ? `Repeat-offense signal for this driver+rule: ${input.escalationOccurrences} occurrence(s) in the last 90 days → ${input.escalationTier}.` : 'No driver linked to this transaction — no repeat-offense signal available.'}

${input.driverBaseline ? `Driver's own baseline efficiency: ${input.driverBaseline.mean} km/L (±${input.driverBaseline.stddev}, n=${input.driverBaseline.sampleSize})` : "Driver's own baseline: insufficient history to compute."}
${input.vehicleBaseline ? `Vehicle's own baseline efficiency: ${input.vehicleBaseline.mean} km/L (±${input.vehicleBaseline.stddev}, n=${input.vehicleBaseline.sampleSize})` : "Vehicle's own baseline: insufficient history to compute."}

${input.previousFuelLog ? `Previous fill: ${input.previousFuelLog.fuelDate}, ${input.previousFuelLog.litres}L, ${input.previousFuelLog.efficiencyKmL ?? 'n/a'} km/L` : 'No previous fill on record for this vehicle.'}
${input.nextFuelLog ? `Next fill: ${input.nextFuelLog.fuelDate}, ${input.nextFuelLog.litres}L, ${input.nextFuelLog.efficiencyKmL ?? 'n/a'} km/L` : 'No later fill on record yet for this vehicle.'}

${input.maintenanceStatus ? `Maintenance: ${input.maintenanceStatus.openIssuesCount} open issue(s), service ${input.maintenanceStatus.overdueService ? 'is overdue' : 'is current'}.` : 'Maintenance status: not available.'}
${input.tripSummary ? `Linked trip: ${input.tripSummary.origin} → ${input.tripSummary.destination}` : 'No trip linked to this transaction.'}

${input.dataQualityNotes.length > 0 ? `Data quality gaps: ${input.dataQualityNotes.join('; ')}` : 'No data quality gaps noted.'}

Produce your investigation report as JSON matching the output schema.`,
        output: { schema: FuelInvestigationOutputSchema },
      });
      if (!output) throw new Error('Fuel investigation AI failed to generate output.');
      return output;
    },
  );
}

export async function investigateFuelAnomaly(input: FuelInvestigationInput): Promise<FuelInvestigationOutput> {
  const flow = await createFuelInvestigationFlow();
  return flow(input);
}
