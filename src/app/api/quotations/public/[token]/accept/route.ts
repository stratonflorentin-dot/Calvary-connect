import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const admin = supabaseAdmin();

    const { data: quotation, error: findErr } = await admin
      .from("quotations")
      .select("id, status")
      .eq("public_token", token)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (!["sent", "viewed"].includes(quotation.status)) {
      return NextResponse.json({ error: `This quotation is already ${quotation.status} and can't be accepted.` }, { status: 409 });
    }

    const { data: updated, error } = await admin
      .from("quotations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", quotation.id)
      .select()
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ quotation: updated });
  } catch (error: any) {
    console.error("POST /api/quotations/public/[token]/accept error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
