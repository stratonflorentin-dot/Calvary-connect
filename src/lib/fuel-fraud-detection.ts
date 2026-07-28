import type { SupabaseClient } from "@supabase/supabase-js";

type FuelLog = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  fuel_date: string;
  litres: number;
  cost_per_litre: number | null;
  efficiency_km_l: number | null;
};

type DetectedAnomaly = {
  vehicle_id: string;
  driver_id: string | null;
  fuel_log_id: string;
  anomaly_type: "efficiency_outlier" | "impossible_volume" | "frequency_outlier" | "price_outlier";
  severity: "low" | "medium" | "high";
  expected_value: number | null;
  actual_value: number | null;
  deviation_pct: number | null;
  description: string;
};

const LOOKBACK_DAYS = 180;
const MIN_HISTORY_FOR_BASELINE = 4;
const STDDEV_THRESHOLD = 2;
const MIN_HOURS_BETWEEN_FILLS = 6;

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Flags anomalous fuel_logs rows for one vehicle: efficiency outliers
 * (vs. that vehicle's own trailing baseline), impossible single-fill
 * volumes (exceeds tank capacity), refuels too close together, and
 * cost-per-litre outliers vs. the fleet-wide rate on that date.
 */
export async function detectFuelAnomaliesForVehicle(
  supabase: SupabaseClient,
  vehicleId: string,
): Promise<DetectedAnomaly[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [{ data: logs }, { data: vehicle }, { data: fleetRates }] = await Promise.all([
    supabase
      .from("fuel_logs")
      .select("id, vehicle_id, driver_id, fuel_date, litres, cost_per_litre, efficiency_km_l")
      .eq("vehicle_id", vehicleId)
      .gte("fuel_date", since)
      .order("fuel_date", { ascending: true }),
    supabase.from("vehicles").select("tank_capacity_litres").eq("id", vehicleId).maybeSingle(),
    supabase
      .from("fuel_logs")
      .select("cost_per_litre")
      .gte("fuel_date", since)
      .not("cost_per_litre", "is", null),
  ]);

  const rows = (logs || []) as FuelLog[];
  if (rows.length === 0) return [];

  const anomalies: DetectedAnomaly[] = [];
  const tankCapacity = vehicle?.tank_capacity_litres ?? null;
  const fleetCostRates = (fleetRates || []).map((r: any) => Number(r.cost_per_litre)).filter((v: number) => v > 0);
  const fleetAvgRate = fleetCostRates.length > 0 ? mean(fleetCostRates) : null;
  const fleetRateStddev = fleetAvgRate !== null ? stddev(fleetCostRates, fleetAvgRate) : 0;

  const efficiencies = rows.map((r) => r.efficiency_km_l).filter((v): v is number => v !== null && v > 0);
  const baselineAvg = efficiencies.length >= MIN_HISTORY_FOR_BASELINE ? mean(efficiencies) : null;
  const baselineStddev = baselineAvg !== null ? stddev(efficiencies, baselineAvg) : 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Impossible single-fill volume
    if (tankCapacity && row.litres > tankCapacity) {
      anomalies.push({
        vehicle_id: vehicleId,
        driver_id: row.driver_id,
        fuel_log_id: row.id,
        anomaly_type: "impossible_volume",
        severity: "high",
        expected_value: tankCapacity,
        actual_value: row.litres,
        deviation_pct: ((row.litres - tankCapacity) / tankCapacity) * 100,
        description: `Logged ${row.litres}L exceeds this vehicle's ${tankCapacity}L tank capacity.`,
      });
    }

    // 2. Efficiency outlier vs. this vehicle's own trailing baseline
    if (baselineAvg !== null && baselineStddev > 0 && row.efficiency_km_l !== null) {
      const deviation = Math.abs(row.efficiency_km_l - baselineAvg) / baselineStddev;
      if (deviation > STDDEV_THRESHOLD) {
        anomalies.push({
          vehicle_id: vehicleId,
          driver_id: row.driver_id,
          fuel_log_id: row.id,
          anomaly_type: "efficiency_outlier",
          severity: deviation > STDDEV_THRESHOLD * 1.5 ? "high" : "medium",
          expected_value: Number(baselineAvg.toFixed(2)),
          actual_value: row.efficiency_km_l,
          deviation_pct: Number((((row.efficiency_km_l - baselineAvg) / baselineAvg) * 100).toFixed(1)),
          description:
            row.efficiency_km_l < baselineAvg
              ? `Efficiency of ${row.efficiency_km_l.toFixed(2)} km/L is far below this vehicle's usual ${baselineAvg.toFixed(2)} km/L — possible over-claimed litres or siphoning.`
              : `Efficiency of ${row.efficiency_km_l.toFixed(2)} km/L is far above this vehicle's usual ${baselineAvg.toFixed(2)} km/L — check odometer readings for this fill.`,
        });
      }
    }

    // 3. Refuels suspiciously close together
    if (i > 0) {
      const hoursSinceLast =
        (new Date(row.fuel_date).getTime() - new Date(rows[i - 1].fuel_date).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast >= 0 && hoursSinceLast < MIN_HOURS_BETWEEN_FILLS) {
        anomalies.push({
          vehicle_id: vehicleId,
          driver_id: row.driver_id,
          fuel_log_id: row.id,
          anomaly_type: "frequency_outlier",
          severity: "medium",
          expected_value: MIN_HOURS_BETWEEN_FILLS,
          actual_value: Number(hoursSinceLast.toFixed(1)),
          deviation_pct: null,
          description: `Refueled only ${hoursSinceLast.toFixed(1)}h after the previous fill for this vehicle.`,
        });
      }
    }

    // 4. Cost-per-litre outlier vs. fleet-wide rate
    if (fleetAvgRate !== null && fleetRateStddev > 0 && row.cost_per_litre) {
      const deviation = Math.abs(row.cost_per_litre - fleetAvgRate) / fleetRateStddev;
      if (deviation > STDDEV_THRESHOLD) {
        anomalies.push({
          vehicle_id: vehicleId,
          driver_id: row.driver_id,
          fuel_log_id: row.id,
          anomaly_type: "price_outlier",
          severity: "low",
          expected_value: Number(fleetAvgRate.toFixed(2)),
          actual_value: row.cost_per_litre,
          deviation_pct: Number((((row.cost_per_litre - fleetAvgRate) / fleetAvgRate) * 100).toFixed(1)),
          description: `Paid ${row.cost_per_litre}/L vs. the fleet's recent average of ${fleetAvgRate.toFixed(2)}/L.`,
        });
      }
    }
  }

  return anomalies;
}

export async function detectFuelAnomaliesForAllVehicles(supabase: SupabaseClient): Promise<DetectedAnomaly[]> {
  const { data: vehicles } = await supabase.from("vehicles").select("id");
  const results = await Promise.all(
    (vehicles || []).map((v: any) => detectFuelAnomaliesForVehicle(supabase, v.id)),
  );
  return results.flat();
}

/**
 * Inserts newly-detected anomalies, relying on the (fuel_log_id, anomaly_type)
 * unique constraint to silently skip ones already flagged from a prior scan.
 * Returns only the anomalies that were actually new.
 */
export async function persistFuelAnomalies(
  supabase: SupabaseClient,
  anomalies: DetectedAnomaly[],
): Promise<DetectedAnomaly[]> {
  if (anomalies.length === 0) return [];
  const { data, error } = await supabase
    .from("fuel_anomalies")
    .upsert(anomalies, { onConflict: "fuel_log_id,anomaly_type", ignoreDuplicates: true })
    .select("fuel_log_id, anomaly_type");
  if (error) throw error;
  const inserted = new Set((data || []).map((d: any) => `${d.fuel_log_id}:${d.anomaly_type}`));
  return anomalies.filter((a) => inserted.has(`${a.fuel_log_id}:${a.anomaly_type}`));
}
