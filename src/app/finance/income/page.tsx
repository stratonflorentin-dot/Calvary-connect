import { redirect } from "next/navigation";

// Legacy flat income ledger — revenue now enters via invoices/trips.
export default function FinanceIncomePage() {
  redirect("/finance/transactions/revenue");
}
