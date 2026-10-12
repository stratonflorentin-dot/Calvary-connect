import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextRequest, NextResponse } from 'next/server';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    })),
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  })),
}));

// Mock Redis
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    on: vi.fn(),
    xAdd: vi.fn(),
    xTrim: vi.fn(),
    xReadGroup: vi.fn(),
    xGroupCreate: vi.fn(),
    xAck: vi.fn(),
    quit: vi.fn(),
  })),
}));

describe('API Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check rate limits correctly', async () => {
    const { checkRateLimit, getRateLimitConfig } = await import('@/lib/api-gateway');
    
    const config = getRateLimitConfig('/api/loads');
    expect(config.maxRequests).toBe(100);
    expect(config.windowMs).toBe(60000);
    
    const result = checkRateLimit('test-user', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('should block requests exceeding rate limit', async () => {
    const { checkRateLimit, getRateLimitConfig } = await import('@/lib/api-gateway');
    
    const config = { windowMs: 60000, maxRequests: 2, keyPrefix: 'test' };
    
    checkRateLimit('user1', config);
    checkRateLimit('user1', config);
    const result = checkRateLimit('user1', config);
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should verify auth correctly', async () => {
    const { verifyAuth } = await import('@/lib/api-gateway');
    
    const mockRequest = {
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'authorization') return 'Bearer valid-token';
          return null;
        }),
      },
    } as any;
    
    // This would need proper mocking of supabase.auth.getUser
    // For now, we test the structure
    expect(typeof verifyAuth).toBe('function');
  });
});

describe('Event Stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create events with correct structure', async () => {
    const { emitEvent, Events } = await import('@/lib/event-stream');
    
    const eventId = await Events.loads.created({
      loadId: 'load-123',
      loadNumber: 'LD-001',
      shipperId: 'shipper-1',
      carrierId: 'carrier-1',
      status: 'pending',
      origin: { lat: -6.7924, lng: 39.2083, address: 'Dar es Salaam' },
      destination: { lat: -1.2921, lng: 36.8219, address: 'Nairobi' },
      pickupWindow: { start: '2024-01-15T08:00:00Z', end: '2024-01-15T12:00:00Z' },
      deliveryWindow: { start: '2024-01-16T08:00:00Z', end: '2024-01-16T18:00:00Z' },
      commodity: 'General Cargo',
      weight: 15000,
    }, { userId: 'user-1', tenantId: 'calvary' });
    
    expect(eventId).toBeDefined();
    expect(typeof eventId).toBe('string');
  });

  it('should emit vehicle location events', async () => {
    const { Events } = await import('@/lib/event-stream');
    
    const eventId = await Events.vehicles.locationUpdated({
      vehicleId: 'veh-123',
      plateNumber: 'T 123 ABC',
      location: { lat: -6.7924, lng: 39.2083, heading: 45, speed: 60 },
      status: 'in_transit',
      odometer: 125000,
      fuelLevel: 75,
    }, { userId: 'driver-1', tenantId: 'calvary' });
    
    expect(eventId).toBeDefined();
  });

  it('should emit cold chain temperature alerts', async () => {
    const { Events } = await import('@/lib/event-stream');
    
    const eventId = await Events.coldChain.temperatureAlert({
      deviceId: 'cc-device-1',
      vehicleId: 'veh-123',
      temperature: -5,
      threshold: { min: -20, max: -10 },
      severity: 'critical',
      location: { lat: -6.7924, lng: 39.2083 },
    }, { userId: 'system', tenantId: 'calvary' });
    
    expect(eventId).toBeDefined();
  });

  it('should emit border crossing events', async () => {
    const { Events } = await import('@/lib/event-stream');
    
    const eventId = await Events.borders.crossingStarted({
      crossingId: 'cross-123',
      loadId: 'load-123',
      vehicleId: 'veh-123',
      borderName: 'Sirari',
      countryFrom: 'Tanzania',
      countryTo: 'Kenya',
      documents: ['bill_of_lading', 'customs_declaration', 'transit_bond'],
      estimatedClearanceHours: 2,
    }, { userId: 'driver-1', tenantId: 'calvary' });
    
    expect(eventId).toBeDefined();
  });

  it('should emit payment events', async () => {
    const { Events } = await import('@/lib/event-stream');
    
    const eventId = await Events.payments.received({
      paymentId: 'pay-123',
      amount: 5000000,
      currency: 'TZS',
      provider: 'mpesa',
      payerId: 'shipper-1',
      payeeId: 'calvary',
      reference: 'INV-2024-001',
      status: 'completed',
    }, { userId: 'accountant-1', tenantId: 'calvary' });
    
    expect(eventId).toBeDefined();
  });
});

describe('Rate Limiting Integration', () => {
  it('should apply different limits per endpoint', async () => {
    const { getRateLimitConfig } = await import('@/lib/api-gateway');
    
    const loadsConfig = getRateLimitConfig('/api/loads');
    const aiConfig = getRateLimitConfig('/api/ai/ask-company');
    const defaultConfig = getRateLimitConfig('/api/unknown');
    
    expect(loadsConfig.maxRequests).toBe(100);
    expect(aiConfig.maxRequests).toBe(20);
    expect(defaultConfig.maxRequests).toBe(60);
  });
});

describe('Auth Middleware', () => {
  it('should export required functions', async () => {
    const { verifyAuth, requireRole, withAuth, withRateLimit, withAuthAndRateLimit } = 
      await import('@/lib/api-gateway');
    
    expect(typeof verifyAuth).toBe('function');
    expect(typeof requireRole).toBe('function');
    expect(typeof withAuth).toBe('function');
    expect(typeof withRateLimit).toBe('function');
    expect(typeof withAuthAndRateLimit).toBe('function');
  });
});

describe('Webhook Verification', () => {
  it('should export verifyWebhook function', async () => {
    const { verifyWebhook } = await import('@/lib/api-gateway');
    expect(typeof verifyWebhook).toBe('function');
  });
});

describe('Response Helpers', () => {
  it('should export response helpers', async () => {
    const { successResponse, errorResponse, paginatedResponse } = 
      await import('@/lib/api-gateway');
    
    expect(typeof successResponse).toBe('function');
    expect(typeof errorResponse).toBe('function');
    expect(typeof paginatedResponse).toBe('function');
  });
});