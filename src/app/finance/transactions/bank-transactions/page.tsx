"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Landmark, ArrowLeft, Plus, RefreshCw, ArrowUp, ArrowDown, ArrowRightLeft, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";

type BankTransaction = {
  id?: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
  currency?: string;
  transaction_type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "reversal";
  matched?: boolean;
  matched_to_id?: string;
  matched_to_type?: string;
};

type BankAccount = {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  balance: number;
  currency: string;
};

type TransactionFormState = {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string;
  amount: string;
  currency: string;
  transaction_type: BankTransaction["transaction_type"];
  to_account_id: string;
};

export default function BankTransactionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [transactionForm, setTransactionForm] = useState<TransactionFormState>({
    bank_account_id: "",
    transaction_date: "",
    description: "",
    reference: "",
    amount: "",
    currency: "TZS",
    transaction_type: "deposit",
    to_account_id: "",
  });

  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [transData, accountsData] = await Promise.all([
        supabase.from("bank_transactions").select("*").order("transaction_date", { ascending: false }),
        supabase.from("bank_accounts").select("*"),
      ]);

      setTransactions(transData.data || []);
      setBankAccounts(accountsData.data || []);
      if (accountsData.data && accountsData.data.length > 0) {
        setSelectedAccountId(accountsData.data[0].id);
        setTransactionForm({ ...transactionForm, bank_account_id: accountsData.data[0].id });
      }
    } catch (err) {
      console.error("Error loading bank transactions:", err);
      toast({ title: "Error", description: "Failed to load bank transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const calculateRunningBalance = (accountId: string): BankTransaction[] => {
    const accountTransactions = transactions
      .filter((t) => t.bank_account_id === accountId)
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    let runningBalance = 0;
    return accountTransactions.map((t) => {
      runningBalance += t.credit - t.debit;
      return { ...t, balance: runningBalance };
    });
  };

  const filteredTransactions = selectedAccountId
    ? calculateRunningBalance(selectedAccountId)
    : [];

  const saveTransaction = async () => {
    if (!transactionForm.bank_account_id || !transactionForm.transaction_date || !transactionForm.amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const amount = parseFloat(transactionForm.amount);
      const isDeposit = transactionForm.transaction_type === "deposit" || transactionForm.transaction_type === "transfer_in";

      if (editingTransaction?.id) {
        // Amount/type/account changes affect bank_accounts.current_balance and
        // must go through post_bank_transaction to stay accurate — editing
        // here is limited to non-financial fields. Delete + re-create to
        // change the amount, direction, or account.
        const { error } = await supabase
          .from("bank_transactions")
          .update({ description: transactionForm.description, reference: transactionForm.reference })
          .eq("id", editingTransaction.id);
        if (error) throw error;
      } else {
        // Atomically deducts/credits bank_accounts.current_balance and
        // records the bank_transactions row (post_bank_transaction, migration
        // 035) instead of the old direct insert, which never touched the
        // account balance at all.
        const { error: txError } = await supabase.rpc("post_bank_transaction", {
          p_bank_account_id: transactionForm.bank_account_id,
          p_amount: amount,
          p_direction: isDeposit ? "in" : "out",
          p_transaction_type: transactionForm.transaction_type,
          p_currency: transactionForm.currency,
          p_description: transactionForm.description,
          p_reference: transactionForm.reference || null,
          p_transaction_date: transactionForm.transaction_date,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (txError) throw txError;

        // If transfer, credit the destination account too.
        if (transactionForm.transaction_type === "transfer_out" && transactionForm.to_account_id) {
          const { error: transferError } = await supabase.rpc("post_bank_transaction", {
            p_bank_account_id: transactionForm.to_account_id,
            p_amount: amount,
            p_direction: "in",
            p_transaction_type: "transfer_in",
            p_currency: transactionForm.currency,
            p_description: `Transfer from: ${transactionForm.description}`,
            p_reference: transactionForm.reference || null,
            p_transaction_date: transactionForm.transaction_date,
            p_idempotency_key: crypto.randomUUID(),
          });
          if (transferError) throw transferError;
        }
      }

      await loadTransactions();
      setModal(null);
      setTransactionForm({
        bank_account_id: selectedAccountId,
        transaction_date: "",
        description: "",
        reference: "",
        amount: "",
        currency: "TZS",
        transaction_type: "deposit",
        to_account_id: "",
      });
      setEditingTransaction(null);
      toast({ title: "Success", description: editingTransaction ? "Transaction updated" : "Transaction saved" });
    } catch (err) {
      console.error("Error saving transaction:", err);
      toast({ title: "Error", description: "Failed to save transaction", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const txn = transactions.find((t) => t.id === id);
      if (txn && (txn.debit > 0 || txn.credit > 0)) {
        // Reverse the balance impact before removing the row — a plain
        // DELETE would leave bank_accounts.current_balance permanently
        // out of sync with the transaction history.
        const amount = txn.debit > 0 ? txn.debit : txn.credit;
        const { error: reverseError } = await supabase.rpc("post_bank_transaction", {
          p_bank_account_id: txn.bank_account_id,
          p_amount: amount,
          p_direction: txn.debit > 0 ? "in" : "out",
          p_transaction_type: "reversal",
          p_currency: txn.currency || "TZS",
          p_description: `Reversal of deleted transaction: ${txn.description}`,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (reverseError) throw reverseError;
      }

      const { error } = await supabase.from("bank_transactions").delete().eq("id", id);
      if (error) throw error;
      await loadTransactions();
      toast({ title: "Success", description: "Transaction deleted and balance reversed" });
    } catch (err) {
      console.error("Error deleting transaction:", err);
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    }
  };

  const editTransaction = (transaction: BankTransaction) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      bank_account_id: transaction.bank_account_id,
      transaction_date: transaction.transaction_date,
      description: transaction.description,
      reference: transaction.reference || "",
      amount: String(transaction.debit || transaction.credit),
      currency: "TZS",
      transaction_type: transaction.transaction_type,
      to_account_id: "",
    });
    setModal("transaction");
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "transfer_in":
        return <ArrowUp className="size-4 text-success" />;
      case "withdrawal":
      case "transfer_out":
        return <ArrowDown className="size-4 text-destructive" />;
      default:
        return <Landmark className="size-4" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge className="bg-success/10 text-success border-success/20">Deposit</Badge>;
      case "withdrawal":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Withdrawal</Badge>;
      case "transfer_in":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Transfer In</Badge>;
      case "transfer_out":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Transfer Out</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadTransactions} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-5" /> Bank Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Label>Select Bank Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} - {account.account_number} ({formatAmount(account.balance, account.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={modal === "transaction"} onOpenChange={(open) => setModal(open ? "transaction" : null)}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" /> New Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingTransaction ? "Edit Transaction" : "New Transaction"}</DialogTitle>
                </DialogHeader>
                {editingTransaction && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Only description and reference can be edited here — delete and re-create the transaction to change the amount, type, or account.
                  </p>
                )}
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <Select
                      disabled={!!editingTransaction}
                      value={transactionForm.transaction_type}
                      onValueChange={(value: any) => setTransactionForm({ ...transactionForm, transaction_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                        <SelectItem value="transfer_out">Transfer Out</SelectItem>
                        <SelectItem value="transfer_in">Transfer In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Select disabled={!!editingTransaction} value={transactionForm.bank_account_id} onValueChange={(value) => setTransactionForm({ ...transactionForm, bank_account_id: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name} - {account.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {transactionForm.transaction_type === "transfer_out" && (
                    <div className="space-y-2">
                      <Label>To Account</Label>
                      <Select value={transactionForm.to_account_id} onValueChange={(value) => setTransactionForm({ ...transactionForm, to_account_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.filter((a) => a.id !== transactionForm.bank_account_id).map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_name} - {account.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input disabled={!!editingTransaction} type="number" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={transactionForm.transaction_date} onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (Optional)</Label>
                    <Input value={transactionForm.reference} onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setModal(null); setEditingTransaction(null); }}>Cancel</Button>
                    <Button onClick={saveTransaction} disabled={submitting}>
                      {submitting ? "Saving..." : editingTransaction ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.transaction_type)}
                          {getTransactionBadge(transaction.transaction_type)}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="text-muted-foreground">{transaction.reference || "-"}</TableCell>
                      <TableCell className={transaction.debit > 0 ? "text-destructive font-medium" : ""}>
                        {transaction.debit > 0 ? formatAmount(transaction.debit) : "-"}
                      </TableCell>
                      <TableCell className={transaction.credit > 0 ? "text-success font-medium" : ""}>
                        {transaction.credit > 0 ? formatAmount(transaction.credit) : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{formatAmount(transaction.balance)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => editTransaction(transaction)}>
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteTransaction(transaction.id!)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
