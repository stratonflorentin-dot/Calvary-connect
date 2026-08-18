import { NextRequest, NextResponse } from "next/server";
import { requireFleetReportAccess } from "../../reports/helpers";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";

/**
 * Budget vs Actual. The `budgets` table already existed with real columns
 * (category_id -> financial_categories, vehicle_id, department, amount,
 * period) but nothing computed against it. Actual spend is matched by
 * category *name* against expenses.category — expenses.category is free
 * text with no FK, so this is a name-equality match, not a hard join; a
 * mistyped expense category simply won't count toward a budget. Vehicle
 * scoping is a real filter (expenses.vehicle_id). Department is informational
 * only — expenses has no department column, so department-scoped budgets
 * aren't matched against actual spend automatically.
 */

interface BudgetRow {
  id: string;
  budget_name: string;
  amount: number;
  currency: string;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  department: string | null;
  notes: string | null;
  category_id: string | null;
  vehicle_id: string | null;
}

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith("FORBIDDEN") ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const { data: budgets, error: budgetsError } = await supabase
      .from("budgets")
      .select("*, category:financial_categories(id, name), vehicle:vehicles(id, plate_number)")
      .order("start_date", { ascending: false });
    if (budgetsError) throw budgetsError;

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("category, vehicle_id, amount, currency, date, status")
      .eq("status", "paid")
      .is("deleted_at", null);
    if (expensesError) throw expensesError;

    const rows = ((budgets ?? []) as any[]).map((b) => {
      const categoryName = b.category?.name ?? null;
      const matching = (expenses ?? []).filter((e: any) => {
        if (categoryName && String(e.category ?? "").toLowerCase() !== categoryName.toLowerCase()) return false;
        if (b.vehicle_id && e.vehicle_id !== b.vehicle_id) return false;
        // Currency must match — a USD budget can't be measured against TZS
        // spend without a conversion this route has no rate for, so an
        // expense in a different currency simply never counts toward it
        // rather than being silently added as if it were the same money.
        if (normalizeCurrency(e.currency) !== normalizeCurrency(b.currency)) return false;
        if (!e.date) return false;
        return e.date >= b.start_date && e.date <= b.end_date;
      });
      const actual = matching.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      const pctUsed = Number(b.amount) > 0 ? Math.round((actual / Number(b.amount)) * 1000) / 10 : null;
      const band: "ok" | "warning" | "over" | null =
        pctUsed === null ? null : pctUsed >= 100 ? "over" : pctUsed >= 80 ? "warning" : "ok";

      return {
        id: b.id,
        budgetName: b.budget_name,
        amount: Number(b.amount),
        currency: b.currency,
        periodType: b.period_type,
        startDate: b.start_date,
        endDate: b.end_date,
        status: b.status,
        department: b.department,
        notes: b.notes,
        categoryId: b.category_id,
        categoryName,
        vehicleId: b.vehicle_id,
        vehiclePlate: b.vehicle?.plate_number ?? null,
        actual,
        remaining: Number(b.amount) - actual,
        pctUsed,
        band,
        matchedExpenseCount: matching.length,
      };
    });

    // Write-through: keep the persisted spent_amount column honest for any
    // other consumer that reads `budgets` directly, without a fragile
    // per-write trigger on `expenses`.
    for (const r of rows) {
      if (r.actual !== undefined) {
        await supabase.from("budgets").update({ spent_amount: r.actual, updated_at: new Date().toISOString() }).eq("id", r.id);
      }
    }

    // Never sum across currencies — a TZS total and a USD total added
    // together is a meaningless number. Group per currency instead, same
    // "Mixed currencies" convention as the rest of the finance module
    // (src/lib/finance/multi-currency.ts).
    const byCurrency: Record<string, { budgeted: number; actual: number }> = {};
    for (const r of rows) {
      const cur = normalizeCurrency(r.currency);
      if (!byCurrency[cur]) byCurrency[cur] = { budgeted: 0, actual: 0 };
      byCurrency[cur].budgeted += r.amount;
      byCurrency[cur].actual += r.actual;
    }
    const summary = {
      byCurrency,
      currencies: sortCurrencyKeys(Object.keys(byCurrency)),
      overCount: rows.filter((r) => r.band === "over").length,
      warningCount: rows.filter((r) => r.band === "warning").length,
    };

    return NextResponse.json({ success: true, data: rows, summary });
  } catch (error: any) {
    console.error("[API Budgets Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
