"use client";

import { useState } from "react";
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
import { Fuel, Plus, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function fuelStatusBadge(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
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
