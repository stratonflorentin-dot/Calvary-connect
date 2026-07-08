/**
 * Calvary Connect — Fuel Consumption Prediction AI Flow
 *
 * Predicts fuel consumption and cost for a planned trip based on:
 * - Route distance and terrain
 * - Vehicle fuel efficiency history
 * - Driver behaviour score
 * - Load weight
 * - Current fuel price
 */

import { createGenkit } from '@/ai/genkit';
import { z } from 'zod';

// ─── Input ────────────────────────────────────────────────────────────────────

export const FuelPredictionInputSchema = z.object({
  tripId: z.string().optional().describe('Trip ID if predicting for a specific trip.'),
  origin: z.string().describe('Trip starting location.'),
  destination: z.string().describe('Trip destination.'),
  distanceKm: z.number().describe('Estimated route distance in km.'),
  vehicleType: z.string().describe('Type of vehicle (e.g., Heavy Duty Truck, Van).'),
  vehicleFuelType: z.string().describe('Fuel type (Diesel/Petrol/Electric).'),
  avgFuelEfficiencyKmPerLiter: z.number().describe('Vehicle average fuel efficiency (km/L).'),
  loadWeightTons: z.number().default(0).describe('Cargo load weight in tons.'),
  driverBehaviourScore: z.number().min(0).max(100).default(75)
    .describe('Driver score 0–100 (100=optimal, lower=more fuel burn).'),
  currentFuelPricePerLiter: z.number().describe('Current fuel price per liter in local currency.'),
  terrainType: z.enum(['flat', 'hilly', 'mountainous', 'mixed']).default('flat'),
  weatherCondition: z.enum(['clear', 'rainy', 'strong_wind', 'extreme_heat']).default('clear'),
});

export type FuelPredictionInput = z.infer<typeof FuelPredictionInputSchema>;

// ─── Output ───────────────────────────────────────────────────────────────────

const FuelPredictionOutputSchema = z.object({
  estimatedFuelLiters: z.number().describe('Predicted fuel consumption in liters.'),
  estimatedFuelCost: z.number().describe('Predicted total fuel cost in local currency.'),
  efficiencyRating: z.enum(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR']),
  fuelCostPerKm: z.number().describe('Cost per km for this trip.'),
  carbonEmissionKg: z.number().describe('Estimated CO2 emissions in kg.'),
  optimisationTips: z.array(z.string()).describe('Driver tips to reduce fuel consumption.'),
  comparisonToFleetAverage: z.string().describe('How this trip compares to fleet average.'),
  confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Confidence of the prediction.'),
});

export type FuelPredictionOutput = z.infer<typeof FuelPredictionOutputSchema>;

// ─── Flow ─────────────────────────────────────────────────────────────────────

async function createFuelPredictionFlow() {
  const ai = await createGenkit();

  return ai.defineFlow(
    {
      name: 'fuelPredictionFlow',
      inputSchema: FuelPredictionInputSchema,
      outputSchema: FuelPredictionOutputSchema,
    },
    async (input: FuelPredictionInput) => {
      // Load adjustment factor (heavier load = worse efficiency)
      const loadFactor = 1 + input.loadWeightTons * 0.02; // 2% per ton
      const terrainFactors = { flat: 1.0, hilly: 1.15, mountainous: 1.30, mixed: 1.10 };
      const weatherFactors = { clear: 1.0, rainy: 1.05, strong_wind: 1.12, extreme_heat: 1.08 };
      const driverFactor = 1 + (100 - input.driverBehaviourScore) / 100 * 0.3; // up to 30% penalty

      const adjustedEfficiency =
        input.avgFuelEfficiencyKmPerLiter /
        (loadFactor * terrainFactors[input.terrainType] * weatherFactors[input.weatherCondition] * driverFactor);

      const estimatedLiters = input.distanceKm / adjustedEfficiency;

      const { output } = await ai.generate({
        prompt: `You are a fuel efficiency analyst for a large fleet company.

Predict fuel consumption for this trip:
Route: ${input.origin} → ${input.destination} (${input.distanceKm} km)
Vehicle: ${input.vehicleType} (${input.vehicleFuelType})
Base efficiency: ${input.avgFuelEfficiencyKmPerLiter} km/L
Load: ${input.loadWeightTons} tons
Driver score: ${input.driverBehaviourScore}/100
Terrain: ${input.terrainType}
Weather: ${input.weatherCondition}
Fuel price: ${input.currentFuelPricePerLiter}/L
Pre-calculated estimate: ~${estimatedLiters.toFixed(1)} L

Validate and refine the estimate. Provide actionable optimisation tips.
For CO2, use: Diesel = 2.68 kg/L, Petrol = 2.31 kg/L.
Output valid JSON matching the schema.`,
        output: { schema: FuelPredictionOutputSchema },
      });

      if (!output) throw new Error('Fuel prediction AI failed to generate output.');
      return output;
    }
  );
}

export async function getFuelPrediction(input: FuelPredictionInput): Promise<FuelPredictionOutput> {
  const fuelPredictionFlow = await createFuelPredictionFlow();
  return fuelPredictionFlow(input);
}
