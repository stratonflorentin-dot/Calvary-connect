// Driver allowance calculation based on Calvary logistics-specific rules

export interface TripForAllowance {
  id: string;
  distance?: number | string;
  estimated_time?: number | string;
  is_cross_border?: boolean;
  has_reefer?: boolean;
  cargo_type?: string;
  origin?: string;
  destination?: string;
}

/**
 * Calculate driver allowance based on trip parameters
 * Calvary formula:
 * - Base: 500 TZS
 * - Distance: +0.5 TZS per km
 * - Time: +100 TZS per hour
 * - Cross-border bonus: +1500 TZS
 * - Cold chain (reefer) bonus: +300 TZS
 * - Heavy cargo bonus: +500 TZS
 */
export function calculateDriverAllowance(trip: TripForAllowance): number {
  let baseAmount = 500;

  // Distance component
  if (trip.distance) {
    const distance = parseInt(String(trip.distance).replace(/[^0-9]/g, ''));
    if (!isNaN(distance)) {
      baseAmount += Math.floor(distance * 0.5);
    }
  }

  // Time component
  if (trip.estimated_time) {
    const hours = parseInt(String(trip.estimated_time).replace(/[^0-9]/g, ''));
    if (!isNaN(hours)) {
      baseAmount += hours * 100;
    }
  }

  // Cross-border bonus
  if (trip.is_cross_border) {
    baseAmount += 1500;
  }

  // Reefer/cold chain bonus
  if (trip.has_reefer || trip.cargo_type === 'REEFER' || trip.cargo_type === 'cold_chain') {
    baseAmount += 300;
  }

  // Heavy cargo bonus
  if (trip.cargo_type === 'LOWBED' || trip.cargo_type === 'heavy_equipment' || trip.cargo_type === 'machinery') {
    baseAmount += 500;
  }

  return baseAmount;
}

/**
 * Generate allowance reason/description for the trip
 */
export function generateAllowanceReason(trip: TripForAllowance): string {
  const parts: string[] = [];

  if (trip.is_cross_border) {
    parts.push('Cross-Border');
  } else {
    parts.push('Local');
  }

  if (trip.has_reefer || trip.cargo_type === 'REEFER') {
    parts.push('Cold Chain');
  }

  if (trip.cargo_type === 'LOWBED' || trip.cargo_type === 'heavy_equipment') {
    parts.push('Heavy Cargo');
  }

  const route = trip.origin && trip.destination
    ? `${trip.origin} → ${trip.destination}`
    : 'Trip';

  return parts.length > 0
    ? `${parts.join('/')} : ${route}`
    : route;
}

/**
 * Get allowance breakdown for display
 */
export function getAllowanceBreakdown(trip: TripForAllowance) {
  const baseAmount = 500;
  const distanceAmount = trip.distance
    ? Math.floor(parseInt(String(trip.distance).replace(/[^0-9]/g, '')) * 0.5)
    : 0;
  const timeAmount = trip.estimated_time
    ? parseInt(String(trip.estimated_time).replace(/[^0-9]/g, '')) * 100
    : 0;
  const crossBorderBonus = trip.is_cross_border ? 1500 : 0;
  const coldChainBonus = (trip.has_reefer || trip.cargo_type === 'REEFER') ? 300 : 0;
  const heavyCargoBonus = (trip.cargo_type === 'LOWBED' || trip.cargo_type === 'heavy_equipment') ? 500 : 0;

  return {
    base: baseAmount,
    distance: distanceAmount,
    time: timeAmount,
    crossBorder: crossBorderBonus,
    coldChain: coldChainBonus,
    heavyCargo: heavyCargoBonus,
    total: baseAmount + distanceAmount + timeAmount + crossBorderBonus + coldChainBonus + heavyCargoBonus
  };
}
