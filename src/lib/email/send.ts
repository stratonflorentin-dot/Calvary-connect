import nodemailer from "nodemailer";

/**
 * Sends mail as info@calvary.co.tz via Gmail SMTP (the mailbox is Google
 * Workspace). Auth is a Gmail App Password, not the account password — that
 * requires 2-Step Verification to be turned on for the mailbox, then an
 * app password generated at myaccount.google.com/apppasswords. This is a
 * single shared-mailbox sender used server-side only; never import this
 * from client code.
 */

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "Missing GMAIL_USER / GMAIL_APP_PASSWORD environment variables — company email sending is not configured.",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendClientEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function sendClientEmail(input: SendClientEmailInput) {
  const transporter = getTransporter();
  const fromAddress = process.env.GMAIL_USER!;

  await transporter.sendMail({
    from: `"Calvary Investment Co. Ltd" <${fromAddress}>`,
    to: input.toName ? `"${input.toName}" <${input.to}>` : input.to,
    replyTo: input.replyTo || fromAddress,
    subject: input.subject,
    text: input.body,
    html: input.body.replace(/\n/g, "<br />"),
  });
}
