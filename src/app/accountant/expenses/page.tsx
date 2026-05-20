"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Download,
  Receipt,
  DollarSign,
  Clock,
  MessageSquare,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  expenseAmount,
  expenseCategory,
  expenseComment,
  expenseDate,
  expenseDescription,
  expenseReceiptUrl,
  expenseReference,
  expenseStatus,
  exportExpensesCsv,
  type ExpenseRow,
} from "@/lib/expense-utils";
import { createNotification } from "@/services/notification-service";

const REVIEW_ROLES = ["ACCOUNTANT", "CEO", "ADMIN", "HR"];

export default function AccountantExpensesPage() {
  const { role } = useRole();
  const { format } = useCurrency();
  const { user } = useSupabase();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [commentExpense, setCommentExpense] = useState<ExpenseRow | null>(null);
  const [accountantComment, setAccountantComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (role && !REVIEW_ROLES.includes(role)) {
      window.location.replace("/");
    }
  }, [role]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return expenses;
    return expenses.filter((e) => expenseStatus(e) === statusFilter);
  }, [expenses, statusFilter]);

  const pending = expenses.filter((e) => expenseStatus(e) === "pending");
  const approved = expenses.filter((e) => expenseStatus(e) === "approved");
  const rejected = expenses.filter((e) => expenseStatus(e) === "rejected");
  const totalAmount = expenses.reduce((s, e) => s + expenseAmount(e), 0);

  const notifyDriver = async (
    expense: ExpenseRow,
    status: "approved" | "rejected",
  ) => {
    const driverId = String(expense.driver_id || "");
    if (!driverId) return;
    await createNotification({
      userId: driverId,
      category: "expense_approval",
      title: status === "approved" ? "Expense approved" : "Expense rejected",
      message: `Your expense "${expenseDescription(expense)}" (${format(expenseAmount(expense))}) was ${status}.`,
      severity: status === "approved" ? "success" : "warning",
    });
  };

  const updateStatus = async (
    expense: ExpenseRow,
    status: "approved" | "rejected",
    comment?: string,
  ) => {
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      approved_by: user?.id,
    };
    if (comment !== undefined) payload.accountant_comment = comment;

    const { error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", expense.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await notifyDriver(expense, status);
    toast({ title: `Expense ${status}` });
    setCommentExpense(null);
    setAccountantComment("");
    load();
  };

  const saveCommentOnly = async () => {
    if (!commentExpense) return;
    const { error } = await supabase
      .from("expenses")
      .update({
        accountant_comment: accountantComment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentExpense.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Comment saved" });
    setCommentExpense(null);
    load();
  };

  if (!role || !REVIEW_ROLES.includes(role)) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">
                Expense Review
              </h1>
              <p className="text-muted-foreground">
                Review, approve, reject, and export operational expenses.
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => exportExpensesCsv(filtered)}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" /> Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{pending.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{approved.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <XCircle className="size-4 text-rose-600" /> Rejected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{rejected.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="size-4" /> Total Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{format(totalAmount)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Label>Filter by status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="p-8 text-center text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">No expenses found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((expense) => {
                      const status = expenseStatus(expense);
                      const receipt = expenseReceiptUrl(expense);
                      return (
                        <TableRow key={String(expense.id)}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{expenseDescription(expense)}</p>
                              {expenseReference(expense) && (
                                <p className="text-xs text-muted-foreground">
                                  Ref: {expenseReference(expense)}
                                </p>
                              )}
                              {expenseComment(expense) && (
                                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                                  <MessageSquare className="size-3" />
                                  {expenseComment(expense)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {expenseCategory(expense)}
                          </TableCell>
                          <TableCell>{format(expenseAmount(expense))}</TableCell>
                          <TableCell>{expenseDate(expense)}</TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                status === "approved" && "bg-emerald-500",
                                status === "rejected" && "bg-rose-500",
                                status === "pending" && "bg-amber-500",
                              )}
                            >
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {receipt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReceiptUrl(receipt)}
                              >
                                <Receipt className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCommentExpense(expense);
                                setAccountantComment(expenseComment(expense));
                              }}
                            >
                              Note
                            </Button>
                            {status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-700"
                                  onClick={() =>
                                    updateStatus(expense, "approved", accountantComment || undefined)
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-rose-700"
                                  onClick={() =>
                                    updateStatus(expense, "rejected", accountantComment || undefined)
                                  }
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!commentExpense} onOpenChange={() => setCommentExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accountant comment</DialogTitle>
          </DialogHeader>
          <Textarea
            value={accountantComment}
            onChange={(e) => setAccountantComment(e.target.value)}
            rows={4}
            placeholder="Notes for the driver or internal review…"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveCommentOnly}>
              Save comment
            </Button>
            {commentExpense && expenseStatus(commentExpense) === "pending" && (
              <>
                <Button
                  onClick={() =>
                    updateStatus(commentExpense, "approved", accountantComment)
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    updateStatus(commentExpense, "rejected", accountantComment)
                  }
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptUrl} onOpenChange={() => setReceiptUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptUrl && (
            <img src={receiptUrl} alt="Receipt" className="w-full rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
