/**
 * Calvary Connect — Event-Driven Architecture
 *
 * CloudEvents-compatible event bus abstraction.
 * Currently implemented as a lightweight in-process emitter backed by Firestore
 * for async fan-out via Cloud Functions triggers.
 *
 * In Phase 2, replace `publishToFirestore` with a real Google Pub/Sub client.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ─── Event Type Registry ────────────────────────────────────────────────────

export type CalvaryEventType =
  // Trip events
  | 'com.calvary.trip.created'
  | 'com.calvary.trip.status.changed'
  | 'com.calvary.trip.completed'
  | 'com.calvary.trip.cancelled'
  // Driver events
  | 'com.calvary.driver.location.updated'
  | 'com.calvary.driver.offline'
  | 'com.calvary.driver.breakdown.reported'
  // Fleet events
  | 'com.calvary.vehicle.added'
  | 'com.calvary.vehicle.status.changed'
  | 'com.calvary.vehicle.maintenance.due'
  // Finance events
  | 'com.calvary.expense.created'
  | 'com.calvary.expense.approved'
  | 'com.calvary.expense.rejected'
  | 'com.calvary.fuel.request.approved'
  | 'com.calvary.invoice.generated'
  // Inventory events
  | 'com.calvary.inventory.low_stock'
  | 'com.calvary.inventory.out_of_stock'
  | 'com.calvary.parts.request.created'
  | 'com.calvary.parts.request.approved'
  // Maintenance events
  | 'com.calvary.maintenance.started'
  | 'com.calvary.maintenance.completed';

// ─── CloudEvents-compatible envelope ────────────────────────────────────────

export interface CalvaryEvent<T = Record<string, unknown>> {
  /** CloudEvents spec version */
  specversion: '1.0';
  /** Unique event ID */
  id: string;
  /** Event source (service that produced the event) */
  source: string;
  /** Event type — namespaced reverse-DNS */
  type: CalvaryEventType;
  /** ISO 8601 timestamp */
  time: string;
  /** Content type of the data payload */
  datacontenttype: 'application/json';
  /** Tenant ID for multi-tenant isolation */
  tenantid: string;
  /** Event payload */
  data: T;
}

// ─── Typed Payloads ──────────────────────────────────────────────────────────

export interface TripCreatedPayload {
  tripId: string;
  driverId: string;
  truckId: string;
  customerId: string;
  origin: string;
  destination: string;
  scheduledStartTime?: string;
}

export interface TripStatusChangedPayload {
  tripId: string;
  driverId: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
}

export interface TripCompletedPayload {
  tripId: string;
  driverId: string;
  truckId: string;
  customerId: string;
  distanceKm: number;
  deliveredAt: string;
}

export interface BreakdownReportedPayload {
  tripId: string;
  driverId: string;
  truckId: string;
  location: { lat: number; lng: number };
  issueDescription: string;
  severity: 'minor' | 'major' | 'critical';
  reportedAt: string;
}

export interface ExpenseApprovedPayload {
  expenseId: string;
  amount: number;
  category: string;
  approvedByUserId: string;
  linkedTripId?: string;
}

export interface LowStockPayload {
  itemId: string;
  itemName: string;
  quantityAvailable: number;
  reorderLevel: number;
}

// ─── Event Publisher ─────────────────────────────────────────────────────────

/**
 * Creates a properly-structured CloudEvent envelope.
 */
function createEvent<T>(
  type: CalvaryEventType,
  source: string,
  data: T,
  tenantId = 'default'
): CalvaryEvent<T> {
  return {
    specversion: '1.0',
    id: crypto.randomUUID(),
    source: `calvary-connect/${source}`,
    type,
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    tenantid: tenantId,
    data,
  };
}

/**
 * Publishes an event to the Firestore `events` collection.
 * Cloud Functions listen on this collection and fan-out to downstream services.
 *
 * In Phase 2: replace with `@google-cloud/pubsub` client.
 */
async function publishToFirestore<T>(event: CalvaryEvent<T>): Promise<void> {
  try {
    // Lazy import to avoid SSR issues
    const { initializeFirebase } = await import('@/firebase/index');
    const { firestore } = initializeFirebase();
    await addDoc(collection(firestore, 'events'), {
      ...event,
      _publishedAt: serverTimestamp(),
      _processed: false,
    });
  } catch (err) {
    console.error(`[EventBus] Failed to publish event ${event.type}:`, err);
    // Events must not crash the main flow — log and continue
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const EventBus = {
  /** Publish any typed CalvaryEvent */
  async publish<T>(
    type: CalvaryEventType,
    source: string,
    data: T,
    tenantId?: string
  ): Promise<void> {
    const event = createEvent(type, source, data, tenantId);
    await publishToFirestore(event);
  },

  // ── Convenience methods for common events ─────────────────────────────

  async tripCreated(payload: TripCreatedPayload, tenantId?: string) {
    return this.publish('com.calvary.trip.created', 'trips', payload, tenantId);
  },

  async tripStatusChanged(payload: TripStatusChangedPayload, tenantId?: string) {
    return this.publish('com.calvary.trip.status.changed', 'trips', payload, tenantId);
  },

  async tripCompleted(payload: TripCompletedPayload, tenantId?: string) {
    return this.publish('com.calvary.trip.completed', 'trips', payload, tenantId);
  },

  async breakdownReported(payload: BreakdownReportedPayload, tenantId?: string) {
    return this.publish('com.calvary.driver.breakdown.reported', 'driver', payload, tenantId);
  },

  async expenseApproved(payload: ExpenseApprovedPayload, tenantId?: string) {
    return this.publish('com.calvary.expense.approved', 'finance', payload, tenantId);
  },

  async inventoryLowStock(payload: LowStockPayload, tenantId?: string) {
    return this.publish('com.calvary.inventory.low_stock', 'inventory', payload, tenantId);
  },
};
