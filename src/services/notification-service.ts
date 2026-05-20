import { supabase } from "@/lib/supabase";

export type NotificationCategory =
  | "trip_assigned"
  | "fuel_approval"
  | "expense_approval"
  | "maintenance_update"
  | "delivery_update"
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
