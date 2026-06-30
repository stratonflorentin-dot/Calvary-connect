"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { DollarSign, Plus, Trash2, Pencil, Calendar, TrendingUp, RefreshCw, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { CurrencySelector } from "@/components/finance/currency-selector";
import { supabase } from "@/lib/supabase";

interface Income {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  category?: string;
  source?: string;
  created_at: string;
}

export default function IncomePage() {
  const { toast } = useToast();
  const { role } = useRole();
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "TZS",
    date: new Date().toISOString().split("T")[0],
    status: "received",
    category: "",
    source: "",
  });

  useEffect(() => {
    loadIncome();
  }, []);

  async function loadIncome() {
    setLoading(true);
    const { data, error } = await supabase
      .from("income")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Error loading income", description: error.message });
    } else {
      setIncome(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingIncome) {
      const { error } = await supabase
        .from("income")
        .update({
          description: formData.description,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          date: formData.date,
          status: formData.status,
          category: formData.category,
          source: formData.source,
        })
        .eq("id", editingIncome.id);

      if (error) {
        toast({ variant: "destructive", title: "Error updating income", description: error.message });
        return;
      }
      toast({ title: "Income updated successfully" });
    } else {
      const { error } = await supabase.from("income").insert([{
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        date: formData.date,
        status: formData.status,
        category: formData.category,
        source: formData.source,
      }]);

      if (error) {
        toast({ variant: "destructive", title: "Error creating income", description: error.message });
        return;
      }
      toast({ title: "Income recorded successfully" });
    }

    setDialogOpen(false);
    setEditingIncome(null);
    setFormData({
      description: "",
      amount: "",
      currency: "TZS",
      date: new Date().toISOString().split("T")[0],
      status: "received",
      category: "",
      source: "",
    });
    loadIncome();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("income").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error deleting income", description: error.message });
    } else {
      toast({ title: "Income deleted successfully" });
      loadIncome();
    }
  }

  function handleEdit(incomeItem: Income) {
    setEditingIncome(incomeItem);
    setFormData({
      description: incomeItem.description,
      amount: incomeItem.amount.toString(),
      currency: incomeItem.currency,
      date: incomeItem.date,
      status: incomeItem.status,
      category: incomeItem.category || "",
      source: incomeItem.source || "",
    });
    setDialogOpen(true);
  }

  // Calculate totals by currency
  const totalsByCurrency = AVAILABLE_CURRENCIES.map(currency => {
    const currencyIncome = income.filter(i => i.currency === currency.code);
    const total = currencyIncome.reduce((sum, i) => sum + i.amount, 0);
    return {
      ...currency,
      total,
      count: currencyIncome.length,
    };
  }).filter(c => c.total > 0);

  const filteredIncome = selectedCurrency === "ALL" 
    ? income 
    : income.filter(i => i.currency === selectedCurrency);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Income Management</h1>
                <p className="text-muted-foreground">Track and manage all income sources</p>
              </div>
              <div className="flex gap-2">
                <CurrencySelector 
                  selectedCurrency={selectedCurrency} 
                  onCurrencyChange={setSelectedCurrency}
                />
                <Button variant="outline" onClick={loadIncome} disabled={loading}>
                  <RefreshCw className="size-4 mr-2" /> Refresh
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingIncome(null);
                      setFormData({
                        description: "",
                        amount: "",
                        currency: "TZS",
                        date: new Date().toISOString().split("T")[0],
                        status: "received",
                        category: "",
                        source: "",
                      });
                    }}>
                      <Plus className="size-4 mr-2" /> Add Income
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingIncome ? "Edit Income" : "Add New Income"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="amount">Amount</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="currency">Currency</Label>
                          <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_CURRENCIES.map((curr) => (
                                <SelectItem key={curr.code} value={curr.code}>
                                  {curr.flag} {curr.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="received">Received</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="expected">Expected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="e.g., Sales, Services"
                          />
                        </div>
                        <div>
                          <Label htmlFor="source">Source</Label>
                          <Input
                            id="source"
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            placeholder="e.g., Client A, Product X"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingIncome ? "Update" : "Add"} Income
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          {/* Summary Cards by Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {totalsByCurrency.map((currencyTotal) => (
              <Card key={currencyTotal.code}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="text-xl">{currencyTotal.flag}</span>
                    {currencyTotal.name}
                    <CurrencyBadge currency={currencyTotal.code} size="sm" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(currencyTotal.total, currencyTotal.code)}
                      </p>
                      <p className="text-xs text-muted-foreground">{currencyTotal.count} transactions</p>
                    </div>
                    <DollarSign className="size-8 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Income Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5" />
                Income Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredIncome.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No income records found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncome.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>
                          {item.category && <Badge variant="secondary">{item.category}</Badge>}
                        </TableCell>
                        <TableCell>{item.source || "-"}</TableCell>
                        <TableCell>
                          <CurrencyBadge currency={item.currency} size="sm" />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(item.amount, item.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "received" ? "default" : item.status === "pending" ? "secondary" : "outline"}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
