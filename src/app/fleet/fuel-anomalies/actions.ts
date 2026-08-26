"use server";

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Deactivates the fuel card linked to a flagged transaction. A separate,
 * explicitly-clicked, ADMIN/CEO-only action (gated in the UI, same as every
 * other server action in this codebase — see markPayrollPaidAction) rather
 * than an automatic side effect of any fuel_anomalies status transition:
 * the spec this was built against is explicit that consequential actions
 * like card suspension need their own authorized human step, not to happen
 * quietly alongside "start investigation".
 */
export async function lockFuelCardAction(fuelLogId: string, actorId: string, reason: string) {
  try {
    const admin = getAdminClient();

    const { data: fuelLog, error: fuelLogErr } = await admin
      .from("fuel_logs")
      .select("fuel_card_id")
      .eq("id", fuelLogId)
      .maybeSingle();
    if (fuelLogErr) throw fuelLogErr;
    if (!fuelLog?.fuel_card_id) {
      return { success: false, error: "This transaction has no fuel card linked to lock." };
    }

    const { data: card, error: cardErr } = await admin
      .from("fuel_cards")
      .select("id, card_number, status")
      .eq("id", fuelLog.fuel_card_id)
      .maybeSingle();
    if (cardErr) throw cardErr;
    if (!card) return { success: false, error: "Linked fuel card not found." };
    if (card.status === "deactivated") return { success: true, alreadyLocked: true };

    const { error: updateErr } = await admin
      .from("fuel_cards")
      .update({ status: "deactivated" })
      .eq("id", card.id);
    if (updateErr) throw updateErr;

    await admin.from("audit_trail").insert([{
      user_id: actorId,
      module: "operations",
      action: "update",
      entity_type: "fuel_card",
      entity_id: card.id,
      old_value: { status: "active" },
      new_value: { status: "deactivated" },
      description: `Locked fuel card ${card.card_number} pending investigation${reason ? `: ${reason}` : ""}`,
    }]);

    return { success: true, cardNumber: card.card_number };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to lock fuel card" };
  }
}
