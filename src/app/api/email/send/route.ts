import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendClientEmail } from "@/lib/email/send";

// Same role set as customers_all (043_lock_down_customers_rls.sql) and
// client_emails_all (047_client_emails.sql) — a DRIVER/MECHANIC/HR account
// has no business emailing clients from the company address.
const CLIENT_EMAIL_ROLES = ["CEO", "ADMIN", "SALESMAN", "ACCOUNTANT"];

async function requireClientEmailAccess(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (!profile || !CLIENT_EMAIL_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to email clients");
  }

  return { admin, userId: user.id, senderName: profile.name as string | null };
}

export async function POST(request: Request) {
  let admin, userId: string, senderName: string | null;
  try {
    ({ admin, userId, senderName } = await requireClientEmailAccess(request));
  } catch (err: any) {
    const status = String(err.message).startsWith("FORBIDDEN") ? 403 : 401;
    return NextResponse.json({ error: err.message }, { status });
  }

  const body = await request.json().catch(() => null);
  const { customerId, to, toName, subject, message } = body ?? {};

  if (!to || !subject || !message) {
    return NextResponse.json({ error: "to, subject and message are required" }, { status: 400 });
  }

  try {
    await sendClientEmail({
      to,
      toName,
      subject,
      body: senderName ? `${message}\n\n— ${senderName}\nCalvary Investment Co. Ltd` : message,
    });

    const { data: logRow, error: logError } = await admin
      .from("client_emails")
      .insert({
        customer_id: customerId || null,
        sender_id: userId,
        to_email: to,
        to_name: toName || null,
        subject,
        body: message,
        status: "sent",
      })
      .select()
      .single();
    if (logError) throw logError;

    return NextResponse.json({ success: true, email: logRow });
  } catch (err: any) {
    await admin.from("client_emails").insert({
      customer_id: customerId || null,
      sender_id: userId,
      to_email: to,
      to_name: toName || null,
      subject,
      body: message,
      status: "failed",
      error_message: String(err.message || err),
    });

    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 502 });
  }
}
