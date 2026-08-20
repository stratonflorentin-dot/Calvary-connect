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
      .select("*, customer:customer_id(company_name, contact_person, email, phone)")
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

    return NextResponse.json({ quotation, lines: lines ?? [] });
  } catch (error: any) {
    console.error("GET /api/quotations/public/[token] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
