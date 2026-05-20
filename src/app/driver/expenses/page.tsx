"use client";

import { useState } from "react";
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
  if (s === "approved") return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
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
      toast({ title: "Expense submitted", description: "Pending approval." });
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
          <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
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
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" required />
              </div>
              <div>
                <Label htmlFor="tripRef">Trip reference (optional)</Label>
                <Input id="tripRef" name="tripRef" placeholder="Trip # or route" />
              </div>
              <div>
                <Label htmlFor="receipt">Receipt upload</Label>
                <Input id="receipt" name="receipt" type="file" accept="image/*,.pdf" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading…</p>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Receipt className="size-10 mx-auto mb-3 opacity-40" />
            No expenses submitted yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((ex) => (
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
                    {String(ex.date || ex.created_at || "").slice(0, 10)}
                  </p>
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
