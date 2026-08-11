// Server-safe prompt builder for AI dispatch suggestions.
// Mirrors company-chat.server.ts's shape: a plain exported function, no
// client-only imports, safe to import from an API route.

import type { DispatchContext } from "@/lib/ai-database-context";
import { isVehicleAvailable } from "@/lib/fleet/vehicle-status";

export interface DispatchTripInput {
  origin: string;
  destination: string;
  cargoDescription?: string;
  cargoWeightTons?: number;
}

export function buildDispatchPrompt(trip: DispatchTripInput, context: DispatchContext): string {
  const availableVehicles = context.vehicles.filter(
    (v) => isVehicleAvailable(v.status) && !context.busyVehicleIds.has(v.id),
  );
  const availableDrivers = context.drivers.filter((d) => !context.busyDriverIds.has(d.id));

  const vehicleLines = availableVehicles.length > 0
    ? availableVehicles
        .map((v) => {
          const capacity = v.cargo_capacity_tons != null ? `${v.cargo_capacity_tons}t capacity` : "capacity unknown";
          return `- ${v.plate_number} · ${v.type ?? "unknown type"}${v.trailer_sub_type ? ` (${v.trailer_sub_type})` : ""} · ${capacity} · id=${v.id}`;
        })
        .join("\n")
    : "(no available vehicles)";

  const driverLines = availableDrivers.length > 0
    ? availableDrivers
        .map((d) => {
          const loc = d.location
            ? `location ${d.location.status.toLowerCase()} (last update ${d.location.lastUpdate || "unknown"})`
            : "no GPS reporting";
          const scoreLabel = d.performanceScore !== null ? `${d.performanceScore}/5` : "no reviews yet";
          return `- ${d.name} · license ${d.license_class ?? "unknown"} · performance score ${scoreLabel} · ${loc} · id=${d.id}`;
        })
        .join("\n")
    : "(no available drivers)";

  return `
You are the dispatch planner for Calvary Investment Co. Ltd, a road freight
company in Tanzania. A new trip needs a driver and vehicle assigned.

=== TRIP ===
Origin: ${trip.origin}
Destination: ${trip.destination}
Cargo: ${trip.cargoDescription || "not specified"}
Cargo weight: ${trip.cargoWeightTons != null ? `${trip.cargoWeightTons} tons` : "not specified"}

=== AVAILABLE VEHICLES ===
${vehicleLines}

=== AVAILABLE DRIVERS ===
${driverLines}

=== INSTRUCTIONS ===
Rank up to 3 driver+vehicle pairings for this trip, considering:
1. Cargo weight vs vehicle capacity (numeric fact when both are known — flag
   in caveats if capacity or weight is missing, since the match is then a
   guess, not a verified fit).
2. Cargo description vs vehicle type/trailer suitability (reason over the
   free-text description — it is not a fixed taxonomy).
3. Driver performance score — treat "no reviews yet" as neutral (unknown),
   not as a penalty or a bonus.
4. Driver location freshness — prefer LIVE/DELAYED over STALE, but do not
   exclude a driver just for lacking GPS; note it as a caveat instead.

Respond with STRICT JSON only, no markdown, no commentary, in exactly this
shape:
{"suggestions":[{"driverId":"...","vehicleId":"...","score":0-100,"reasoning":"..."}],"caveats":["..."]}
If no available drivers or vehicles exist, return an empty suggestions array
and explain why in caveats.
`.trim();
}
