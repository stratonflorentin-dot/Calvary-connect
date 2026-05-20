export type ExpenseRow = Record<string, unknown>;

export function expenseAmount(e: ExpenseRow): number {
  return Number(e.amount) || 0;
}

export function expenseStatus(e: ExpenseRow): string {
  return String(e.status || "pending").toLowerCase();
}

export function expenseCategory(e: ExpenseRow): string {
  return String(e.category || e.type || "other");
}

export function expenseDate(e: ExpenseRow): string {
  const d = e.date || e.expense_date || e.created_at;
  return d ? String(d).slice(0, 10) : "";
}

export function expenseDescription(e: ExpenseRow): string {
  return String(e.description || "");
}

export function expenseReceiptUrl(e: ExpenseRow): string | null {
  const url = e.receipt_url || e.receiptUrl;
  return url ? String(url) : null;
}

export function expenseReference(e: ExpenseRow): string {
  return String(e.client_reference || e.clientReference || "");
}

export function expenseComment(e: ExpenseRow): string {
  return String(e.accountant_comment || e.accountantComment || "");
}

export function exportExpensesCsv(rows: ExpenseRow[]): void {
  const headers = [
    "id",
    "description",
    "category",
    "amount",
    "date",
    "status",
    "reference",
    "accountant_comment",
  ];
  const lines = rows.map((e) =>
    [
      e.id,
      expenseDescription(e).replace(/,/g, ";"),
      expenseCategory(e),
      expenseAmount(e),
      expenseDate(e),
      expenseStatus(e),
      expenseReference(e).replace(/,/g, ";"),
      expenseComment(e).replace(/,/g, ";"),
    ].join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expense-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
