import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * No auth at all — the token itself (an unguessable uuid) is the
 * credential, same model as any "view this invoice" email link. Uses the
 * admin client because there is no user session to evaluate quotations'
 * normal RLS against.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const admin = supabaseAdmin();

    const { data: quotation, error } = await admin
      .from("quotations")
      .select("*, customer:customer_id(company_name, contact_person, email, phone, vrn, tax_id)")
      .eq("public_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    const { data: lines } = await admin
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", quotation.id)
      .order("line_number", { ascending: true });

    // First open transitions sent -> viewed; a repeat visit or an already
    // decided quotation (accepted/rejected/expired) leaves status alone.
    if (quotation.status === "sent") {
      const { data: updated } = await admin
        .from("quotations")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", quotation.id)
        .select()
        .maybeSingle();
      if (updated) Object.assign(quotation, updated);
    }

    // A public visitor has no session, so it can't read company_settings
    // or exchange_rates directly (both require auth) — this route (admin
    // client) fetches them on its behalf instead.
    const { data: company } = await admin
      .from("company_settings")
      .select("company_name, tagline, vat_registration, tax_id, phone, email, address, bank_name, bank_account_name, bank_account_number_tzs, bank_account_number_usd, bank_branch_code, bank_swift_code")
      .limit(1).maybeSingle();

    let fxRate: number | null = null;
    if (quotation.currency && quotation.currency !== "TZS") {
      const { data: rateRow } = await admin
        .from("exchange_rates")
        .select("rate")
        .eq("from_currency", quotation.currency)
        .eq("to_currency", "TZS")
        .lte("effective_date", new Date().toISOString().slice(0, 10))
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      fxRate = rateRow?.rate ?? null;
    }

    return NextResponse.json({ quotation, lines: lines ?? [], company: company ?? {}, fxRate });
  } catch (error: any) {
    console.error("GET /api/quotations/public/[token] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
