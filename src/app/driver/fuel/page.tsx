"use client";

import { useEffect, useState } from "react";
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
import { AlertTriangle, Fuel, Plus, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function fuelStatusTag(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return <IndustryTag variant="accent">Approved</IndustryTag>;
  if (s === "rejected") return <IndustryTag variant="danger">Rejected</IndustryTag>;
  return <IndustryTag variant="neutral">Pending</IndustryTag>;
}

type FlaggedAnomaly = {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  status: string;
  created_at: string;
  driver_response: { explanation: string; submitted_at: string } | null;
};

function FlaggedTransactions() {
  const { user } = useSupabase();
  const [anomalies, setAnomalies] = useState<FlaggedAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fuel_anomalies")
      .select("id, description, severity, status, created_at, driver_response")
      .eq("driver_id", user.id)
      .not("status", "in", "(resolved,dismissed,confirmed_fraud)")
      .order("created_at", { ascending: false });
    if (!error) setAnomalies(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submitExplanation = async (anomalyId: string) => {
    if (!explanation.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_fuel_anomaly_explanation", {
        p_anomaly_id: anomalyId,
        p_explanation: explanation.trim(),
        p_attachment_url: null,
      });
      if (error) throw error;
      toast({ title: "Explanation sent", description: "Your fleet manager will review it." });
      setReplyingTo(null);
      setExplanation("");
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not submit explanation", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || anomalies.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="ci-lbl flex items-center gap-1.5">
        <AlertTriangle className="size-3.5" /> Flagged for review
      </p>
      {anomalies.map((a) => (
        <IndustryCard key={a.id} className="border-[var(--ci-accent-800)]">
          <div className="flex items-center justify-between">
            <IndustryTag variant={a.severity === "high" ? "danger" : "warning"} className="capitalize">
              {a.severity} severity
            </IndustryTag>
            <span className="text-[10px] text-[var(--ci-text-tertiary)] ci-mono">{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-[13px] mt-1.5">{a.description}</p>
          {a.driver_response ? (
            <div className="mt-2 border-t border-[var(--ci-cell-divider)] pt-2 text-[12px] text-[var(--ci-text-secondary)]">
              <p className="font-semibold text-[var(--ci-text)] mb-0.5">Your explanation:</p>
              {a.driver_response.explanation}
            </div>
          ) : replyingTo === a.id ? (
            <div className="flex flex-col gap-2 mt-2">
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain this fuel transaction…"
                rows={3}
                className="text-[13px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]"
              />
              <div className="flex gap-2">
                <IndustryButton variant="secondary" onClick={() => { setReplyingTo(null); setExplanation(""); }}>Cancel</IndustryButton>
                <IndustryButton variant="primary" onClick={() => submitExplanation(a.id)} disabled={submitting || !explanation.trim()}>
                  {submitting ? "Sending…" : "Send explanation"}
                </IndustryButton>
              </div>
            </div>
          ) : (
            <IndustryButton variant="secondary" className="mt-2" onClick={() => setReplyingTo(a.id)}>
              Explain this transaction
            </IndustryButton>
          )}
        </IndustryCard>
      ))}
    </div>
  );
}

export default function DriverFuelPage() {
  const { user } = useSupabase();
  const { fuelRequests, loading, refresh } = useDriverData();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const amount = parseFloat(String(form.get("amount") || "0"));
    try {
      const { error } = await supabase.from("fuel_requests").insert([
        {
          driver_id: user.id,
          amount: Math.round(amount),
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      toast({ title: "Fuel request submitted", description: "Awaiting approval." });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit request";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IndustryDriverShell title="Fuel">
      <p className="text-[12px] text-[var(--ci-text-secondary)] -mt-1">Request fuel, track approvals, and upload receipts.</p>

      <IndustryDialog open={open} onOpenChange={setOpen}>
        <IndustryDialogTrigger asChild>
          <IndustryButton variant="primary" size="driver" className="gap-1.5">
            <Plus className="size-4" /> Request fuel
          </IndustryButton>
        </IndustryDialogTrigger>
        <IndustryDialogContent open={open}>
          <IndustryDialogTitle>New fuel request</IndustryDialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
            <div className="field">
              <label htmlFor="amount" className="ci-lbl block mb-1">Amount (litres or TZS)</label>
              <input id="amount" name="amount" type="number" min="1" required className="w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]" />
            </div>
            <div className="field">
              <label htmlFor="notes" className="ci-lbl block mb-1">Notes</label>
              <textarea id="notes" name="notes" placeholder="Station, odometer, etc." className="w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]" />
            </div>
            <div className="field">
              <label htmlFor="receipt" className="ci-lbl block mb-1">Receipt (optional)</label>
              <input id="receipt" name="receipt" type="file" accept="image/*,.pdf" className="w-full text-[13px]" />
            </div>
            <IndustryButton type="submit" variant="primary" size="driver" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </IndustryButton>
          </form>
        </IndustryDialogContent>
      </IndustryDialog>

      <FlaggedTransactions />

      {loading ? (
        <p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">Loading…</p>
      ) : fuelRequests.length === 0 ? (
        <IndustryCard className="items-center text-center py-8">
          <Fuel className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-[13px] text-[var(--ci-text-secondary)]">No fuel requests yet. Tap Request fuel to add one.</p>
        </IndustryCard>
      ) : (
        <div className="flex flex-col gap-3">
          {fuelRequests.map((req) => (
            <IndustryCard key={String(req.id)}>
              <div className="flex items-center justify-between">
                <p className="ci-mono text-[14px] font-bold">{String(req.amount)} units</p>
                {fuelStatusTag(String(req.status))}
              </div>
              <p className="text-[12px] text-[var(--ci-text-tertiary)] ci-mono mt-1">{new Date(String(req.created_at)).toLocaleDateString()}</p>
            </IndustryCard>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[var(--ci-text-tertiary)] flex items-center gap-1 mt-1">
        <Upload className="size-3" /> Attach receipts when submitting or after approval.
      </p>
    </IndustryDriverShell>
  );
}
