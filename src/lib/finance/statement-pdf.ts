import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/components/ui/currency-badge";
import type { DocumentCompanyInfo } from "@/lib/finance/document-pdf";

/** Same letterhead conventions as document-pdf.ts, adapted for a running
 * ledger (Statement of Accounts) instead of a single priced document. */

export interface StatementLine {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementPdfData {
  company: DocumentCompanyInfo;
  customer: { name: string; vrn?: string | null; tin?: string | null; email?: string | null; phone?: string | null };
  currency: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  lines: StatementLine[];
  closingBalance: number;
}

const MUTED: [number, number, number] = [110, 110, 110];
const LABEL_COLOR: [number, number, number] = [200, 30, 30];

export function buildStatementPdf(d: StatementPdfData): jsPDF {
  const doc = new jsPDF();
  const fmtAmt = (n: number) => formatCurrency(n, d.currency);
  const pageWidth = doc.internal.pageSize.getWidth();

  if (d.company.logoDataUrl) {
    const format = /data:image\/(\w+);/.exec(d.company.logoDataUrl)?.[1]?.toUpperCase() || "PNG";
    try { doc.addImage(d.company.logoDataUrl, format, pageWidth - 14 - 26, 8, 26, 16, undefined, "FAST"); } catch { /* soft-fail */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("STATEMENT OF ACCOUNTS", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(13);
  doc.text(d.company.company_name || "Company", 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let leftY = 35;
  const companyLines: [string, string | null | undefined][] = [
    ["VRN:", d.company.vat_registration],
    ["TIN:", d.company.tax_id],
    ["Phone:", d.company.phone],
    ["Email:", d.company.email],
  ];
  doc.setTextColor(0);
  for (const [label, value] of companyLines) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, leftY);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 14 + doc.getTextWidth(label) + 1.5, leftY);
    leftY += 5;
  }

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
  rightRow("Period:", `${new Date(d.fromDate).toLocaleDateString("en-GB")} – ${new Date(d.toDate).toLocaleDateString("en-GB")}`);
  rightRow("Currency:", d.currency);
  rightRow("Generated:", new Date().toLocaleDateString("en-GB"));

  const dividerY = Math.max(leftY, rightY) + 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(14, dividerY, pageWidth - 14, dividerY);

  let cy = dividerY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...LABEL_COLOR);
  doc.text("Statement For:", 14, cy);
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

  const tableStartY = cy + 8;
  const rows = [
    ["", "Opening Balance", "", "", "", fmtAmt(d.openingBalance)],
    ...d.lines.map((l) => [
      new Date(l.date).toLocaleDateString("en-GB"),
      l.description,
      l.reference,
      l.debit ? fmtAmt(l.debit) : "",
      l.credit ? fmtAmt(l.credit) : "",
      fmtAmt(l.balance),
    ]),
  ];

  autoTable(doc, {
    startY: tableStartY,
    head: [["Date", "Description", "Ref", "Debit", "Credit", "Balance"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === 0 && data.section === "body") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [248, 250, 252];
      }
    },
  });

  // jspdf-autotable v5's functional autoTable() returns void — the result
  // lives on doc.lastAutoTable instead. Reading .finalY off the return
  // value throws "Cannot read properties of undefined", which silently
  // aborted this download before doc.save() ever ran — the actual cause of
  // the "can't download PDF" report on this page.
  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setDrawColor(200);
  doc.line(pageWidth - 80, y - 4, pageWidth - 14, y - 4);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...LABEL_COLOR);
  doc.text("Closing Balance:", pageWidth - 80, y, { align: "left" });
  doc.text(fmtAmt(d.closingBalance), pageWidth - 14, y, { align: "right" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 12;

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
  }

  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `This statement was generated by the ${d.company.company_name || "company"} system and reflects the account as of ${new Date().toLocaleDateString("en-GB")}.`,
    pageWidth / 2, footerY, { align: "center" },
  );

  return doc;
}

export function downloadStatementPdf(d: StatementPdfData, filename: string) {
  const doc = buildStatementPdf(d);
  doc.save(filename);
}
