import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendClientEmail } from "@/lib/email/send";

const ALLOWED_ROLES = ["CEO", "ADMIN", "SALESMAN", "ACCOUNTANT"];

async function requireAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to send proforma invoices");
  }
  return admin;
}

/**
 * Emails the customer that a proforma invoice is ready and moves it to
 * "sent". No public accept/reject portal like quotations have — a
 * proforma is a preliminary document, so unlike /api/quotations/[id]/send
 * this never stamps a "customer decision" anywhere. A missing customer
 * email still lets the Draft -> Sent transition go through, same
 * reasoning as the quotation flow.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAccess(request);
    const { id } = await params;

    const { data: pf, error: pfErr } = await admin
      .from("proforma_invoices")
      .select("id, proforma_number, status, currency, total_amount, customer_id")
      .eq("id", id)
      .maybeSingle();
    if (pfErr) throw pfErr;
    if (!pf) return NextResponse.json({ error: "Proforma invoice not found" }, { status: 404 });
    if (!["draft", "sent"].includes(pf.status)) {
      return NextResponse.json({ error: `Can't send a proforma invoice that's already ${pf.status}` }, { status: 409 });
    }

    let customerName = "";
    let customerEmail: string | null = null;
    if (pf.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("company_name, contact_person, email")
        .eq("id", pf.customer_id)
        .maybeSingle();
      customerName = customer?.company_name || customer?.contact_person || "";
      customerEmail = customer?.email ?? null;
    }

    const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(pf.total_amount) || 0);

    let emailSent = false;
    let emailError: string | null = null;
    if (customerEmail) {
      try {
        await sendClientEmail({
          to: customerEmail,
          toName: customerName || undefined,
          subject: `Proforma Invoice ${pf.proforma_number} — ${pf.currency} ${amount}`,
          body:
            `Dear ${customerName || "Customer"},\n\n` +
            `Please find attached/enclosed your proforma invoice ${pf.proforma_number} for ${pf.currency} ${amount}.\n\n` +
            `This is a preliminary document for your reference and is not a tax invoice or a demand for payment. ` +
            `A final invoice will follow once the arrangement is confirmed.\n\n` +
            `Thank you for the opportunity to work with you.\n\n` +
            `Calvary Investment Co. Ltd`,
        });
        emailSent = true;
      } catch (err: any) {
        console.warn(`[proforma-invoices/${id}/send] email not sent:`, err.message);
        emailError = err.message;
      }
    } else {
      emailError = "No customer email on file";
    }

    const { data: updated, error: updateErr } = await admin
      .from("proforma_invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (updateErr) throw updateErr;

    return NextResponse.json({ proforma: updated, emailSent, emailError });
  } catch (error: any) {
    console.error("POST /api/proforma-invoices/[id]/send error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
