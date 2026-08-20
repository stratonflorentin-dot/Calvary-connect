import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const admin = supabaseAdmin();

    const { data: quotation, error: findErr } = await admin
      .from("quotations")
      .select("*")
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

    // Accepted quotation converts 1:1 into a Shipment, inheriting client/
    // route/currency/total — the one automatic trigger point in the whole
    // pipeline the spec asks for. Only fires if this quotation hasn't
    // already produced one (re-accepting after a page refresh, etc.).
    let shipment: any = null;
    if (!quotation.shipment_id) {
      const { data: shipmentNumber } = await admin.rpc("next_doc_number", { p_type: "shipment" });
      const { data: newShipment, error: shipErr } = await admin
        .from("shipments")
        .insert({
          shipment_number: shipmentNumber || `SH-${Date.now().toString().slice(-6)}`,
          quotation_id: quotation.id,
          customer_id: quotation.customer_id,
          origin_city: quotation.origin,
          destination_city: quotation.destination,
          quoted_amount: quotation.total_amount,
          currency: quotation.currency,
          status: "created",
          created_by: quotation.created_by,
        })
        .select()
        .single();
      if (shipErr) {
        // The quotation is genuinely accepted either way — surface the
        // shipment-creation failure but don't fail the customer's accept.
        console.error("Shipment auto-create failed:", shipErr);
      } else {
        shipment = newShipment;
        await admin.from("quotations").update({ shipment_id: shipment.id }).eq("id", quotation.id);
      }
    }

    return NextResponse.json({ quotation: updated, shipment });
  } catch (error: any) {
    console.error("POST /api/quotations/public/[token]/accept error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
