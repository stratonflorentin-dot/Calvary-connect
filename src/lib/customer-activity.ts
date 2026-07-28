import { supabase } from "@/lib/supabase";

export type CustomerActivityType = "booking" | "quotation" | "contract" | "payment" | "complaint" | "follow_up";

/**
 * Populates customer_activities — a table that existed in the schema but
 * nothing ever wrote to, so the per-customer activity timeline was always
 * empty. Called at each real customer-touching event going forward; history
 * before this was added can't be reconstructed. Fire-and-forget: a failure
 * here should never block the booking/quotation/contract/payment action
 * that triggered it.
 */
export async function logCustomerActivity(params: {
  customerId: string | null | undefined;
  activityType: CustomerActivityType;
  description: string;
  amount?: number;
  createdBy?: string | null;
}) {
  if (!params.customerId) return;
  try {
    await supabase.from("customer_activities").insert({
      customer_id: params.customerId,
      activity_type: params.activityType,
      description: params.description,
      amount: params.amount ?? null,
      created_by: params.createdBy ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[logCustomerActivity]", err);
  }
}
