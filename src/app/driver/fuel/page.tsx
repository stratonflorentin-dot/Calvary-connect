"use client";

import { useEffect, useState } from "react";
import { DriverShell } from "@/components/driver/driver-shell";
import { useDriverData } from "@/hooks/use-driver-data";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Fuel, Plus, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function fuelStatusBadge(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return <Badge className="bg-success/10 text-success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
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
    <div className="space-y-3 mb-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="size-3.5 text-warning" /> Flagged for review
      </h3>
      {anomalies.map((a) => (
        <Card key={a.id} className="border-warning/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={cn(a.severity === "high" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning", "capitalize")}>
                {a.severity} severity
              </Badge>
              <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-foreground">{a.description}</p>
            {a.driver_response ? (
              <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-0.5">Your explanation:</p>
                {a.driver_response.explanation}
              </div>
            ) : replyingTo === a.id ? (
              <div className="space-y-2">
                <Textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain this fuel transaction…"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setExplanation(""); }}>Cancel</Button>
                  <Button size="sm" onClick={() => submitExplanation(a.id)} disabled={submitting || !explanation.trim()}>
                    {submitting ? "Sending…" : "Send explanation"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setReplyingTo(a.id)}>
                Explain this transaction
              </Button>
            )}
          </CardContent>
        </Card>
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
    <DriverShell
      title="Fuel"
      description="Request fuel, track approvals, and upload receipts."
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="size-4" />
              Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>New fuel request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (litres or TZS)</Label>
                <Input id="amount" name="amount" type="number" min="1" required />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Station, odometer, etc." />
              </div>
              <div>
                <Label htmlFor="receipt">Receipt (optional)</Label>
                <Input id="receipt" name="receipt" type="file" accept="image/*,.pdf" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <FlaggedTransactions />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading…</p>
      ) : fuelRequests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Fuel className="size-10 mx-auto mb-3 opacity-40" />
            No fuel requests yet. Tap Request to add one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fuelRequests.map((req) => (
            <Card key={String(req.id)}>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">
                  {String(req.amount)} units
                </CardTitle>
                {fuelStatusBadge(String(req.status))}
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
                <p>
                  {new Date(String(req.created_at)).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-4">
        <Upload className="size-3" />
        Attach receipts when submitting or after approval.
      </p>
    </DriverShell>
  );
}
