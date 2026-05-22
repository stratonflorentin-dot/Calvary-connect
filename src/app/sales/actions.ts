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
  
  if (id && id.length > 10) { // UUID check
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

// ─── Trip Actions ───────────────────────────────────────────────────────

export async function saveTripAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;
  
  // Map salesman-dashboard fields to database fields if needed
  const mappedData = {
    origin: rest.origin,
    destination: rest.destination,
    driver_id: rest.driver_id,
    truck_id: rest.truck_id,
    cargo_type: rest.cargo_type,
    status: rest.status || 'PENDING',
    // add other fields if they exist in schema
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
    amount: parseFloat(rest.amount),
    due_date: rest.due_date,
    status: rest.status || 'pending',
    trip_id: rest.trip_id,
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

// ─── Expense Actions ────────────────────────────────────────────────────

export async function saveExpenseAction(data: any) {
  const supabaseAdmin = getAdminClient();
  const { id, ...rest } = data;

  const mappedData = {
    description: rest.description,
    amount: parseFloat(rest.amount),
    category: rest.category,
    expense_date: rest.date || new Date().toISOString().split('T')[0],
    trip_id: rest.trip_id,
    status: rest.status || 'pending',
  };

  if (id && id.length > 10) {
    const { data: result, error } = await supabaseAdmin
      .from("expenses")
      .update({ ...mappedData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } else {
    const { data: result, error } = await supabaseAdmin
      .from("expenses")
      .insert([{ ...mappedData, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return result;
  }
}

export async function deleteExpenseAction(id: string) {
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin
    .from("expenses")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}
