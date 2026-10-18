import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuthAndRateLimit, successResponse, errorResponse, paginatedResponse } from '@/lib/api-gateway';
import { Events } from '@/lib/event-stream';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/loads - List loads with filters
export const GET = withAuthAndRateLimit(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status');
    const shipperId = searchParams.get('shipper_id');
    const carrierId = searchParams.get('carrier_id');
    const driverId = searchParams.get('driver_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    let query = supabase
      .from('loads')
      .select(`
        *,
        shipper:shippers(id, name, email, phone),
        carrier:carriers(id, name, dot_number, safety_rating),
        driver:driver_profiles(id, user_id, license_number),
        stops:load_stops(*, location:locations(*))
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (user.profile?.role === 'DRIVER') {
      query = query.eq('driver_id', user.id);
    } else if (user.profile?.role === 'CARRIER') {
      query = query.eq('carrier_id', user.profile.id);
    } else if (user.profile?.role === 'SHIPPER') {
      query = query.eq('shipper_id', user.profile.id);
    }

    if (status) query = query.eq('status', status);
    if (shipperId) query = query.eq('shipper_id', shipperId);
    if (carrierId) query = query.eq('carrier_id', carrierId);
    if (driverId) query = query.eq('driver_id', driverId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    if (search) {
      query = query.or(`load_number.ilike.%${search}%,reference_number.ilike.%${search}%,commodity.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return paginatedResponse(data || [], page, limit, count || 0);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to fetch loads', 500);
  }
}, ['CEO', 'ADMIN', 'OPERATOR', 'DISPATCHER', 'DRIVER', 'CARRIER', 'SHIPPER', 'ACCOUNTANT']);

// POST /api/loads - Create new load
export const POST = withAuthAndRateLimit(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['shipper_id', 'origin', 'destination', 'pickup_window', 'delivery_window', 'commodity', 'weight'];
    for (const field of required) {
      if (!body[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }

    // Generate load number
    const { data: lastLoad } = await supabase
      .from('loads')
      .select('load_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const lastNumber = lastLoad?.load_number ? parseInt(lastLoad.load_number.replace('LD-', '')) : 0;
    const loadNumber = `LD-${String(lastNumber + 1).padStart(6, '0')}`;

    // Create load
    const { data: load, error } = await supabase
      .from('loads')
      .insert({
        load_number: loadNumber,
        reference_number: body.reference_number,
        shipper_id: body.shipper_id,
        carrier_id: body.carrier_id,
        driver_id: body.driver_id,
        status: 'pending',
        commodity: body.commodity,
        weight: body.weight,
        volume: body.volume,
        dimensions: body.dimensions,
        temperature_required: body.temperature_required,
        hazardous: body.hazardous || false,
        hazmat_class: body.hazmat_class,
        pickup_window_start: body.pickup_window.start,
        pickup_window_end: body.pickup_window.end,
        delivery_window_start: body.delivery_window.start,
        delivery_window_end: body.delivery_window.end,
        origin_address: body.origin.address,
        origin_lat: body.origin.lat,
        origin_lng: body.origin.lng,
        destination_address: body.destination.address,
        destination_lat: body.destination.lat,
        destination_lng: body.destination.lng,
        rate: body.rate,
        rate_type: body.rate_type || 'per_mile',
        accessorials: body.accessorials || [],
        special_instructions: body.special_instructions,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Create stops
    if (body.stops && body.stops.length > 0) {
      const stops = body.stops.map((stop: any, index: number) => ({
        load_id: load.id,
        sequence: index + 1,
        location_id: stop.location_id,
        type: stop.type, // 'pickup' | 'delivery'
        window_start: stop.window_start,
        window_end: stop.window_end,
        contact_name: stop.contact_name,
        contact_phone: stop.contact_phone,
        instructions: stop.instructions,
      }));

      const { error: stopsError } = await supabase
        .from('load_stops')
        .insert(stops);

      if (stopsError) throw stopsError;
    }

    // Emit event
    await Events.loads.created({
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
    }, { userId: user.id, tenantId: 'calvary' });

    return successResponse(load, 201);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to create load', 500);
  }
}, ['CEO', 'ADMIN', 'OPERATOR', 'DISPATCHER', 'SHIPPER']);