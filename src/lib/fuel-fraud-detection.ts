import type { SupabaseClient } from "@supabase/supabase-js";

type FuelLog = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  trip_id: string | null;
  fuel_date: string;
  litres: number;
  cost_per_litre: number | null;
  efficiency_km_l: number | null;
  odometer_before: number | null;
  odometer_after: number | null;
  fuel_station: string | null;
  fuel_station_id: string | null;
  fuel_card_id: string | null;
  receipt_number: string | null;
  capture_latitude: number | null;
  capture_longitude: number | null;
  capture_gps_accuracy_m: number | null;
};

export type RuleCode =
  | "GPS_MISMATCH"
  | "OFF_ROUTE_FUELING"
  | "FUEL_CARD_MISMATCH"
  | "FUEL_DUPLICATE_RECEIPT"
  | "TANK_CAPACITY_EXCEEDED"
  | "FUEL_CONSUMPTION_HIGH"
  | "ODOMETER_ROLLBACK"
  | "RAPID_REFUELING"
  | "EXCESSIVE_FUELING"
  | "FUEL_PRICE_ANOMALY"
  | "STATIONARY_LOCATION_MISMATCH"
  | "POSSIBLE_SIPHONING"
  | "EXCESSIVE_IDLING";

// The 4 rule codes that predate this upgrade map onto the original
// anomaly_type CHECK values so existing rows/queries keep working.
const LEGACY_ANOMALY_TYPE: Partial<Record<RuleCode, string>> = {
  TANK_CAPACITY_EXCEEDED: "impossible_volume",
  FUEL_CONSUMPTION_HIGH: "efficiency_outlier",
  RAPID_REFUELING: "frequency_outlier",
  FUEL_PRICE_ANOMALY: "price_outlier",
};

export interface RuleConfig {
  rule_code: string;
  severity: "low" | "medium" | "high";
  weight: number;
  threshold: Record<string, any>;
  enabled: boolean;
}

type DetectedAnomaly = {
  vehicle_id: string;
  driver_id: string | null;
  fuel_log_id: string | null;
  anomaly_type: string;
  rule_code: RuleCode;
  severity: "low" | "medium" | "high";
  risk_score: number;
  confidence: "high" | "medium" | "low";
  expected_value: number | null;
  actual_value: number | null;
  deviation_pct: number | null;
  description: string;
  evidence: Record<string, any>;
  dedupe_key: string;
};

const LOOKBACK_DAYS = 180;
const MIN_HISTORY_FOR_BASELINE = 4;

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Great-circle distance in km.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Perpendicular distance (km, approximated on an equirectangular projection —
// fine at the corridor-check scale this is used for) from a point to the
// straight-line segment between two other points.
function pointToSegmentKm(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const toXY = (lat: number, lng: number, refLat: number): [number, number] => [
    lng * 111.32 * Math.cos((refLat * Math.PI) / 180),
    lat * 110.57,
  ];
  const refLat = a[0];
  const [px, py] = toXY(p[0], p[1], refLat);
  const [ax, ay] = toXY(a[0], a[1], refLat);
  const [bx, by] = toXY(b[0], b[1], refLat);
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// Best-effort geocoding via Nominatim (the same public service the client-side
// Route Optimizer already uses). Never throws — callers must treat a null
// result as "skip this rule for lack of data," never as an error.
const geocodeCache = new Map<string, [number, number] | null>();
async function geocode(place: string): Promise<[number, number] | null> {
  const key = place.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
      { headers: { "User-Agent": "CalvaryConnect-FuelFraudEngine/1.0" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const json = await res.json();
    const hit = json?.[0];
    const coords: [number, number] | null = hit ? [Number(hit.lat), Number(hit.lon)] : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export async function loadRuleConfig(supabase: SupabaseClient): Promise<Map<string, RuleConfig>> {
  const { data } = await supabase.from("fuel_fraud_rules").select("rule_code, severity, weight, threshold, enabled");
  const map = new Map<string, RuleConfig>();
  for (const r of data || []) map.set(r.rule_code, r as RuleConfig);
  return map;
}

function ruleFor(config: Map<string, RuleConfig>, code: RuleCode): RuleConfig {
  return (
    config.get(code) ?? {
      rule_code: code,
      severity: "medium",
      weight: 1,
      threshold: {},
      enabled: true,
    }
  );
}

function confidenceFactor(confidence: "high" | "medium" | "low"): number {
  return confidence === "high" ? 1 : confidence === "medium" ? 0.6 : 0.3;
}

function makeAnomaly(
  base: { vehicle_id: string; driver_id: string | null; fuel_log_id: string | null },
  rule: RuleConfig,
  ruleCode: RuleCode,
  confidence: "high" | "medium" | "low",
  fields: {
    expected_value: number | null;
    actual_value: number | null;
    deviation_pct: number | null;
    description: string;
    evidence: Record<string, any>;
  },
  /** Override the default fuel_log_id-based dedupe key — required for
   *  vehicle/time-window rules (idling, siphoning) that aren't tied to a
   *  single fuel purchase. */
  dedupeKeyOverride?: string,
): DetectedAnomaly {
  const anomaly_type = LEGACY_ANOMALY_TYPE[ruleCode] ?? ruleCode;
  return {
    ...base,
    anomaly_type,
    rule_code: ruleCode,
    severity: rule.severity,
    risk_score: Number((rule.weight * confidenceFactor(confidence)).toFixed(2)),
    confidence,
    dedupe_key: dedupeKeyOverride ?? `${base.fuel_log_id}:${anomaly_type}`,
    ...fields,
  };
}

/**
 * Flags anomalous fuel_logs rows for one vehicle. Every rule independently
 * checks its own required inputs and contributes nothing when they're
 * missing — never fabricates a finding from absent data.
 */
export async function detectFuelAnomaliesForVehicle(
  supabase: SupabaseClient,
  vehicleId: string,
  ruleConfig?: Map<string, RuleConfig>,
): Promise<DetectedAnomaly[]> {
  const config = ruleConfig ?? (await loadRuleConfig(supabase));
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [{ data: logs }, { data: vehicle }, { data: fleetRates }] = await Promise.all([
    supabase
      .from("fuel_logs")
      .select(
        "id, vehicle_id, driver_id, trip_id, fuel_date, litres, cost_per_litre, efficiency_km_l, odometer_before, odometer_after, fuel_station, fuel_station_id, fuel_card_id, receipt_number, capture_latitude, capture_longitude, capture_gps_accuracy_m",
      )
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
  const base = (row: FuelLog) => ({ vehicle_id: vehicleId, driver_id: row.driver_id, fuel_log_id: row.id });

  const tankCapacity = vehicle?.tank_capacity_litres ?? null;
  const fleetCostRates = (fleetRates || []).map((r: any) => Number(r.cost_per_litre)).filter((v: number) => v > 0);
  const fleetAvgRate = fleetCostRates.length > 0 ? mean(fleetCostRates) : null;
  const fleetRateStddev = fleetAvgRate !== null ? stddev(fleetCostRates, fleetAvgRate) : 0;

  const efficiencies = rows.map((r) => r.efficiency_km_l).filter((v): v is number => v !== null && v > 0);
  const baselineAvg = efficiencies.length >= MIN_HISTORY_FOR_BASELINE ? mean(efficiencies) : null;
  const baselineStddev = baselineAvg !== null ? stddev(efficiencies, baselineAvg) : 0;

  // Litres-per-transaction baseline, used by EXCESSIVE_FUELING.
  const litresValues = rows.map((r) => r.litres).filter((v) => v > 0);
  const litresAvg = litresValues.length >= MIN_HISTORY_FOR_BASELINE ? mean(litresValues) : null;
  const litresStddev = litresAvg !== null ? stddev(litresValues, litresAvg) : 0;

  // Fetch linked fuel stations / cards / trips / a live location snapshot up
  // front, scoped only to what these rows actually reference.
  const stationIds = [...new Set(rows.map((r) => r.fuel_station_id).filter(Boolean))] as string[];
  const cardIds = [...new Set(rows.map((r) => r.fuel_card_id).filter(Boolean))] as string[];
  const tripIds = [...new Set(rows.map((r) => r.trip_id).filter(Boolean))] as string[];

  const [{ data: stations }, { data: cards }, { data: trips }, { data: vehicleLoc }] = await Promise.all([
    stationIds.length
      ? supabase.from("fuel_stations").select("id, name, latitude, longitude").in("id", stationIds)
      : Promise.resolve({ data: [] as any[] }),
    cardIds.length
      ? supabase.from("fuel_cards").select("id, card_number, assigned_driver_id, assigned_vehicle_id, status").in("id", cardIds)
      : Promise.resolve({ data: [] as any[] }),
    tripIds.length
      ? supabase.from("trips").select("id, origin, destination").in("id", tripIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("vehicle_locations").select("latitude, longitude, updated_at").eq("vehicle_id", vehicleId).maybeSingle(),
  ]);

  const stationById = new Map((stations || []).map((s: any) => [s.id, s]));
  const cardById = new Map((cards || []).map((c: any) => [c.id, c]));
  const tripById = new Map((trips || []).map((t: any) => [t.id, t]));

  const gpsRule = ruleFor(config, "GPS_MISMATCH");
  const routeRule = ruleFor(config, "OFF_ROUTE_FUELING");
  const cardRule = ruleFor(config, "FUEL_CARD_MISMATCH");
  const tankRule = ruleFor(config, "TANK_CAPACITY_EXCEEDED");
  const consumptionRule = ruleFor(config, "FUEL_CONSUMPTION_HIGH");
  const freqRule = ruleFor(config, "RAPID_REFUELING");
  const excessiveRule = ruleFor(config, "EXCESSIVE_FUELING");
  const priceRule = ruleFor(config, "FUEL_PRICE_ANOMALY");
  const odometerRule = ruleFor(config, "ODOMETER_ROLLBACK");
  const stationaryRule = ruleFor(config, "STATIONARY_LOCATION_MISMATCH");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Impossible single-fill volume (existing check, unchanged logic)
    if (tankRule.enabled && tankCapacity && row.litres > tankCapacity) {
      anomalies.push(
        makeAnomaly(base(row), tankRule, "TANK_CAPACITY_EXCEEDED", "high", {
          expected_value: tankCapacity,
          actual_value: row.litres,
          deviation_pct: ((row.litres - tankCapacity) / tankCapacity) * 100,
          description: `Logged ${row.litres}L exceeds this vehicle's ${tankCapacity}L tank capacity.`,
          evidence: { transaction: { fuel_log_id: row.id, litres: row.litres }, tank: { capacity: tankCapacity } },
        }),
      );
    }

    // 2. Efficiency outlier vs. this vehicle's own trailing baseline (existing check, unchanged logic)
    if (consumptionRule.enabled && baselineAvg !== null && baselineStddev > 0 && row.efficiency_km_l !== null) {
      const threshold = consumptionRule.threshold?.stddev_threshold ?? 2;
      const deviation = Math.abs(row.efficiency_km_l - baselineAvg) / baselineStddev;
      if (deviation > threshold) {
        anomalies.push(
          makeAnomaly(base(row), consumptionRule, "FUEL_CONSUMPTION_HIGH", "high", {
            expected_value: Number(baselineAvg.toFixed(2)),
            actual_value: row.efficiency_km_l,
            deviation_pct: Number((((row.efficiency_km_l - baselineAvg) / baselineAvg) * 100).toFixed(1)),
            description:
              row.efficiency_km_l < baselineAvg
                ? `Efficiency of ${row.efficiency_km_l.toFixed(2)} km/L is far below this vehicle's usual ${baselineAvg.toFixed(2)} km/L — possible over-claimed litres or siphoning.`
                : `Efficiency of ${row.efficiency_km_l.toFixed(2)} km/L is far above this vehicle's usual ${baselineAvg.toFixed(2)} km/L — check odometer readings for this fill.`,
            evidence: {
              baseline: { metric: "km_per_litre", mean: baselineAvg, stddev: baselineStddev, sample_size: efficiencies.length },
            },
          }),
        );
      }
    }

    // 3. Refuels suspiciously close together (existing check, unchanged logic)
    if (freqRule.enabled && i > 0) {
      const minHours = freqRule.threshold?.min_hours_between_fills ?? 6;
      const hoursSinceLast =
        (new Date(row.fuel_date).getTime() - new Date(rows[i - 1].fuel_date).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast >= 0 && hoursSinceLast < minHours) {
        anomalies.push(
          makeAnomaly(base(row), freqRule, "RAPID_REFUELING", "high", {
            expected_value: minHours,
            actual_value: Number(hoursSinceLast.toFixed(1)),
            deviation_pct: null,
            description: `Refueled only ${hoursSinceLast.toFixed(1)}h after the previous fill for this vehicle.`,
            evidence: { transaction: { fuel_log_id: row.id, litres: row.litres } },
          }),
        );
      }
    }

    // 4. Cost-per-litre outlier vs. fleet-wide rate (existing check, unchanged logic)
    if (priceRule.enabled && fleetAvgRate !== null && fleetRateStddev > 0 && row.cost_per_litre) {
      const threshold = priceRule.threshold?.stddev_threshold ?? 2;
      const deviation = Math.abs(row.cost_per_litre - fleetAvgRate) / fleetRateStddev;
      if (deviation > threshold) {
        anomalies.push(
          makeAnomaly(base(row), priceRule, "FUEL_PRICE_ANOMALY", "medium", {
            expected_value: Number(fleetAvgRate.toFixed(2)),
            actual_value: row.cost_per_litre,
            deviation_pct: Number((((row.cost_per_litre - fleetAvgRate) / fleetAvgRate) * 100).toFixed(1)),
            description: `Paid ${row.cost_per_litre}/L vs. the fleet's recent average of ${fleetAvgRate.toFixed(2)}/L.`,
            evidence: { baseline: { metric: "cost_per_litre", mean: fleetAvgRate, stddev: fleetRateStddev } },
          }),
        );
      }
    }

    // 5. Odometer anomaly — rollback, negative/implausible distance, repeats.
    // No missing-data case: these columns are core to every fill.
    if (odometerRule.enabled && row.odometer_before !== null && row.odometer_after !== null) {
      const distance = row.odometer_after - row.odometer_before;
      if (distance < 0) {
        anomalies.push(
          makeAnomaly(base(row), odometerRule, "ODOMETER_ROLLBACK", "high", {
            expected_value: row.odometer_before,
            actual_value: row.odometer_after,
            deviation_pct: null,
            description: `Odometer reads ${row.odometer_after}km, lower than the ${row.odometer_before}km logged at the start of this fill — possible rollback.`,
            evidence: { odometer: { before: row.odometer_before, after: row.odometer_after, distance_km: distance } },
          }),
        );
      } else if (distance > 3000) {
        // A single fill-to-fill jump this large is implausible for local/regional haulage.
        anomalies.push(
          makeAnomaly(base(row), odometerRule, "ODOMETER_ROLLBACK", "medium", {
            expected_value: null,
            actual_value: distance,
            deviation_pct: null,
            description: `Odometer jumped ${distance}km since the previous fill — verify this is a genuine long-haul trip, not a data entry error.`,
            evidence: { odometer: { before: row.odometer_before, after: row.odometer_after, distance_km: distance } },
          }),
        );
      } else if (i > 0 && rows[i - 1].odometer_after !== null && rows[i - 1].odometer_after === row.odometer_after) {
        anomalies.push(
          makeAnomaly(base(row), odometerRule, "ODOMETER_ROLLBACK", "medium", {
            expected_value: null,
            actual_value: row.odometer_after,
            deviation_pct: null,
            description: `Odometer reading (${row.odometer_after}km) is identical to the previous fill's — likely not re-read.`,
            evidence: { odometer: { before: row.odometer_before, after: row.odometer_after } },
          }),
        );
      }
    }

    // 6. Excessive fueling volume vs. this vehicle's own trailing baseline.
    if (excessiveRule.enabled && litresAvg !== null && litresStddev > 0) {
      const threshold = excessiveRule.threshold?.stddev_threshold ?? 2;
      const deviation = Math.abs(row.litres - litresAvg) / litresStddev;
      if (deviation > threshold && row.litres > litresAvg) {
        anomalies.push(
          makeAnomaly(base(row), excessiveRule, "EXCESSIVE_FUELING", "high", {
            expected_value: Number(litresAvg.toFixed(1)),
            actual_value: row.litres,
            deviation_pct: Number((((row.litres - litresAvg) / litresAvg) * 100).toFixed(1)),
            description: `${row.litres}L is far above this vehicle's usual ${litresAvg.toFixed(1)}L per fill.`,
            evidence: { baseline: { metric: "litres_per_fill", mean: litresAvg, stddev: litresStddev, sample_size: litresValues.length } },
          }),
        );
      }
    }

    // 7. GPS mismatch — only when both a capture position and a linked
    // station with coordinates exist. No fallback fabrication.
    if (gpsRule.enabled && row.fuel_station_id && row.capture_latitude !== null && row.capture_longitude !== null) {
      const station = stationById.get(row.fuel_station_id);
      if (station?.latitude != null && station?.longitude != null) {
        const distanceKm = haversineKm(row.capture_latitude, row.capture_longitude, station.latitude, station.longitude);
        const suspiciousKm = gpsRule.threshold?.suspicious_km ?? 10;
        const reviewKm = gpsRule.threshold?.review_km ?? 5;
        if (distanceKm > reviewKm) {
          anomalies.push(
            makeAnomaly(base(row), gpsRule, "GPS_MISMATCH", "high", {
              expected_value: 0,
              actual_value: Number(distanceKm.toFixed(2)),
              deviation_pct: null,
              description: `Captured GPS was ${distanceKm.toFixed(1)}km from ${station.name} at the time of this purchase.`,
              evidence: {
                gps: {
                  capture: [row.capture_latitude, row.capture_longitude],
                  station: [station.latitude, station.longitude],
                  distance_km: Number(distanceKm.toFixed(2)),
                  accuracy_m: row.capture_gps_accuracy_m,
                  source: "capture",
                },
              },
            }),
          );
          void suspiciousKm; // reserved for a future finer-grained severity split
        }
      }
    }

    // 8. Fuel card mismatch — only when the transaction is linked to a card.
    if (cardRule.enabled && row.fuel_card_id) {
      const card = cardById.get(row.fuel_card_id);
      if (card) {
        const mismatches: string[] = [];
        if (card.status === "deactivated") mismatches.push("card is deactivated");
        if (card.assigned_driver_id && row.driver_id && card.assigned_driver_id !== row.driver_id) mismatches.push("used by a driver it isn't assigned to");
        if (card.assigned_vehicle_id && card.assigned_vehicle_id !== row.vehicle_id) mismatches.push("used on a vehicle it isn't assigned to");
        if (mismatches.length > 0) {
          anomalies.push(
            makeAnomaly(base(row), cardRule, "FUEL_CARD_MISMATCH", "high", {
              expected_value: null,
              actual_value: null,
              deviation_pct: null,
              description: `Fuel card ${card.card_number}: ${mismatches.join(", ")}.`,
              evidence: {
                fuel_card: {
                  card_id: card.id,
                  assigned_driver_id: card.assigned_driver_id,
                  assigned_vehicle_id: card.assigned_vehicle_id,
                  transaction_driver_id: row.driver_id,
                  transaction_vehicle_id: row.vehicle_id,
                },
              },
            }),
          );
        }
      }
    }

    // 9. Off-route fueling — only when the fill is linked to a trip with
    // origin/destination text AND the station has coordinates. Geocoding
    // is best-effort; a failed/unavailable geocode simply skips this row.
    if (routeRule.enabled && row.trip_id && row.fuel_station_id) {
      const trip = tripById.get(row.trip_id);
      const station = stationById.get(row.fuel_station_id);
      if (trip?.origin && trip?.destination && station?.latitude != null && station?.longitude != null) {
        const [originCoords, destCoords] = await Promise.all([geocode(trip.origin), geocode(trip.destination)]);
        if (originCoords && destCoords) {
          const corridorKm = routeRule.threshold?.corridor_km ?? 15;
          const distanceKm = pointToSegmentKm([station.latitude, station.longitude], originCoords, destCoords);
          if (distanceKm > corridorKm) {
            anomalies.push(
              makeAnomaly(base(row), routeRule, "OFF_ROUTE_FUELING", "medium", {
                expected_value: corridorKm,
                actual_value: Number(distanceKm.toFixed(1)),
                deviation_pct: null,
                description: `${station.name} is ${distanceKm.toFixed(1)}km from the ${trip.origin} → ${trip.destination} route corridor.`,
                evidence: {
                  route: { trip_id: trip.id, origin: trip.origin, destination: trip.destination, distance_from_route_km: Number(distanceKm.toFixed(1)) },
                },
              }),
            );
          }
        }
      }
    }

    // 10. Stationary location mismatch — only when a live vehicle_locations
    // snapshot exists close in time to this fill and the station has
    // coordinates. Never flags merely for being stationary.
    if (
      stationaryRule.enabled &&
      row.fuel_station_id &&
      vehicleLoc?.latitude != null &&
      vehicleLoc?.longitude != null &&
      vehicleLoc?.updated_at
    ) {
      const station = stationById.get(row.fuel_station_id);
      const ageMinutes = Math.abs(new Date(vehicleLoc.updated_at).getTime() - new Date(row.fuel_date).getTime()) / 60000;
      const maxAgeMinutes = stationaryRule.threshold?.max_age_minutes ?? 30;
      const maxKm = stationaryRule.threshold?.max_km ?? 5;
      if (station?.latitude != null && station?.longitude != null && ageMinutes <= maxAgeMinutes) {
        const distanceKm = haversineKm(vehicleLoc.latitude, vehicleLoc.longitude, station.latitude, station.longitude);
        if (distanceKm > maxKm) {
          anomalies.push(
            makeAnomaly(base(row), stationaryRule, "STATIONARY_LOCATION_MISMATCH", "medium", {
              expected_value: 0,
              actual_value: Number(distanceKm.toFixed(2)),
              deviation_pct: null,
              description: `Vehicle's last known position was ${distanceKm.toFixed(1)}km from ${station.name} around the time of this purchase.`,
              evidence: {
                gps: {
                  station: [station.latitude, station.longitude],
                  vehicle_last_known: [vehicleLoc.latitude, vehicleLoc.longitude],
                  distance_km: Number(distanceKm.toFixed(2)),
                  source: "vehicle_locations_snapshot",
                },
              },
            }),
          );
        }
      }
    }

    // 11. POSSIBLE_SIPHONING requires a time series of *tank level*, which
    // no connected telemetry provider currently supplies for this fleet —
    // checked live against every Wialon unit's configured sensors (Speed,
    // External Power, Engine ignition only; no fuel-level sensor on any of
    // them). This rule stays a documented no-op rather than guessing at a
    // proxy signal. It activates the moment fuel-level telemetry exists
    // (e.g. once Cartrack's Fuel API — which does support tank/CAN-bus fuel
    // readings — is enabled for this account).
  }

  return anomalies;
}

/**
 * Duplicate-receipt detection runs across the whole fleet, not per vehicle —
 * the same receipt number showing up against two different vehicles is
 * exactly the case a per-vehicle scan would miss.
 */
export async function detectDuplicateReceiptAnomalies(
  supabase: SupabaseClient,
  ruleConfig?: Map<string, RuleConfig>,
): Promise<DetectedAnomaly[]> {
  const config = ruleConfig ?? (await loadRuleConfig(supabase));
  const rule = ruleFor(config, "FUEL_DUPLICATE_RECEIPT");
  if (!rule.enabled) return [];

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data } = await supabase
    .from("fuel_logs")
    .select("id, vehicle_id, driver_id, fuel_date, litres, cost_per_litre, receipt_number, fuel_station, fuel_station_id")
    .gte("fuel_date", since)
    .not("receipt_number", "is", null);

  const rows = (data || []) as FuelLog[];
  if (rows.length < 2) return [];

  const anomalies: DetectedAnomaly[] = [];
  const byReceipt = new Map<string, FuelLog[]>();
  for (const row of rows) {
    const key = `${(row.receipt_number || "").trim().toLowerCase()}::${row.fuel_station_id ?? row.fuel_station ?? ""}`;
    if (!byReceipt.has(key)) byReceipt.set(key, []);
    byReceipt.get(key)!.push(row);
  }

  for (const group of byReceipt.values()) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) {
      const row = group[i];
      anomalies.push(
        makeAnomaly(
          { vehicle_id: row.vehicle_id, driver_id: row.driver_id, fuel_log_id: row.id },
          rule,
          "FUEL_DUPLICATE_RECEIPT",
          "high",
          {
            expected_value: null,
            actual_value: null,
            deviation_pct: null,
            description: `Receipt ${row.receipt_number} at ${row.fuel_station ?? "this station"} appears ${group.length} times.`,
            evidence: { transaction: { fuel_log_id: row.id, receipt_number: row.receipt_number, litres: row.litres } },
          },
        ),
      );
    }
  }

  return anomalies;
}

const IDLING_LOOKBACK_DAYS = 7;
const IDLING_MAX_GAP_MINUTES = 20; // a bigger gap than this between readings breaks a run — the vehicle could have moved/stopped/started in between and we didn't see it.

/**
 * Excessive idling — engine on, effectively stationary, for longer than the
 * configured threshold — computed from vehicle_telemetry_history. Real data,
 * not a proxy: only fires for vehicles whose provider actually reports
 * ignition status (confirmed live for every mapped Wialon unit today via
 * their "Engine ignition sensor"). Runs per-vehicle, one row per idle
 * episode, deduped on (vehicle, hour bucket the episode started in) so a
 * single long idle doesn't get re-flagged every scan while it's ongoing.
 */
export async function detectIdlingAnomalies(
  supabase: SupabaseClient,
  vehicleId: string,
  ruleConfig?: Map<string, RuleConfig>,
): Promise<DetectedAnomaly[]> {
  const config = ruleConfig ?? (await loadRuleConfig(supabase));
  const rule = ruleFor(config, "EXCESSIVE_IDLING");
  if (!rule.enabled) return [];

  const since = new Date(Date.now() - IDLING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("vehicle_telemetry_history")
    .select("recorded_at, speed_kmh, engine_on")
    .eq("vehicle_id", vehicleId)
    .not("engine_on", "is", null)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  const rows = (data || []) as { recorded_at: string; speed_kmh: number | null; engine_on: boolean }[];
  if (rows.length < 2) return [];

  const minMinutes = rule.threshold?.min_minutes ?? 30;
  const anomalies: DetectedAnomaly[] = [];

  let runStart: string | null = null;
  let runEnd: string | null = null;

  const flushRun = () => {
    if (!runStart || !runEnd) return;
    const minutes = (new Date(runEnd).getTime() - new Date(runStart).getTime()) / 60000;
    if (minutes < minMinutes) return;
    const hourBucket = runStart.slice(0, 13); // yyyy-mm-ddThh — one flag per idle episode per hour it started in
    anomalies.push(
      makeAnomaly(
        { vehicle_id: vehicleId, driver_id: null, fuel_log_id: null },
        rule,
        "EXCESSIVE_IDLING",
        "high",
        {
          expected_value: minMinutes,
          actual_value: Math.round(minutes),
          deviation_pct: null,
          description: `Engine idled for ${Math.round(minutes)} minutes (${new Date(runStart).toLocaleString()} → ${new Date(runEnd).toLocaleString()}).`,
          evidence: { idle: { start: runStart, end: runEnd, duration_minutes: Math.round(minutes) } },
        },
        `${vehicleId}:EXCESSIVE_IDLING:${hourBucket}`,
      ),
    );
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isIdling = row.engine_on === true && (row.speed_kmh ?? 0) <= 1;

    if (!isIdling) {
      flushRun();
      runStart = null;
      runEnd = null;
      continue;
    }

    if (runStart && runEnd) {
      const gapMinutes = (new Date(row.recorded_at).getTime() - new Date(runEnd).getTime()) / 60000;
      if (gapMinutes > IDLING_MAX_GAP_MINUTES) {
        flushRun();
        runStart = row.recorded_at;
      }
    } else {
      runStart = row.recorded_at;
    }
    runEnd = row.recorded_at;
  }
  flushRun();

  return anomalies;
}

export async function detectFuelAnomaliesForAllVehicles(supabase: SupabaseClient): Promise<DetectedAnomaly[]> {
  const [ruleConfig, { data: vehicles }] = await Promise.all([
    loadRuleConfig(supabase),
    supabase.from("vehicles").select("id"),
  ]);
  const [perVehicle, duplicates, idling] = await Promise.all([
    Promise.all((vehicles || []).map((v: any) => detectFuelAnomaliesForVehicle(supabase, v.id, ruleConfig))),
    detectDuplicateReceiptAnomalies(supabase, ruleConfig),
    Promise.all((vehicles || []).map((v: any) => detectIdlingAnomalies(supabase, v.id, ruleConfig))),
  ]);
  return [...perVehicle.flat(), ...duplicates, ...idling.flat()];
}

/**
 * Inserts newly-detected anomalies, relying on the dedupe_key unique index
 * to silently skip ones already flagged from a prior scan (fuel_log_id +
 * rule for purchase-tied findings; vehicle + rule + hour-bucket for
 * vehicle/time-window findings like idling). Returns only the anomalies
 * that were actually new.
 */
export async function persistFuelAnomalies(
  supabase: SupabaseClient,
  anomalies: DetectedAnomaly[],
): Promise<DetectedAnomaly[]> {
  if (anomalies.length === 0) return [];
  const { data, error } = await supabase
    .from("fuel_anomalies")
    .upsert(anomalies, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("dedupe_key");
  if (error) throw error;
  const inserted = new Set((data || []).map((d: any) => d.dedupe_key));
  return anomalies.filter((a) => inserted.has(a.dedupe_key));
}
