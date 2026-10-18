import { createClient } from 'redis';

// Redis client for event streaming
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });
    
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));
    
    await redisClient.connect();
  }
  return redisClient;
}

// Event types
export type EventType = 
  | 'load.created' | 'load.updated' | 'load.assigned' | 'load.picked_up' | 'load.delivered' | 'load.cancelled'
  | 'vehicle.location_updated' | 'vehicle.status_changed' | 'vehicle.maintenance_due'
  | 'driver.status_changed' | 'driver.location_updated' | 'driver.hos_violation'
  | 'warehouse.inventory_changed' | 'warehouse.order_picked' | 'warehouse.order_packed'
  | 'cold_chain.temperature_alert' | 'cold_chain.device_offline'
  | 'border.crossing_started' | 'border.crossing_completed' | 'border.document_required'
  | 'payment.received' | 'payment.failed' | 'invoice.generated' | 'invoice.paid'
  | 'maintenance.scheduled' | 'maintenance.completed' | 'maintenance.overdue'
  | 'fuel.purchased' | 'fuel.theft_detected'
  | 'sgr.train_arrived' | 'sgr.container_loaded' | 'sgr.container_unloaded';

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  tenantId: string;
}

export interface LoadEvent extends BaseEvent {
  eventType: 'load.created' | 'load.updated' | 'load.assigned' | 'load.picked_up' | 'load.delivered' | 'load.cancelled';
  payload: {
    loadId: string;
    loadNumber: string;
    shipperId: string;
    carrierId?: string;
    status: string;
    origin: { lat: number; lng: number; address: string };
    destination: { lat: number; lng: number; address: string };
    pickupWindow: { start: string; end: string };
    deliveryWindow: { start: string; end: string };
    commodity: string;
    weight: number;
    temperatureRequired?: { min: number; max: number };
  };
}

export interface VehicleEvent extends BaseEvent {
  eventType: 'vehicle.location_updated' | 'vehicle.status_changed' | 'vehicle.maintenance_due';
  payload: {
    vehicleId: string;
    plateNumber: string;
    location?: { lat: number; lng: number; heading: number; speed: number };
    status?: 'available' | 'in_transit' | 'maintenance' | 'offline';
    odometer?: number;
    fuelLevel?: number;
    engineHours?: number;
  };
}

export interface DriverEvent extends BaseEvent {
  eventType: 'driver.status_changed' | 'driver.location_updated' | 'driver.hos_violation';
  payload: {
    driverId: string;
    driverName: string;
    status?: 'available' | 'on_duty' | 'driving' | 'off_duty' | 'sleeper_berth';
    location?: { lat: number; lng: number };
    hosRemaining?: { drive: number; onDuty: number; cycle: number };
    violationType?: string;
  };
}

export interface ColdChainEvent extends BaseEvent {
  eventType: 'cold_chain.temperature_alert' | 'cold_chain.device_offline';
  payload: {
    deviceId: string;
    vehicleId?: string;
    warehouseZoneId?: string;
    temperature: number;
    threshold: { min: number; max: number };
    severity: 'warning' | 'critical';
    location?: { lat: number; lng: number };
  };
}

export interface BorderEvent extends BaseEvent {
  eventType: 'border.crossing_started' | 'border.crossing_completed' | 'border.document_required';
  payload: {
    crossingId: string;
    loadId: string;
    vehicleId: string;
    borderName: string;
    countryFrom: string;
    countryTo: string;
    documents?: string[];
    estimatedClearanceHours?: number;
    actualClearanceHours?: number;
  };
}

export interface PaymentEvent extends BaseEvent {
  eventType: 'payment.received' | 'payment.failed' | 'invoice.generated' | 'invoice.paid';
  payload: {
    paymentId?: string;
    invoiceId?: string;
    amount: number;
    currency: string;
    provider: 'mpesa' | 'tigo_pesa' | 'airtel_money' | 'bank' | 'cash';
    payerId: string;
    payeeId: string;
    reference: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
  };
}

export type AppEvent = LoadEvent | VehicleEvent | DriverEvent | ColdChainEvent | BorderEvent | PaymentEvent;

// Stream names
const STREAMS = {
  loads: 'events:loads',
  vehicles: 'events:vehicles',
  drivers: 'events:drivers',
  warehouse: 'events:warehouse',
  coldChain: 'events:cold_chain',
  borders: 'events:borders',
  payments: 'events:payments',
  maintenance: 'events:maintenance',
  fuel: 'events:fuel',
  sgr: 'events:sgr',
  all: 'events:all',
} as const;

function getStreamForEvent(eventType: EventType): string {
  if (eventType.startsWith('load.')) return STREAMS.loads;
  if (eventType.startsWith('vehicle.')) return STREAMS.vehicles;
  if (eventType.startsWith('driver.')) return STREAMS.drivers;
  if (eventType.startsWith('warehouse.')) return STREAMS.warehouse;
  if (eventType.startsWith('cold_chain.')) return STREAMS.coldChain;
  if (eventType.startsWith('border.')) return STREAMS.borders;
  if (eventType.startsWith('payment.') || eventType.startsWith('invoice.')) return STREAMS.payments;
  if (eventType.startsWith('maintenance.')) return STREAMS.maintenance;
  if (eventType.startsWith('fuel.')) return STREAMS.fuel;
  if (eventType.startsWith('sgr.')) return STREAMS.sgr;
  return STREAMS.all;
}

// Publish event to Redis Stream
async function publishEvent(event: AppEvent): Promise<string | null> {
  try {
    const client = await getRedisClient();
    const stream = getStreamForEvent(event.eventType);
    
    const eventData = {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      correlationId: event.correlationId || '',
      causationId: event.causationId || '',
      userId: event.userId || '',
      tenantId: event.tenantId,
      payload: JSON.stringify(event.payload),
    };
    
    const messageId = await client.xAdd(stream, '*', eventData);
    
    // Also publish to 'all' stream for global consumers
    await client.xAdd(STREAMS.all, '*', eventData);
    
    // Trim streams to prevent unbounded growth (keep last 10000 events)
    await client.xTrim(stream, 'MAXLEN', 10000);
    await client.xTrim(STREAMS.all, 'MAXLEN', 50000);
    
    return messageId;
  } catch (error) {
    console.error('Failed to publish event:', error);
    return null;
  }
}

// Helper to create and publish event
export async function emitEvent(
  eventType: EventType,
  payload: AppEvent['payload'],
  options: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
  } = {}
): Promise<string | null> {
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    correlationId: options.correlationId,
    causationId: options.causationId,
    userId: options.userId,
    tenantId: options.tenantId || 'default',
    payload,
  } as AppEvent;
  
  return publishEvent(event);
}

// Consumer group management
async function createConsumerGroup(stream: string, groupName: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.xGroupCreate(stream, groupName, '0', { MKSTREAM: true });
  } catch (error: any) {
    if (!error.message.includes('BUSYGROUP')) {
      throw error;
    }
  }
}

// Consume events from stream
async function consumeEvents(
  stream: string,
  groupName: string,
  consumerName: string,
  handler: (event: AppEvent) => Promise<void>,
  options: { count?: number; blockMs?: number } = {}
): Promise<void> {
  const client = await getRedisClient();
  const { count = 10, blockMs = 5000 } = options;
  
  await createConsumerGroup(stream, groupName);
  
  while (true) {
    try {
      const results = await client.xReadGroup(
        groupName,
        consumerName,
        { key: stream, id: '>' },
        { COUNT: count, BLOCK: blockMs }
      );
      
      if (!results) continue;
      
      for (const { messages } of results) {
        for (const message of messages) {
          try {
            const event: AppEvent = {
              eventId: message.message.eventId,
              eventType: message.message.eventType as AppEvent['eventType'],
              timestamp: message.message.timestamp,
              correlationId: message.message.correlationId || undefined,
              causationId: message.message.causationId || undefined,
              userId: message.message.userId || undefined,
              tenantId: message.message.tenantId,
              payload: JSON.parse(message.message.payload),
            };
            
            await handler(event);
            await client.xAck(stream, groupName, message.id);
          } catch (error) {
            console.error('Error processing event:', error);
            // Don't ack - will be redelivered
          }
        }
      }
    } catch (error) {
      console.error('Consumer error:', error);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Specific event emitters for common operations
export const Events = {
  loads: {
    created: (payload: LoadEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.created', payload, opts),
    updated: (payload: LoadEvent['payload'], opts?: { correlationId?: string; causationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.updated', payload, opts),
    assigned: (payload: LoadEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.assigned', payload, opts),
    pickedUp: (payload: LoadEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.picked_up', payload, opts),
    delivered: (payload: LoadEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.delivered', payload, opts),
    cancelled: (payload: LoadEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('load.cancelled', payload, opts),
  },
  
  vehicles: {
    locationUpdated: (payload: VehicleEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('vehicle.location_updated', payload, opts),
    statusChanged: (payload: VehicleEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('vehicle.status_changed', payload, opts),
    maintenanceDue: (payload: VehicleEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('vehicle.maintenance_due', payload, opts),
  },
  
  drivers: {
    statusChanged: (payload: DriverEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('driver.status_changed', payload, opts),
    locationUpdated: (payload: DriverEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('driver.location_updated', payload, opts),
    hosViolation: (payload: DriverEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('driver.hos_violation', payload, opts),
  },
  
  coldChain: {
    temperatureAlert: (payload: ColdChainEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('cold_chain.temperature_alert', payload, opts),
    deviceOffline: (payload: ColdChainEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('cold_chain.device_offline', payload, opts),
  },
  
  borders: {
    crossingStarted: (payload: BorderEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('border.crossing_started', payload, opts),
    crossingCompleted: (payload: BorderEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('border.crossing_completed', payload, opts),
    documentRequired: (payload: BorderEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('border.document_required', payload, opts),
  },
  
  payments: {
    received: (payload: PaymentEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('payment.received', payload, opts),
    failed: (payload: PaymentEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('payment.failed', payload, opts),
    invoiceGenerated: (payload: PaymentEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('invoice.generated', payload, opts),
    invoicePaid: (payload: PaymentEvent['payload'], opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('invoice.paid', payload, opts),
  },
  
  maintenance: {
    scheduled: (payload: { vehicleId: string; type: string; dueDate: string; dueOdometer: number; estimatedCost: number }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('maintenance.scheduled', payload as any, opts),
    completed: (payload: { vehicleId: string; type: string; cost: number; odometer: number; nextDueOdometer: number; nextDueDate: string }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('maintenance.completed', payload as any, opts),
    overdue: (payload: { vehicleId: string; type: string; daysOverdue: number; odometerOverdue: number }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('maintenance.overdue', payload as any, opts),
  },
  
  fuel: {
    purchased: (payload: { vehicleId: string; driverId: string; gallons: number; cost: number; location: string; odometer: number }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('fuel.purchased', payload as any, opts),
    theftDetected: (payload: { vehicleId: string; expectedGallons: number; actualGallons: number; discrepancy: number }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('fuel.theft_detected', payload as any, opts),
  },
  
  sgr: {
    trainArrived: (payload: { trainId: string; station: string; arrivalTime: string; containers: string[] }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('sgr.train_arrived', payload as any, opts),
    containerLoaded: (payload: { trainId: string; containerId: string; loadId: string }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('sgr.container_loaded', payload as any, opts),
    containerUnloaded: (payload: { trainId: string; containerId: string; loadId: string }, opts?: { correlationId?: string; userId?: string; tenantId?: string }) =>
      emitEvent('sgr.container_unloaded', payload as any, opts),
  },
};

// Graceful shutdown
async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
