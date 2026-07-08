export const ALLOWED_NOTIFICATION_CATEGORIES = [
  "trip_assigned",
  "fuel_approval",
  "expense_approval",
  "maintenance_update",
  "delivery_update",
  "operations",
  "finance",
  "hr",
  "maintenance",
] as const;

export function isAllowedNotification(row: Record<string, unknown>): boolean {
  const cat = String(row.category || row.module || row.type || "general").toLowerCase();
  if (cat === "general") return false;
  return (ALLOWED_NOTIFICATION_CATEGORIES as readonly string[]).includes(cat);
}
