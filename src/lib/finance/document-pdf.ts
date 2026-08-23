import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/components/ui/currency-badge";

/** Shared letterhead builder for Quotation and Invoice PDFs — both
 * documents share the same company/customer block, bank details, and
 * signature/footer, matching the company's real existing PDF templates
 * (QT-2026-0001.pdf / INV-2026-0001.pdf) field-for-field rather than an
 * invented layout. */

export interface DocumentCompanyInfo {
  company_name?: string | null;
  tagline?: string | null;
  /** Base64 data URL — jsPDF can't fetch a remote logo_url itself, see fetchLogoDataUrl(). */
  logoDataUrl?: string | null;
  vat_registration?: string | null; // VRN
  tax_id?: string | null; // TIN
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number_tzs?: string | null;
  bank_account_number_usd?: string | null;
  bank_branch_code?: string | null;
  bank_swift_code?: string | null;
}

export interface DocumentCustomerInfo {
  name: string;
  vrn?: string | null;
  tin?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DocumentLine {
  description: string;
  item_type_label?: string | null;
  quantity: number;
  duration_days?: number | null;
  unit_price: number;
  line_total: number;
}

export interface DocumentPdfData {
  kind: "quotation" | "invoice";
  number: string | null;
  dateIssued: string | null;
  /** Quotation: valid_until. Invoice: due_date. */
  dueOrValidUntil: string | null;
  status: string | null;
  company: DocumentCompanyInfo;
  customer: DocumentCustomerInfo;
  paymentTerms?: string | null;
  currency: string;
  fxRateToTzs?: number | null;
  vatRate: number;
  zeroRated: boolean;
  subtotal: number;
  vatAmount: number;
  total: number;
  lines: DocumentLine[];
  /** Invoice only — quotations in the real reference template carry no T&Cs block. */
  termsConditions?: string | null;
}

const LABEL_COLOR: [number, number, number] = [200, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];
const GREEN: [number, number, number] = [22, 130, 70];

/**
 * company_settings.logo_url points at Supabase Storage — jsPDF's addImage
 * needs actual image data (data URL / ArrayBuffer), not a URL it can fetch
 * itself. Callers fetch once and pass the result as company.logoDataUrl.
 * Fails soft (returns null) so a logo hiccup never blocks a document.
 */
export async function fetchLogoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read logo blob"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function buildDocumentPdf(d: DocumentPdfData): jsPDF {
  const doc = new jsPDF();
  const fmtAmt = (n: number) => formatCurrency(n, d.currency);
  const pageWidth = doc.internal.pageSize.getWidth();

  if (d.company.logoDataUrl) {
    const format = /data:image\/(\w+);/.exec(d.company.logoDataUrl)?.[1]?.toUpperCase() || "PNG";
    try {
      doc.addImage(d.company.logoDataUrl, format, pageWidth - 14 - 26, 8, 26, 16, undefined, "FAST");
    } catch {
      // Malformed/unsupported image — the document still generates without it.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(d.kind === "quotation" ? "QUOTATION" : "INVOICE", pageWidth / 2, 18, { align: "center" });

  // Company block (left)
  doc.setFontSize(13);
  doc.text(d.company.company_name || "Company", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let leftY = 35;
  if (d.company.tagline) { doc.text(d.company.tagline, 14, leftY); leftY += 5; }
  doc.setTextColor(0);
  const companyLines: [string, string | null | undefined][] = [
    ["VRN:", d.company.vat_registration],
    ["TIN:", d.company.tax_id],
    ["Phone:", d.company.phone],
    ["Email:", d.company.email],
  ];
  for (const [label, value] of companyLines) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, leftY);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 14 + doc.getTextWidth(label) + 1.5, leftY);
    leftY += 5;
  }
  if (d.company.address) {
    doc.text(d.company.address, 14, leftY);
    leftY += 5;
  }

  // Number / date block (right)
  const rightX = 140;
  let rightY = 30;
  const rightRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, rightX, rightY);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - 14, rightY, { align: "right" });
    doc.setFont("helvetica", "normal");
    rightY += 6;
  };
  rightRow(d.kind === "quotation" ? "Quote No:" : "Invoice No:", d.number || "—");
  rightRow("Date Issued:", d.dateIssued ? new Date(d.dateIssued).toLocaleDateString("en-GB") : "—");
  rightRow(d.kind === "quotation" ? "Valid Until:" : "Due Date:", d.dueOrValidUntil ? new Date(d.dueOrValidUntil).toLocaleDateString("en-GB") : "—");
  rightRow("Status:", (d.status || "draft").toUpperCase());

  const dividerY = Math.max(leftY, rightY) + 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(14, dividerY, pageWidth - 14, dividerY);

  // Customer block (left) / Terms+currency block (right)
  let cy = dividerY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...LABEL_COLOR);
  doc.text(d.kind === "quotation" ? "Prepared For:" : "Attention To:", 14, cy);
  doc.setTextColor(0);
  cy += 6;
  doc.setFontSize(11);
  doc.text(d.customer.name || "—", 14, cy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  cy += 5;
  const custLines: [string, string | null | undefined][] = [
    ["VRN:", d.customer.vrn], ["TIN:", d.customer.tin], ["Email:", d.customer.email], ["Phone:", d.customer.phone],
  ];
  for (const [label, value] of custLines) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, cy);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 14 + doc.getTextWidth(label) + 1.5, cy);
    cy += 5;
  }

  let ry = dividerY + 8;
  if (d.paymentTerms) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Pay. Terms:", rightX, ry);
    doc.setTextColor(0);
    const wrapped = doc.splitTextToSize(d.paymentTerms, 55);
    doc.text(wrapped, rightX, ry + 5);
    ry += 5 + wrapped.length * 4.2;
  }
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Currency:", rightX, ry);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`${d.currency}${d.fxRateToTzs ? `  (Rate: ${d.fxRateToTzs.toLocaleString()} TZS)` : ""}`, rightX + 20, ry);
  doc.setFont("helvetica", "normal");
  ry += 5;
  doc.setTextColor(...MUTED);
  doc.text("VAT Status:", rightX, ry);
  doc.setFont("helvetica", "bold");
  if (d.zeroRated) doc.setTextColor(...GREEN); else doc.setTextColor(0);
  doc.text(d.zeroRated ? "Zero Rated (0%)" : `Standard (${d.vatRate}%)`, rightX + 20, ry);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");

  const tableStartY = Math.max(cy, ry) + 8;
  const rows = d.lines.map((l) => [
    l.item_type_label ? `${l.description}\n${l.item_type_label}` : l.description,
    String(l.quantity ?? 1),
    fmtAmt(l.unit_price || 0),
    l.duration_days ? String(l.duration_days) : "—",
    fmtAmt(l.line_total || 0),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["Particulars", "Qty", `Unit Price (${d.currency})`, "Days", `Subtotal (${d.currency})`]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  // jspdf-autotable v5's functional autoTable() returns void — the result
  // lives on doc.lastAutoTable instead. Reading .finalY off the return
  // value throws "Cannot read properties of undefined", which silently
  // aborted every invoice/quotation PDF download before doc.save() ran.
  let y = (doc as any).lastAutoTable.finalY + 8;
  const totalsX = pageWidth - 14;
  const totalsLabelX = pageWidth - 60;
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Sub-Total:", totalsLabelX, y);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(fmtAmt(d.subtotal), totalsX, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("VAT:", totalsLabelX, y);
  doc.setFont("helvetica", "bold");
  if (d.zeroRated) doc.setTextColor(...GREEN); else doc.setTextColor(0);
  doc.text(d.zeroRated ? "Zero Rated (0%)" : fmtAmt(d.vatAmount), totalsX, y, { align: "right" });
  y += 7;
  doc.setDrawColor(200);
  doc.line(totalsLabelX, y - 4, totalsX, y - 4);
  doc.setFontSize(12);
  doc.setTextColor(...LABEL_COLOR);
  doc.text("Grand Total:", totalsLabelX, y);
  doc.text(fmtAmt(d.total), totalsX, y, { align: "right" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 12;

  if (d.kind === "quotation" && d.dueOrValidUntil) {
    doc.setFillColor(254, 243, 199);
    doc.rect(14, y - 5, pageWidth - 28, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`VALID UNTIL ${new Date(d.dueOrValidUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, pageWidth / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    y += 12;
  }

  if (d.company.bank_name) {
    doc.setFontSize(9);
    const bankRow = (label: string, value: string) => {
      doc.setTextColor(...MUTED);
      doc.text(label, 14, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(value, 45, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    };
    bankRow("Bank:", d.company.bank_name);
    if (d.company.bank_account_name) bankRow("A/C Name:", d.company.bank_account_name);
    if (d.company.bank_account_number_tzs || d.company.bank_account_number_usd) {
      bankRow("Account No.:", `${d.company.bank_account_number_tzs ? `TZS ${d.company.bank_account_number_tzs}` : ""} ${d.company.bank_account_number_usd ? `USD ${d.company.bank_account_number_usd}` : ""}`.trim());
    }
    if (d.company.bank_branch_code) bankRow("Branch Code:", d.company.bank_branch_code);
    if (d.company.bank_swift_code) bankRow("Swift Code:", d.company.bank_swift_code);
    y += 4;
  }

  if (d.kind === "invoice" && d.termsConditions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("TERMS & CONDITIONS", 14, y);
    y += 5;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    const clauses = d.termsConditions.split("\n").filter((c) => c.trim());
    clauses.forEach((clause, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${clause.trim()}`, pageWidth - 28);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4.5;
    });
    y += 4;
  }

  y += 8;
  doc.setDrawColor(0);
  doc.line(pageWidth - 70, y, pageWidth - 14, y);
  y += 4;
  doc.setFontSize(9);
  doc.text("Authorized Signature", pageWidth - 42, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text(d.company.company_name || "", pageWidth - 42, y, { align: "center" });

  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `This ${d.kind} was generated by the ${d.company.company_name || "company"} ${d.kind === "quotation" ? "Logistics" : "Rental"} System.`,
    pageWidth / 2, footerY, { align: "center" },
  );
  doc.text("Thank you for your trust and partnership!", pageWidth / 2, footerY + 4, { align: "center" });

  return doc;
}

export function downloadDocumentPdf(d: DocumentPdfData) {
  const doc = buildDocumentPdf(d);
  doc.save(`${d.number || d.kind}.pdf`);
}
