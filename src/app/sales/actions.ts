"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ─── Customer Actions ───────────────────────────────────────────────────

export async function saveCustomerAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;
  
  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("customers")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("customers")
      .insert([{ ...rest, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}

export async function deleteCustomerAction(id: string) {
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Trip & Booking Actions ──────────────────────────────────────────────

export async function saveTripAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;
  
  const mappedData = {
    origin: rest.origin,
    destination: rest.destination,
    driver_id: rest.driver_id,
    truck_id: rest.truck_id,
    cargo_type: rest.cargo_type,
    status: rest.status || 'PENDING',
    client_id: rest.client_id,
    booking_id: rest.booking_id,
    revenue: rest.revenue ? parseFloat(rest.revenue) : 0,
    date: rest.date || new Date().toISOString().split('T')[0],
  };

  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("trips")
      .update({ ...mappedData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("trips")
      .insert([{ ...mappedData, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}

export async function deleteTripAction(id: string) {
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin
    .from("trips")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Invoice Actions ────────────────────────────────────────────────────

export async function saveInvoiceAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;

  const mappedData = {
    invoice_number: rest.invoice_number,
    client_name: rest.client_name,
    client_id: rest.client_id,
    amount: parseFloat(rest.amount),
    due_date: rest.due_date,
    status: rest.status || 'draft',
    trip_id: rest.trip_id,
    items: rest.items || [],
    subtotal: rest.subtotal || parseFloat(rest.amount),
    total_amount: rest.total_amount || parseFloat(rest.amount),
    currency: rest.currency || 'TZS',
    issue_date: rest.issue_date || new Date().toISOString().split('T')[0],
  };

  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("invoices")
      .update({ ...mappedData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("invoices")
      .insert([{ ...mappedData, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}

export async function deleteInvoiceAction(id: string) {
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin
    .from("invoices")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Rate Sheet Actions ──────────────────────────────────────────────────

export async function saveRateSheetAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;

  const mappedData = {
    route_name: rest.route_name,
    origin: rest.origin,
    destination: rest.destination,
    service_type: rest.service_type || 'local_transport',
    container_20ft: parseFloat(rest.container_20ft || 0),
    container_40ft: parseFloat(rest.container_40ft || 0),
    loose_rate_mt: parseFloat(rest.loose_rate_mt || 0),
    transit_days: parseInt(rest.transit_days || 0),
    is_active: rest.is_active !== undefined ? rest.is_active : true,
  };

  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("rate_sheets")
      .update(mappedData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("rate_sheets")
      .insert([mappedData])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}

export async function deleteRateSheetAction(id: string) {
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin
    .from("rate_sheets")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Quotation Actions ───────────────────────────────────────────────────

export async function saveQuotationAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;

  const mappedData = {
    quotation_number: rest.quotation_number || `QT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    customer_id: rest.customer_id,
    origin: rest.origin,
    destination: rest.destination,
    service_type: rest.service_type || 'local_transport',
    total_amount: parseFloat(rest.total_amount || 0),
    status: rest.status || 'draft',
    notes: rest.notes,
    validity_days: parseInt(rest.validity_days || 30),
    expiry_date: rest.expiry_date,
  };

  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("route_quotations")
      .update({ ...mappedData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("route_quotations")
      .insert([{ ...mappedData, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}
