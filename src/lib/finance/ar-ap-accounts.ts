import { supabase } from "@/lib/supabase";

/**
 * Resolves the Accounts Receivable / Payable COA code by name + currency
 * rather than a fixed code — same reasoning as engine.ts's
 * resolveCashAdvanceAccountCode: this chart has duplicate "Accounts
 * Payable" rows (2001, 2101) from its migration history, so this always
 * picks a real, active, postable match instead of trusting one hardcoded
 * code that might not exist for a given currency.
 */
async function resolveAccountCode(namePattern: string, category: string, currency: string): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("code")
    .ilike("name", namePattern)
    .eq("category", category)
    .eq("currency", currency)
    .eq("is_postable", true)
    .eq("is_active", true)
    .order("code")
    .limit(1)
    .maybeSingle();
  return data?.code ?? null;
}

export function resolveReceivableAccountCode(currency: string): Promise<string | null> {
  return resolveAccountCode("%receivable%", "ASSETS", currency);
}

export function resolvePayableAccountCode(currency: string): Promise<string | null> {
  return resolveAccountCode("%accounts payable%", "LIABILITIES", currency);
}
