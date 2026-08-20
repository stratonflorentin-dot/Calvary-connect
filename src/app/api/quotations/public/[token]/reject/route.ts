import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const admin = supabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const { data: quotation, error: findErr } = await admin
      .from("quotations")
      .select("id, status")
      .eq("public_token", token)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (!["sent", "viewed"].includes(quotation.status)) {
      return NextResponse.json({ error: `This quotation is already ${quotation.status} and can't be rejected.` }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from("quotations")
      .update({ status: "rejected", rejected_at: new Date().toISOString(), rejected_reason: reason || null })
      .eq("id", quotation.id)
      .select()
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ quotation: updated });
  } catch (error: any) {
    console.error("POST /api/quotations/public/[token]/reject error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
