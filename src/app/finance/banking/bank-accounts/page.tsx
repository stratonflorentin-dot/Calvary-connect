"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Landmark, ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  balance: number;
  currency: string;
  account_type: string;
  is_active: boolean;
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    balance: 0,
    currency: "TZS",
    account_type: "current",
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("currency, bank_name");

    if (error) {
      toast({ variant: "destructive", title: "Error loading accounts", description: error.message });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingAccount) {
      const { error } = await supabase
        .from("bank_accounts")
        .update(formData)
        .eq("id", editingAccount.id);

      if (error) {
        toast({ variant: "destructive", title: "Error updating account", description: error.message });
        return;
      }
      toast({ title: "Account updated successfully" });
    } else {
      const { error } = await supabase.from("bank_accounts").insert([formData]);

      if (error) {
        toast({ variant: "destructive", title: "Error creating account", description: error.message });
        return;
      }
      toast({ title: "Account created successfully" });
    }

    setDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      account_name: "",
      account_number: "",
      bank_name: "",
      balance: 0,
      currency: "TZS",
      account_type: "current",
      is_active: true,
    });
    loadAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this account?")) return;

    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error deleting account", description: error.message });
      return;
    }
    toast({ title: "Account deleted successfully" });
    loadAccounts();
  }

  function handleEdit(account: BankAccount) {
    setEditingAccount(account);
    setFormData({
      account_name: account.account_name,
      account_number: account.account_number,
      bank_name: account.bank_name,
      balance: account.balance,
      currency: account.currency,
      account_type: account.account_type,
      is_active: account.is_active,
    });
    setDialogOpen(true);
  }

  function handleAddNew() {
    setEditingAccount(null);
    setFormData({
      account_name: "",
      account_number: "",
      bank_name: "",
      balance: 0,
      currency: "TZS",
      account_type: "current",
      is_active: true,
    });
    setDialogOpen(true);
  }

  // Group accounts by currency
  const accountsByCurrency = accounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = [];
    }
    acc[account.currency].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mb-4">
          <Button variant="ghost" asChild>
            <Link href="/finance/dashboard">
              <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading bank accounts...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={handleAddNew}>
          <Plus className="size-4 mr-2" /> Add Account
        </Button>
      </div>

      {Object.keys(accountsByCurrency).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5" /> Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No bank accounts found. Click "Add Account" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(accountsByCurrency).map(([currency, currencyAccounts]) => {
            const totalBalance = currencyAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            const currencyInfo = AVAILABLE_CURRENCIES.find(c => c.code === currency) || AVAILABLE_CURRENCIES[0];

            return (
              <Card key={currency}>
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <span className="text-2xl">{currencyInfo.flag}</span>
                      <span>{currencyInfo.name}</span>
                      <CurrencyBadge currency={currency} />
                    </CardTitle>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalBalance, currency)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {currencyAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{account.account_name}</h3>
                            {!account.is_active && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {account.bank_name} - {account.account_number}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {account.account_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{formatCurrency(account.balance, currency)}</p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(account)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(account.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                required
                placeholder="e.g., NMB Operations Account"
              />
            </div>
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                required
                placeholder="e.g., NMB Bank"
              />
            </div>
            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                required
                placeholder="e.g., 1234567890"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_CURRENCIES.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.flag} {curr.name} ({curr.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="balance">Balance</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAccount ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
