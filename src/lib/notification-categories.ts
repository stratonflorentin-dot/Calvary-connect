export const ALLOWED_NOTIFICATION_CATEGORIES = [
  "trip_assigned",
  "fuel_approval",
  "expense_approval",
  "maintenance_update",
  "delivery_update",
] as const;

export function isAllowedNotification(row: Record<string, unknown>): boolean {
  const cat = String(row.category || "general").toLowerCase();
  if (cat === "general") return false;
  return (ALLOWED_NOTIFICATION_CATEGORIES as readonly string[]).includes(cat);
}
