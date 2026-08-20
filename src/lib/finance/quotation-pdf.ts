import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/components/ui/currency-badge";

export interface QuotationPdfLine {
  description: string;
  service_type: string | null;
  quantity: number;
  duration_days: number | null;
  unit_price: number;
  line_total: number;
}

export interface QuotationPdfData {
  quotation_number: string | null;
  quotation_date: string | null;
  valid_until: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  origin?: string | null;
  destination?: string | null;
  currency: string;
  subtotal: number;
  vat_rate: number;
  zero_rated_vat: boolean;
  vat_amount: number;
  total_amount: number;
  payment_terms?: string | null;
  terms_conditions?: string | null;
  lines: QuotationPdfLine[];
  companyName?: string;
}

/** Client-side PDF generation — used by both the staff quotation page and
 * the public customer-facing page, so a quotation looks identical however
 * it was reached. No server round-trip needed since jsPDF runs in-browser. */
export function buildQuotationPdf(q: QuotationPdfData): jsPDF {
  const doc = new jsPDF();
  const fmt = (n: number) => formatCurrency(n, q.currency);

  doc.setFontSize(16);
  doc.text(q.companyName || "Calvary Investment Co. Ltd", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("QUOTATION", 14, 25);
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.text(`Quotation #: ${q.quotation_number || "—"}`, 140, 18);
  doc.text(`Date: ${q.quotation_date ? new Date(q.quotation_date).toLocaleDateString() : "—"}`, 140, 24);
  doc.text(`Valid until: ${q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "—"}`, 140, 30);

  doc.setFontSize(11);
  doc.text("Bill To:", 14, 40);
  doc.setFontSize(10);
  doc.text(q.customer_name || "—", 14, 46);
  if (q.customer_email) doc.text(q.customer_email, 14, 51);
  if (q.customer_phone) doc.text(q.customer_phone, 14, 56);

  if (q.origin || q.destination) {
    doc.setFontSize(10);
    doc.text(`Route: ${q.origin || "—"} → ${q.destination || "—"}`, 14, 63);
  }

  const lineRows = q.lines.map((l) => [
    l.service_type || "—",
    l.description || "",
    String(l.quantity ?? 1),
    l.duration_days ? `${l.duration_days} day(s)` : "—",
    fmt(l.unit_price || 0),
    fmt(l.line_total || 0),
  ]);

  const table = autoTable(doc, {
    startY: 70,
    head: [["Item", "Description", "Qty", "Duration", "Unit Price", "Subtotal"]],
    body: lineRows,
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  let y = (table as any).finalY + 8;
  doc.setFontSize(10);
  doc.text(`Subtotal:`, 140, y);
  doc.text(fmt(q.subtotal), 190, y, { align: "right" });
  y += 6;
  doc.text(q.zero_rated_vat ? "VAT (zero-rated):" : `VAT (${q.vat_rate}%):`, 140, y);
  doc.text(fmt(q.vat_amount), 190, y, { align: "right" });
  y += 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total:`, 140, y);
  doc.text(fmt(q.total_amount), 190, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 12;

  if (q.payment_terms) {
    doc.setFontSize(9);
    doc.text("Payment Terms:", 14, y);
    doc.text(doc.splitTextToSize(q.payment_terms, 180), 14, y + 5);
    y += 5 + doc.splitTextToSize(q.payment_terms, 180).length * 4 + 6;
  }

  if (q.terms_conditions) {
    doc.setFontSize(9);
    doc.text("Terms & Conditions:", 14, y);
    y += 5;
    const clauses = q.terms_conditions.split("\n").filter((c) => c.trim());
    clauses.forEach((clause, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${clause.trim()}`, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4;
    });
  }

  return doc;
}

export function downloadQuotationPdf(q: QuotationPdfData) {
  const doc = buildQuotationPdf(q);
  doc.save(`${q.quotation_number || "quotation"}.pdf`);
}
