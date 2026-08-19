import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchCrdbForexRates } from "@/lib/finance/crdb-forex";
import { KNOWN_CURRENCIES, REPORTING_CURRENCY } from "@/lib/finance/multi-currency";

const ALLOWED_ROLES = ["CEO", "ADMIN", "ACCOUNTANT"];

async function requireAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to sync exchange rates");
  }
  return admin;
}

/**
 * Pulls today's buy/sell rates from CRDB's public forex page and records the
 * mid rate for every currency this app actually reports in (KNOWN_CURRENCIES,
 * minus TZS itself since it's the reporting currency). Upserts on
 * (from_currency, to_currency, effective_date) so re-running this on the same
 * day just refreshes today's rate instead of piling up duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAccess(request);
    const crdbRates = await fetchCrdbForexRates();
    const today = new Date().toISOString().slice(0, 10);

    const wanted = new Set<string>(KNOWN_CURRENCIES.filter((c) => c !== REPORTING_CURRENCY));
    const toUpsert = crdbRates
      .filter((r) => wanted.has(r.code))
      .map((r) => ({
        from_currency: r.code,
        to_currency: REPORTING_CURRENCY,
        rate: r.mid,
        effective_date: today,
      }));

    if (toUpsert.length === 0) {
      return NextResponse.json({ error: "None of this app's known currencies were found on the CRDB forex page" }, { status: 502 });
    }

    const { data, error } = await admin
      .from("exchange_rates")
      .upsert(toUpsert, { onConflict: "from_currency,to_currency,effective_date" })
      .select("from_currency, to_currency, rate, effective_date");
    if (error) throw error;

    return NextResponse.json({ synced: data, source: "CRDB Bank forex page", asOf: today });
  } catch (error: any) {
    console.error("POST /api/finance/fx-rates/sync-crdb error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
