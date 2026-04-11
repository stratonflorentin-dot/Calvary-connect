"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface IncomeRecord {
  id: string;
  source: string;
  amount: number;
  date: string;
  notes?: string;
}

export default function IncomePage() {
  const [income, setIncome] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ source: "", amount: "", date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadIncome = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("income").select("*").order("date", { ascending: false });
      if (!error) setIncome(data || []);
      setLoading(false);
    };
    loadIncome();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("income").insert({
      source: form.source,
      amount: Number(form.amount),
      date: form.date,
      notes: form.notes,
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    if (!error) {
      setDialogOpen(false);
      setForm({ source: "", amount: "", date: "", notes: "" });
      // Reload
      const { data } = await supabase.from("income").select("*").order("date", { ascending: false });
      setIncome(data || []);
    } else {
      alert("Failed to add income record.");
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Income Records</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Income</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Income Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Input id="source" name="source" value={form.source} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="number" value={form.amount} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" value={form.date} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" value={form.notes} onChange={handleChange} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : income.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No income records found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {income.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell>{row.date ? new Date(row.date).toLocaleDateString() : ""}</TableCell>
                    <TableCell>{row.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




