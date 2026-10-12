"use client";

import { useEffect, useState } from "react";
import { DriverShell } from "@/components/driver/driver-shell";
import { useDriverData } from "@/hooks/use-driver-data";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Receipt } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/use-currency";
import { uploadToBucket } from "@/lib/storage-upload";
import { SyncManager } from "@/lib/offline-sync";
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

function expenseBadge(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "approved") return <Badge className="bg-success/10 text-success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

export default function DriverExpensesPage() {
  const { user } = useSupabase();
  const { expenses, trips, loading, refresh } = useDriverData();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("fuel");
  const [tripId, setTripId] = useState("none");
  const [pendingExpenses, setPendingExpenses] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const refreshPending = () => setPendingExpenses(SyncManager.getPending()
      .filter((request) => request.table === "expenses" && request.data?.driver_id === user?.id)
      .map((request) => ({ ...request.data, id: `offline-${request.id}`, _offline_pending: true })));
    refreshPending();
    const onSynced = () => { refreshPending(); refresh(); };
    window.addEventListener("fleet:offline-sync-complete", onSynced);
    return () => window.removeEventListener("fleet:offline-sync-complete", onSynced);
  }, [user?.id, refresh]);

  const attachReceipt = async (expenseId: string, file?: File) => {
    if (!user || !file) return;
    if (!SyncManager.isOnline()) {
      toast({ title: "You are offline", description: "Reconnect before uploading this receipt.", variant: "destructive" });
      return;
    }
    const receiptUrl = await uploadToBucket("documents", `driver-expenses/${user.id}`, file, `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
    if (!receiptUrl) { toast({ title: "Receipt upload failed", description: "Please try again.", variant: "destructive" }); return; }
    const { error } = await supabase.rpc("attach_driver_expense_receipt", { p_expense_id: expenseId, p_receipt_url: receiptUrl });
    if (error) { toast({ title: "Could not attach receipt", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Receipt attached" }); refresh();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const selectedTrip = trips.find((trip) => String(trip.id) === tripId);
    const expenseData: Record<string, unknown> = {
      id: crypto.randomUUID(),
      description: String(form.get("description") || ""),
      amount: parseFloat(String(form.get("amount") || "0")),
      category,
      date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
      client_reference: String(form.get("tripRef") || ""),
      trip_id: selectedTrip?.id ?? null,
      vehicle_id: (selectedTrip?.vehicle_id || selectedTrip?.truck_id || null) as string | null,
      receipt_url: null,
      driver_id: user.id,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (!SyncManager.isOnline()) {
        await SyncManager.queueRequest("expenses", "INSERT", expenseData, true, false);
        toast({ title: "Expense saved on this device", description: "It will sync when the connection returns. You can attach its receipt after sync." });
        setPendingExpenses(SyncManager.getPending().filter((request) => request.table === "expenses" && request.data?.driver_id === user.id).map((request) => ({ ...request.data, id: `offline-${request.id}`, _offline_pending: true })));
        setOpen(false); setTripId("none"); (e.target as HTMLFormElement).reset(); refresh();
        return;
      }
      const receipt = form.get("receipt");
      if (receipt instanceof File && receipt.size > 0) {
        const receiptUrl = await uploadToBucket("documents", `driver-expenses/${user.id}`, receipt, `${Date.now()}-${receipt.name.replace(/[^\w.-]/g, "_")}`);
        if (!receiptUrl && !SyncManager.isOnline()) {
          await SyncManager.queueRequest("expenses", "INSERT", expenseData, true, false);
          toast({ title: "Expense saved on this device", description: "It will sync when the connection returns. You can attach its receipt after sync." });
          setPendingExpenses(SyncManager.getPending().filter((request) => request.table === "expenses" && request.data?.driver_id === user.id).map((request) => ({ ...request.data, id: `offline-${request.id}`, _offline_pending: true })));
          setOpen(false); setTripId("none"); (e.target as HTMLFormElement).reset(); refresh();
          return;
        }
        if (!receiptUrl) throw new Error("Receipt upload failed. Please try again.");
        expenseData.receipt_url = receiptUrl;
      }
      let error: { message: string } | null = null;
      try { ({ error } = await supabase.from("expenses").insert(expenseData)); }
      catch (err) { error = { message: err instanceof Error ? err.message : "Network request failed" }; }
      if (error && /failed to fetch|network|fetch error/i.test(error.message)) {
        expenseData.receipt_url = null;
        await SyncManager.queueRequest("expenses", "INSERT", expenseData, true, false);
        toast({ title: "Expense saved on this device", description: "It will sync when the connection returns. You can attach its receipt after sync." });
        setPendingExpenses(SyncManager.getPending().filter((request) => request.table === "expenses" && request.data?.driver_id === user.id).map((request) => ({ ...request.data, id: `offline-${request.id}`, _offline_pending: true })));
        setOpen(false); setTripId("none"); (e.target as HTMLFormElement).reset(); refresh();
        return;
      }

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
      setTripId("none");
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
    <DriverShell
      title="My Expenses"
      description="Submit expenses with receipts. You cannot approve expenses."
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="size-4" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Submit expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required className="h-11" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" required className="min-h-[80px]" />
              </div>
              <div>
                <Label>Trip / truck (optional)</Label>
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choose an assigned trip" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No trip</SelectItem>
                    {trips.map((trip) => <SelectItem key={String(trip.id)} value={String(trip.id)}>
                      {String(trip.trip_number || `Trip ${String(trip.id).slice(0, 8)}`)} · {String(trip.origin || "")} → {String(trip.destination || "")}
                    </SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" name="tripRef" value={selectedTripLabel(trips, tripId)} />
              </div>
              <div>
                <Label htmlFor="receipt">Receipt upload</Label>
                <Input id="receipt" name="receipt" type="file" accept="image/*,.pdf" className="h-11" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading…</p>
      ) : expenses.length + pendingExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Receipt className="size-10 mx-auto mb-3 opacity-40" />
            No expenses submitted yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...pendingExpenses, ...expenses].map((ex) => (
            <Card key={String(ex.id)}>
              <CardContent className="p-4 flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-sm capitalize">
                    {String(ex.category || ex.type || "Expense")}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {String(ex.description || "")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(ex.date || ex.created_at || "").slice(0, 10)}{ex.client_reference ? ` · ${String(ex.client_reference)}` : ""}{ex._offline_pending ? " · Waiting to sync" : ""}
                  </p>
                  {ex.receipt_url ? <a href={String(ex.receipt_url)} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View receipt</a> : !ex._offline_pending ? <label className="text-xs text-primary underline cursor-pointer">Attach receipt<input className="sr-only" type="file" accept="image/*,.pdf" onChange={(event) => { const file = event.currentTarget.files?.[0]; void attachReceipt(String(ex.id), file); event.currentTarget.value = ""; }} /></label> : <span className="text-xs text-muted-foreground">Receipt can be attached after sync</span>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-sm">{format(Number(ex.amount) || 0)}</p>
                  {expenseBadge(String(ex.status))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DriverShell>
  );
}

function selectedTripLabel(trips: Record<string, unknown>[], id: string) {
  const trip = trips.find((item) => String(item.id) === id);
  return trip ? String(trip.trip_number || `${trip.origin || ""} - ${trip.destination || ""}`) : "";
}
