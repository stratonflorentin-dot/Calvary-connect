import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuthAndRateLimit, successResponse, errorResponse } from '@/lib/api-gateway';
import { Events } from '@/lib/event-stream';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/loads/[id] - Get single load with full details
export const GET = withAuthAndRateLimit(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const { data: load, error } = await supabase
      .from('loads')
      .select(`
        *,
        shipper:shippers(id, name, email, phone, address),
        carrier:carriers(id, name, dot_number, safety_rating, contact_person, contact_phone, contact_email),
        driver:driver_profiles(id, user_id, license_number, license_expiry, endorsements),
        stops:load_stops(*, location:locations(*)),
        documents:load_documents(*),
        tracking:load_tracking(*),
        messages:load_messages(*, sender:user_profiles(name, avatar_url))
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Load not found', 404);
      }
      throw error;
    }

    // Check permissions
    if (user.profile?.role === 'DRIVER' && load.driver_id !== user.id) {
      return errorResponse('Not authorized to view this load', 403);
    }
    if (user.profile?.role === 'CARRIER' && load.carrier_id !== user.profile.id) {
      return errorResponse('Not authorized to view this load', 403);
    }
    if (user.profile?.role === 'SHIPPER' && load.shipper_id !== user.profile.id) {
      return errorResponse('Not authorized to view this load', 403);
    }

    return successResponse(load);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to fetch load', 500);
  }
}, ['CEO', 'ADMIN', 'OPERATOR', 'DISPATCHER', 'DRIVER', 'CARRIER', 'SHIPPER', 'ACCOUNTANT']);

// PUT /api/loads/[id] - Update load
export const PUT = withAuthAndRateLimit(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Get current load for event emission
    const { data: currentLoad } = await supabase
      .from('loads')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentLoad) {
      return errorResponse('Load not found', 404);
    }

    // Check permissions
    if (user.profile?.role === 'DRIVER' && currentLoad.driver_id !== user.id) {
      return errorResponse('Not authorized to update this load', 403);
    }
    if (user.profile?.role === 'CARRIER' && currentLoad.carrier_id !== user.profile.id) {
      return errorResponse('Not authorized to update this load', 403);
    }
    if (user.profile?.role === 'SHIPPER' && currentLoad.shipper_id !== user.profile.id) {
      return errorResponse('Not authorized to update this load', 403);
    }

    // Fields that can be updated
    const allowedFields = [
      'carrier_id', 'driver_id', 'status', 'rate', 'rate_type',
      'accessorials', 'special_instructions', 'pickup_window_start',
      'pickup_window_end', 'delivery_window_start', 'delivery_window_end',
      'actual_pickup', 'actual_delivery', 'pod_data', 'cancelled_reason'
    ];

    const updates: any = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Handle status transitions
    if (body.status && body.status !== currentLoad.status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['assigned', 'cancelled'],
        assigned: ['in_transit', 'cancelled'],
        in_transit: ['picked_up', 'delayed', 'cancelled'],
        picked_up: ['in_transit', 'delivered', 'delayed'],
        delivered: [],
        delayed: ['in_transit', 'cancelled'],
        cancelled: [],
      };

      if (!validTransitions[currentLoad.status]?.includes(body.status)) {
        return errorResponse(`Invalid status transition from ${currentLoad.status} to ${body.status}`, 400);
      }

      // Set timestamps based on status
      if (body.status === 'picked_up' && !updates.actual_pickup) {
        updates.actual_pickup = new Date().toISOString();
      }
      if (body.status === 'delivered' && !updates.actual_delivery) {
        updates.actual_delivery = new Date().toISOString();
      }
    }

    const { data: load, error } = await supabase
      .from('loads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Emit event
    await Events.loads.updated({
      loadId: load.id,
      loadNumber: load.load_number,
      shipperId: load.shipper_id,
      carrierId: load.carrier_id,
      status: load.status,
      origin: { lat: load.origin_lat, lng: load.origin_lng, address: load.origin_address },
      destination: { lat: load.destination_lat, lng: load.destination_lng, address: load.destination_address },
      pickupWindow: { start: load.pickup_window_start, end: load.pickup_window_end },
      deliveryWindow: { start: load.delivery_window_start, end: load.delivery_window_end },
      commodity: load.commodity,
      weight: load.weight,
      temperatureRequired: load.temperature_required,
    }, { userId: user.id, tenantId: 'calvary', correlationId: currentLoad.id });

    return successResponse(load);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to update load', 500);
  }
}, ['CEO', 'ADMIN', 'OPERATOR', 'DISPATCHER', 'DRIVER', 'CARRIER', 'SHIPPER']);

// DELETE /api/loads/[id] - Cancel load (soft delete)
export const DELETE = withAuthAndRateLimit(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const { data: currentLoad } = await supabase
      .from('loads')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentLoad) {
      return errorResponse('Load not found', 404);
    }

    // Check permissions
    if (user.profile?.role === 'DRIVER' && currentLoad.driver_id !== user.id) {
      return errorResponse('Not authorized to cancel this load', 403);
    }
    if (user.profile?.role === 'CARRIER' && currentLoad.carrier_id !== user.profile.id) {
      return errorResponse('Not authorized to cancel this load', 403);
    }
    if (user.profile?.role === 'SHIPPER' && currentLoad.shipper_id !== user.profile.id) {
      return errorResponse('Not authorized to cancel this load', 403);
    }

    // Only allow cancellation of pending/assigned loads
    if (!['pending', 'assigned'].includes(currentLoad.status)) {
      return errorResponse(`Cannot cancel load in status: ${currentLoad.status}`, 400);
    }

    const { error } = await supabase
      .from('loads')
      .update({ status: 'cancelled', cancelled_reason: 'Cancelled by user', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Emit event
    await Events.loads.cancelled({
      loadId: id,
      loadNumber: currentLoad.load_number,
      shipperId: currentLoad.shipper_id,
      carrierId: currentLoad.carrier_id,
      status: 'cancelled',
      origin: { lat: currentLoad.origin_lat, lng: currentLoad.origin_lng, address: currentLoad.origin_address },
      destination: { lat: currentLoad.destination_lat, lng: currentLoad.destination_lng, address: currentLoad.destination_address },
      pickupWindow: { start: currentLoad.pickup_window_start, end: currentLoad.pickup_window_end },
      deliveryWindow: { start: currentLoad.delivery_window_start, end: currentLoad.delivery_window_end },
      commodity: currentLoad.commodity,
      weight: currentLoad.weight,
      temperatureRequired: currentLoad.temperature_required,
    }, { userId: user.id, tenantId: 'calvary' });

    return successResponse({ message: 'Load cancelled successfully' });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to cancel load', 500);
  }
}, ['CEO', 'ADMIN', 'OPERATOR', 'DISPATCHER', 'DRIVER', 'CARRIER', 'SHIPPER']);
