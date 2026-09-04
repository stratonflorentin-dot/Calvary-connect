"use client";

import { useState } from "react";
import { useDriverData } from "@/hooks/use-driver-data";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { IndustryDriverShell } from "@/components/driver/industry-driver-shell";
import { IndustryCard } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import {
  IndustryDialog,
  IndustryDialogTrigger,
  IndustryDialogContent,
  IndustryDialogTitle,
} from "@/components/industry/dialog";
import { Plus, Receipt } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import {
  fetchAccountantUserIds,
  notifyAccountantsExpenseSubmitted,
} from "@/services/notification-service";

const CATEGORIES = [
  { value: "fuel", label: "Fuel" },
  { value: "toll", label: "Toll" },
  { value: "parking", label: "Parking" },
  { value: "repairs", label: "Repairs" },
  { value: "meals", label: "Meals" },
  { value: "other", label: "Other" },
];

function expenseTag(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return <IndustryTag variant="accent">Approved</IndustryTag>;
  if (s === "rejected") return <IndustryTag variant="danger">Rejected</IndustryTag>;
  return <IndustryTag variant="neutral">Pending</IndustryTag>;
}

const fieldClass = "w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]";

export default function DriverExpensesPage() {
  const { user } = useSupabase();
  const { expenses, loading, refresh } = useDriverData();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("fuel");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const form = new FormData(e.currentTarget);

    try {
      const { error } = await supabase.from("expenses").insert([
        {
          description: String(form.get("description") || ""),
          amount: parseFloat(String(form.get("amount") || "0")),
          category,
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
          client_reference: String(form.get("tripRef") || ""),
          driver_id: user.id,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      const accountantIds = await fetchAccountantUserIds();
      const driverName = user.email?.split("@")[0] || "Driver";
      await notifyAccountantsExpenseSubmitted(
        driverName,
        parseFloat(String(form.get("amount") || "0")),
        accountantIds,
      );
      toast({ variant: "success", title: "Expense submitted", description: "Pending approval." });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit expense";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IndustryDriverShell title="My expenses">
      <p className="text-[12px] text-[var(--ci-text-secondary)] -mt-1">Submit expenses with receipts. You cannot approve expenses.</p>

      <IndustryDialog open={open} onOpenChange={setOpen}>
        <IndustryDialogTrigger asChild>
          <IndustryButton variant="primary" size="driver" className="gap-1.5">
            <Plus className="size-4" /> New expense
          </IndustryButton>
        </IndustryDialogTrigger>
        <IndustryDialogContent open={open}>
          <IndustryDialogTitle>Submit expense</IndustryDialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
            <div>
              <label className="ci-lbl block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} required className={fieldClass}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="amount" className="ci-lbl block mb-1">Amount</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" required inputMode="decimal" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="date" className="ci-lbl block mb-1">Date</label>
              <input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="description" className="ci-lbl block mb-1">Description</label>
              <textarea id="description" name="description" required rows={3} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="tripRef" className="ci-lbl block mb-1">Trip reference (optional)</label>
              <input id="tripRef" name="tripRef" placeholder="Trip # or route" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="receipt" className="ci-lbl block mb-1">Receipt upload</label>
              <input id="receipt" name="receipt" type="file" accept="image/*,.pdf" className="w-full text-[13px]" />
            </div>
            <IndustryButton type="submit" variant="primary" size="driver" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </IndustryButton>
          </form>
        </IndustryDialogContent>
      </IndustryDialog>

      {loading ? (
        <p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">Loading…</p>
      ) : expenses.length === 0 ? (
        <IndustryCard className="items-center text-center py-8">
          <Receipt className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-[13px] text-[var(--ci-text-secondary)]">No expenses submitted yet.</p>
        </IndustryCard>
      ) : (
        <div className="flex flex-col gap-3">
          {expenses.map((ex) => (
            <IndustryCard key={String(ex.id)}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-[13px] font-semibold capitalize">{String(ex.category || ex.type || "Expense")}</p>
                  <p className="text-[12px] text-[var(--ci-text-secondary)] line-clamp-2 mt-0.5">{String(ex.description || "")}</p>
                  <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono mt-1">{String(ex.date || ex.created_at || "").slice(0, 10)}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="ci-mono text-[14px] font-bold">{format(Number(ex.amount) || 0)}</p>
                  {expenseTag(String(ex.status))}
                </div>
              </div>
            </IndustryCard>
          ))}
        </div>
      )}
    </IndustryDriverShell>
  );
}
