import { supabase } from "@/lib/supabase";

export type NotificationCategory =
  | "trip_assigned"
  | "fuel_approval"
  | "expense_approval"
  | "maintenance_update"
  | "delivery_update"
  | "accounting_revenue"
  | "accounting_expense"
  | "sales_payment"
  | "payment_dispute"
  | "general";

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity?: "info" | "success" | "warning" | "critical";
}) {
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    title: params.title,
    message: params.message,
    category: params.category,
    severity: params.severity || "info",
    is_read: false,
    read: false,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("notifications").insert([payload]);
  if (error) console.warn("[createNotification]", error.message);
}

export async function notifyAccountantsExpenseSubmitted(
  driverName: string,
  amount: number,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        category: "expense_approval",
        title: "Expense pending review",
        message: `${driverName} submitted an expense of ${amount} for approval.`,
        severity: "warning",
      }),
    ),
  );
}

export async function fetchAccountantUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .in("role", ["ACCOUNTANT", "CEO", "ADMIN", "HR"]);
  return (data || []).map((u) => u.id);
}

export async function fetchSalesmanUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .in("role", ["SALESMAN", "CEO", "ADMIN"]);
  return (data || []).map((u) => u.id);
}

// Notify accountants about new trip revenue
export async function notifyAccountantsTripRevenue(
  tripId: string,
  origin: string,
  destination: string,
  amount: number,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        category: "accounting_revenue",
        title: "New Trip Revenue Recorded",
        message: `Trip ${origin} → ${destination} generated ${amount} TZS in revenue. Journal entry created.`,
        severity: "success",
      }),
    ),
  );
}

// Notify sales team about payment status updates
export async function notifySalesTeamPaymentStatus(
  tripId: string,
  clientName: string,
  status: "paid" | "pending" | "overdue",
  amount: number,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        category: "sales_payment",
        title: `Payment ${status.toUpperCase()}`,
        message: `Client ${clientName} payment of ${amount} TZS is now ${status}.`,
        severity: status === "paid" ? "success" : status === "overdue" ? "critical" : "warning",
      }),
    ),
  );
}

// Notify about payment disputes
export async function notifyPaymentDispute(
  tripId: string,
  clientName: string,
  amount: number,
  reason: string,
  accountantIds: string[],
  salesmanIds: string[],
) {
  const allIds = [...new Set([...accountantIds, ...salesmanIds])];
  
  await Promise.all(
    allIds.map((id) =>
      createNotification({
        userId: id,
        category: "payment_dispute",
        title: "Payment Dispute Raised",
        message: `Client ${clientName} disputes payment of ${amount} TZS. Reason: ${reason}`,
        severity: "critical",
      }),
    ),
  );
}

// Notify accountants about new expenses
export async function notifyAccountantsNewExpense(
  expenseType: string,
  amount: number,
  submittedBy: string,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        category: "accounting_expense",
        title: "New Expense Submitted",
        message: `${submittedBy} submitted ${expenseType} expense of ${amount} TZS for review.`,
        severity: "warning",
      }),
    ),
  );
}
