import { ai } from "../ai/genkit"; // Assuming genkit.ts exports the Genkit instance

/**
 * Custom error class for logistics service errors.
 */
class LogisticsError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LogisticsError";
    this.cause = cause;
  }
}

// Configuration (inspired by search data: support multiple carriers like Tanzania Post, Voria-like systems)
const CONFIG = {
  apiKey: process.env.TRACKINGMORE_API_KEY,
  baseUrl: "https://api.trackingmore.com/v4",
  defaultCarrier: "tanzania-post", // From TrackingMore docs; adjustable for Calvary Logistics
  timeoutMs: 5000, // Prevent long hangs
  maxRetries: 2, // For reliability
};

// Enhanced type for shipment data (based on TrackingMore/Voria/EMASUITE features)
interface ShipmentData {
  tracking_number: string;
  status: string;
  current_location?: string;
  estimated_delivery?: string;
  fuel_consumption?: number; // Inspired by fuel tracking in search results
  route_details?: string[]; // For route optimization
  // Expand as needed
}

interface AnalysisResult {
  rawData: ShipmentData[];
  analysis: string; // Full text analysis with predictions and forecasts
}

/**
 * Utility for retrying fetch calls with exponential backoff.
 * @param fn Async function to retry.
 * @param retries Number of retries.
 */
async function retryFetch<T>(
  fn: () => Promise<T>,
  retries: number,
): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
      attempt++;
    }
  }
  throw new LogisticsError("Max retries exceeded");
}

/**
 * Fetches real shipment status from API (e.g., TrackingMore).
 * Inspired by batch tracking in search results for efficiency.
 * @param trackingNumbers Array of tracking numbers.
 * @param carrier Optional carrier code (defaults to config).
 * @returns Promise resolving to array of shipment data.
 * @throws LogisticsError on failure.
 */
export async function fetchShipmentStatuses(
  trackingNumbers: string[],
  carrier: string = CONFIG.defaultCarrier,
): Promise<ShipmentData[]> {
  if (!CONFIG.apiKey) {
    throw new LogisticsError("API key is not set in .env");
  }
  if (!trackingNumbers.length) {
    throw new LogisticsError("At least one tracking number is required");
  }

  return retryFetch(async () => {
    const response = await fetch(`${CONFIG.baseUrl}/trackings/batch`, {
      // Batch for professionalism (from TrackingMore docs)
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Trackingmore-Api-Key": CONFIG.apiKey!,
      },
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
      body: JSON.stringify({
        tracking_numbers: trackingNumbers,
        carrier_code: carrier,
      }),
    });

    if (!response.ok) {
      throw new LogisticsError(
        `API request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    return data.items as ShipmentData[]; // Refine based on actual API structure
  }, CONFIG.maxRetries);
}

/**
 * Performs full logistics analysis with forecasting and predictions using Groq AI.
 * Inspired by Voria/EMASUITE/Fleettracktz: Includes fuel forecasts, route predictions, maintenance alerts.
 * @param trackingNumbers Array of tracking numbers.
 * @param historicalData Optional historical shipments for trend-based forecasting.
 * @returns Promise resolving to analysis result.
 * @throws LogisticsError on failure.
 */
export async function fullLogisticsAnalysis(
  trackingNumbers: string[],
  historicalData?: ShipmentData[],
): Promise<AnalysisResult> {
  const rawData = await fetchShipmentStatuses(trackingNumbers);

  const prompt = `Perform a full professional analysis for Calvary Logistics in Tanzania on these shipments: ${JSON.stringify(rawData)}.
  Include:
  - Current status summary and real-time insights (e.g., location, delays).
  - Predictions: Potential risks like harsh braking, geo-fencing violations, or breakdowns (inspired by Fleettracktz).
  - Forecasts: Fuel consumption over next 7 days, route optimizations to reduce costs (inspired by Voria/EMASUITE), maintenance needs.
  - Full Analysis: Compliance checks, efficiency recommendations, and data-driven decisions.
  ${historicalData ? `Use historical trends: ${JSON.stringify(historicalData)} for accurate forecasting.` : "Base on general Tanzania logistics knowledge."}
  Output in structured Markdown for professionalism.`;

  try {
    const result = await ai.generate({
      model: "groq/llama-3.3-70b-versatile",
      prompt,
      config: { temperature: 0.5 }, // Lower for factual, predictive output
    });

    return {
      rawData,
      analysis: result.output as string,
    };
  } catch (error) {
    throw new LogisticsError("AI analysis failed", error);
  }
}
