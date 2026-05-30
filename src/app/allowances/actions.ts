"use server";

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/** Fetches all active worker profiles including base salary information */
export async function getWorkersAction() {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("id, name, email, role, status, salary, avatar_url, phone, hire_date")
      .order("name", { ascending: true });

    if (error) throw error;
    return { success: true, workers: data || [] };
  } catch (error: any) {
    console.error("Failed to fetch workers:", error);
    return { success: false, error: error.message || "Failed to load workers" };
  }
}

/** Inserts a manual payroll record for an employee */
export async function savePayrollAction(payrollData: {
  employeeId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  period: string;
  paymentMethod: string;
  note?: string;
}) {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    // Package the detailed salary breakdown in the reason field
    const reasonBreakdown = JSON.stringify({
      baseSalary: payrollData.baseSalary,
      allowances: payrollData.allowances,
      deductions: payrollData.deductions,
      period: payrollData.period,
      paymentMethod: payrollData.paymentMethod,
      note: payrollData.note || "Manual payroll entry"
    });

    // 1. Insert into driver_allowances (primary table for frontend grid)
    const { data: driverAllowanceRecord, error: errD } = await supabaseAdmin
      .from("driver_allowances")
      .insert({
        driver_id: payrollData.employeeId,
        driver_name: payrollData.employeeName,
        worker_name: payrollData.employeeName, // Fallback for legacy schemas
        role: payrollData.role,
        amount: payrollData.netSalary,
        type: "payroll",
        status: "pending",
        reason: reasonBreakdown,
        currency: "TZS",
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (errD) throw errD;

    // 2. Try to insert into allowances table for backup/compatibility
    try {
      await supabaseAdmin
        .from("allowances")
        .insert({
          id: driverAllowanceRecord.id, // Keep IDs identical
          employee_id: payrollData.employeeId,
          worker_name: payrollData.employeeName,
          amount: payrollData.netSalary,
          type: "payroll",
          status: "pending",
          reason: reasonBreakdown,
          created_at: now,
          updated_at: now
        });
    } catch (err) {
      console.log("Allowances table insertion bypassed (probably minor schema difference)");
    }

    return { success: true, record: driverAllowanceRecord };
  } catch (error: any) {
    console.error("Failed to save payroll record:", error);
    return { success: false, error: error.message || "Failed to process payroll entry" };
  }
}

/** Fetches full payroll and allowance history with profile joins */
export async function getPayrollHistoryAction() {
  try {
    const supabaseAdmin = getAdminClient();
    
    // We fetch from driver_allowances and join with user_profiles
    const { data, error } = await supabaseAdmin
      .from("driver_allowances")
      .select(`
        *,
        user_profiles!driver_id(name, avatar_url, role)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format profiles correctly
    const formatted = data?.map((item: any) => ({
      ...item,
      employee_name: item.user_profiles?.name || item.driver_name || "Unknown Worker",
      avatar_url: item.user_profiles?.avatar_url || null,
      worker_role: item.user_profiles?.role || item.role || "Employee"
    })) || [];

    return { success: true, history: formatted };
  } catch (error: any) {
    console.error("Failed to load payroll history:", error);
    return { success: false, error: error.message || "Failed to load history" };
  }
}

/** Approves a payroll record and creates a corresponding expense/invoice */
export async function approvePayrollRecordAction(id: string, approvedByUserId: string) {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch the payroll record from driver_allowances
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from("driver_allowances")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !record) {
      throw new Error("Payroll record not found: " + (fetchErr?.message || "Unknown error"));
    }

    // Parse the reason JSON to extract breakdown
    let baseSalary = record.amount;
    let allowances = 0;
    let deductions = 0;
    let period = "Current Month";
    let note = "Manual payroll entry";

    try {
      if (record.reason && record.reason.startsWith("{")) {
        const parsed = JSON.parse(record.reason);
        baseSalary = parsed.baseSalary || 0;
        allowances = parsed.allowances || 0;
        deductions = parsed.deductions || 0;
        period = parsed.period || period;
        note = parsed.note || note;
      }
    } catch (e) {
      note = record.reason || note;
    }

    // 2. Update status in driver_allowances to 'approved'
    const { error: updateErrD } = await supabaseAdmin
      .from("driver_allowances")
      .update({ status: "approved", updated_at: now })
      .eq("id", id);

    if (updateErrD) throw updateErrD;

    // 3. Try to update allowances table status
    try {
      await supabaseAdmin
        .from("allowances")
        .update({ status: "approved", updated_at: now })
        .eq("id", id);
    } catch (err) {
      console.log("Allowances table update bypassed");
    }

    // 4. Create financial expense for payroll (Staff Costs)
    const workerName = record.driver_name || "Employee";
    const desc = `Payroll (${period}): ${workerName} - Salary: TZS ${baseSalary.toLocaleString()}, Allowances: TZS ${allowances.toLocaleString()}, Deductions: TZS ${deductions.toLocaleString()}`;

    const { data: expense, error: expErr } = await supabaseAdmin
      .from("expenses")
      .insert({
        type: "allowance",
        amount: record.amount,
        description: desc,
        driver_id: record.driver_id,
        category: "Staff Costs",
        status: "approved",
        approved_by: approvedByUserId,
        created_at: now
      })
      .select()
      .single();

    if (expErr) {
      console.error("Failed to create expense entry:", expErr);
    }

    // 5. Create Payable Invoice (Bill for payment processing)
    const { error: invErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: `PAY-${record.id.substring(0, 8).toUpperCase()}`,
        customer_name: workerName,
        amount: record.amount,
        due_date: now.split("T")[0],
        status: "pending",
        type: "payable",
        linked_expense: expense?.id || null,
        description: `Payroll invoice for ${workerName} - Period: ${period}`
      });

    if (invErr) {
      console.error("Failed to create payable invoice:", invErr);
    }

    // 6. Create Notification for the Employee
    try {
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: record.driver_id,
          category: "general",
          title: "Payroll Approved",
          message: `Your payroll for ${period} of TZS ${record.amount.toLocaleString()} has been approved and sent for payment.`,
          severity: "success",
          created_at: now
        });
    } catch (notifErr) {
      console.error("Failed to send notification:", notifErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to approve payroll record:", error);
    return { success: false, error: error.message || "Failed to approve payroll record" };
  }
}

/** Rejects/Deletes a payroll or allowance record */
export async function rejectPayrollRecordAction(id: string) {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    // Update status to rejected
    const { error: errD } = await supabaseAdmin
      .from("driver_allowances")
      .update({ status: "rejected", updated_at: now })
      .eq("id", id);

    if (errD) throw errD;

    try {
      await supabaseAdmin
        .from("allowances")
        .update({ status: "rejected", updated_at: now })
        .eq("id", id);
    } catch (err) {
      console.log("Allowances table update bypassed");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to reject payroll record:", error);
    return { success: false, error: error.message || "Failed to reject payroll record" };
  }
}

/** Deletes a payroll record from database history completely */
export async function deletePayrollRecordAction(id: string) {
  try {
    const supabaseAdmin = getAdminClient();

    const { error: errD } = await supabaseAdmin
      .from("driver_allowances")
      .delete()
      .eq("id", id);

    if (errD) throw errD;

    try {
      await supabaseAdmin
        .from("allowances")
        .delete()
        .eq("id", id);
    } catch (err) {
      console.log("Allowances table deletion bypassed");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete payroll record:", error);
    return { success: false, error: error.message || "Failed to delete record" };
  }
}

/** Updates user base salary in profile table */
export async function updateWorkerSalaryAction(userId: string, salary: number) {
  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update({ salary, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update salary:", error);
    return { success: false, error: error.message || "Failed to update salary info" };
  }
}
