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

/**
 * Active bank accounts for a currency — used by the Mark Paid account
 * picker, since markPayrollPaidAction can no longer guess which one to
 * debit when more than one is active (see
 * 115_driver_allowances_bank_account_id.sql).
 */
export async function getActiveBankAccountsAction(currency: string = "TZS") {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, account_name, currency")
      .eq("currency", currency)
      .eq("is_active", true)
      .order("account_name");
    if (error) throw error;
    return { success: true, accounts: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load bank accounts", accounts: [] };
  }
}

/** Fetches all active worker profiles including base salary information */
export async function getWorkersAction() {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("id, name, email, role, status, salary, avatar_url, phone, hire_date, employee_id")
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

    // Fetch the profile to get their unique department-prefixed employee_id
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("employee_id")
      .eq("id", payrollData.employeeId)
      .single();
    
    const employeeIdText = profile?.employee_id || null;

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
        employee_id: employeeIdText,
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

    // Note: this used to also attempt a "backup" insert into a legacy
    // `allowances` table, but that table's own CHECK constraint only
    // allows type IN ('DAILY_ALLOWANCE','TRIP_ALLOWANCE','MEAL_ALLOWANCE',
    // 'ACCOMMODATION') — "payroll" was never a legal value there, so that
    // insert failed on every single call (silently, via a swallowed
    // catch). driver_allowances is the real, working table — used
    // directly by getPayrollHistoryAction and everywhere else in this
    // file — so the dead write was removed rather than "fixed" toward a
    // table nothing in this codebase actually reads for payroll data.

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
        user_profiles!driver_id(name, avatar_url, role, employee_id)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format profiles correctly
    const formatted = data?.map((item: any) => ({
      ...item,
      employee_name: item.user_profiles?.name || item.driver_name || "Unknown Worker",
      avatar_url: item.user_profiles?.avatar_url || null,
      worker_role: item.user_profiles?.role || item.role || "Employee",
      employee_id: item.employee_id || item.user_profiles?.employee_id || "N/A"
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

    // 1. Fetch the payroll record from driver_allowances, joining the user profile
    const { data: record, error: fetchErr } = await supabaseAdmin
      .from("driver_allowances")
      .select(`
        *,
        user_profiles!driver_id(employee_id)
      `)
      .eq("id", id)
      .single();

    if (fetchErr || !record) {
      throw new Error("Payroll record not found: " + (fetchErr?.message || "Unknown error"));
    }

    // Determine the final employee ID string
    const employeeIdText = record.employee_id || record.user_profiles?.employee_id || null;

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

    // 3. Create financial expense for payroll (Staff Costs)
    const workerName = record.driver_name || "Employee";
    const desc = `Payroll (${period}): ${workerName} - Salary: TZS ${baseSalary.toLocaleString()}, Allowances: TZS ${allowances.toLocaleString()}, Deductions: TZS ${deductions.toLocaleString()}`;

    const { data: expense, error: expErr } = await supabaseAdmin
      .from("expenses")
      .insert({
        type: "allowance",
        amount: record.amount,
        description: desc,
        driver_id: record.driver_id,
        employee_id: employeeIdText,
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
        employee_id: employeeIdText,
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

/**
 * Marks an already-approved payroll record as paid (disbursed) and closes
 * the loop into Finance: without this, approval alone never touches
 * `invoices.paid_at`, so the payroll expense can never surface in Bank
 * Reconciliation's book-entries panel (that query requires paid_at set) or
 * in the Executive Summary's "paid" revenue/expense figures — the linkage
 * approvePayrollRecordAction sets up (expense + payable invoice) was a dead
 * end without this step. Finds the invoice via the same deterministic
 * `PAY-{id}` number approvePayrollRecordAction always uses, so no new
 * column/schema change is needed to relate them.
 */
export async function markPayrollPaidAction(id: string, bankAccountId?: string) {
  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    const { data: record, error: fetchErr } = await supabaseAdmin
      .from("driver_allowances")
      .select("id, driver_id, driver_name, amount, status")
      .eq("id", id)
      .single();

    if (fetchErr || !record) {
      throw new Error("Payroll record not found: " + (fetchErr?.message || "Unknown error"));
    }
    if (record.status !== "approved") {
      throw new Error("Only approved payroll can be marked as paid.");
    }

    // Debit the bank account BEFORE flipping status — this is the same bug
    // class as expenses (see runSideEffects note in src/lib/workflow/engine.ts):
    // marking something "paid" is meaningless if no bank_accounts row is
    // ever debited. driver_allowances is always inserted with currency
    // "TZS" (see savePayrollAction above), so that's the account to debit.
    const currency = (record as any).currency || "TZS";
    let payingAccountId: string;

    // An explicit choice (the account picker on Mark Paid, or a
    // pre-selected driver_allowances.bank_account_id) beats guessing — see
    // 115_driver_allowances_bank_account_id.sql. Falling back to "the one
    // active account in this currency" only when nothing was chosen, same
    // as the expense flow in lib/workflow/engine.ts.
    if (bankAccountId) {
      const { data: chosen, error: chosenErr } = await supabaseAdmin
        .from("bank_accounts")
        .select("id, currency, is_active")
        .eq("id", bankAccountId)
        .maybeSingle();
      if (chosenErr) {
        throw new Error(`Could not look up the chosen bank account: ${chosenErr.message}`);
      }
      if (!chosen || !chosen.is_active) {
        throw new Error("The chosen account is no longer active.");
      }
      if (chosen.currency !== currency) {
        throw new Error(`The chosen account is ${chosen.currency}, but this payroll record is ${currency}.`);
      }
      payingAccountId = chosen.id;
    } else {
      const { data: accounts, error: acctErr } = await supabaseAdmin
        .from("bank_accounts")
        .select("id")
        .eq("currency", currency)
        .eq("is_active", true);
      if (acctErr) {
        throw new Error(`Could not look up ${currency} bank accounts: ${acctErr.message}`);
      }
      if (!accounts || accounts.length !== 1) {
        throw new Error(
          accounts && accounts.length > 1
            ? `More than one active ${currency} bank account exists — choose which one paid it.`
            : `No active ${currency} bank account found to pay this payroll record from.`,
        );
      }
      payingAccountId = accounts[0].id;
    }
    const { error: txError } = await supabaseAdmin.rpc("post_bank_transaction", {
      p_bank_account_id: payingAccountId,
      p_amount: Number(record.amount) || 0,
      p_direction: "out",
      p_transaction_type: "withdrawal",
      p_currency: currency,
      p_description: `Payroll disbursement: ${record.driver_name || "Employee"}`,
      p_reference_type: "payroll",
      p_reference_id: id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (txError) {
      throw new Error(`Bank account was not debited: ${txError.message}`);
    }

    const { error: updateErrD } = await supabaseAdmin
      .from("driver_allowances")
      .update({ status: "paid", updated_at: now })
      .eq("id", id);
    if (updateErrD) throw updateErrD;

    // Locate the payable invoice approvePayrollRecordAction created for this
    // record (deterministic number, so no stored foreign key needed).
    const invoiceNumber = `PAY-${id.substring(0, 8).toUpperCase()}`;
    const { data: invoice, error: invFetchErr } = await supabaseAdmin
      .from("invoices")
      .select("id, linked_expense")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();

    if (invFetchErr) {
      console.error("Failed to look up payroll invoice:", invFetchErr);
    } else if (invoice) {
      const { error: invUpdateErr } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", paid_at: now })
        .eq("id", invoice.id);
      if (invUpdateErr) console.error("Failed to mark payroll invoice paid:", invUpdateErr);

      if (invoice.linked_expense) {
        const { error: expUpdateErr } = await supabaseAdmin
          .from("expenses")
          .update({ status: "paid" })
          .eq("id", invoice.linked_expense);
        if (expUpdateErr) console.error("Failed to mark payroll expense paid:", expUpdateErr);
      }
    } else {
      console.warn(`No payable invoice found for payroll record ${id} (expected ${invoiceNumber}) — approve it first.`);
    }

    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: record.driver_id,
        category: "general",
        title: "Payroll Paid",
        message: `Your payroll of TZS ${Number(record.amount).toLocaleString()} has been disbursed.`,
        severity: "success",
        created_at: now,
      });
    } catch (notifErr) {
      console.error("Failed to send notification:", notifErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to mark payroll record as paid:", error);
    return { success: false, error: error.message || "Failed to mark payroll record as paid" };
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
