import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendClientEmail } from "@/lib/email/send";

const ALLOWED_ROLES = ["CEO", "ADMIN", "SALESMAN"];

async function requireAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to send quotations");
  }
  return admin;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://calvary-connect.vercel.app";

/**
 * Emails the quotation's public link to the customer and moves it to
 * "sent". The link (not a PDF attachment) is what lets the customer
 * accept/reject and lets this app know when they've actually opened it
 * (viewed_at, stamped by the public GET route on first fetch).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAccess(request);
    const { id } = await params;

    const { data: quotation, error: qErr } = await admin
      .from("quotations")
      .select("id, quotation_number, status, currency, total_amount, public_token, customer_id")
      .eq("id", id)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (quotation.status && !["draft", "sent"].includes(quotation.status)) {
      return NextResponse.json({ error: `Can't send a quotation that's already ${quotation.status}` }, { status: 409 });
    }

    let customerName = "";
    let customerEmail: string | null = null;
    if (quotation.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("company_name, contact_person, email")
        .eq("id", quotation.customer_id)
        .maybeSingle();
      customerName = customer?.company_name || customer?.contact_person || "";
      customerEmail = customer?.email ?? null;
    }
    const body = await request.json().catch(() => ({}));
    customerEmail = body.email || customerEmail;
    customerName = body.customerName || customerName;

    if (!customerEmail) {
      return NextResponse.json({ error: "No customer email on file — pass one explicitly." }, { status: 400 });
    }

    const link = `${appUrl()}/q/${quotation.public_token}`;
    const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(quotation.total_amount) || 0);

    await sendClientEmail({
      to: customerEmail,
      toName: customerName || undefined,
      subject: `Quotation ${quotation.quotation_number || ""} — ${quotation.currency} ${amount}`,
      body:
        `Dear ${customerName || "Customer"},\n\n` +
        `Please find your quotation ${quotation.quotation_number || ""} for ${quotation.currency} ${amount}.\n\n` +
        `View, accept or decline it here:\n${link}\n\n` +
        `Thank you for the opportunity to work with you.\n\n` +
        `Calvary Investment Co. Ltd`,
    });

    const { data: updated, error: updateErr } = await admin
      .from("quotations")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (updateErr) throw updateErr;

    return NextResponse.json({ quotation: updated, link });
  } catch (error: any) {
    console.error("POST /api/quotations/[id]/send error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
