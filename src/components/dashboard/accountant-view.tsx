
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Wallet, FileText, TrendingUp, TrendingDown, Image as ImageIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function AccountantView() {
  const firestore = useFirestore();
  const { user } = useUser();

  const expenseQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'expenses'), orderBy('createdAt', 'desc'), limit(10));
  }, [firestore, user]);

  const { data: expenses } = useCollection(expenseQuery);

  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-headline tracking-tighter">Financial Dashboard</h1>
        <p className="text-muted-foreground text-sm">Audit company revenue and authorize expenditures.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Month-to-Date Expense</CardTitle>
            <TrendingDown className="size-5 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline">${totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-primary-foreground/70">Unpaid Invoices</CardTitle>
            <FileText className="size-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline">12</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Cash Reserves</CardTitle>
            <TrendingUp className="size-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline">$84,200</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-headline">Expense Approval Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses?.map(expense => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.category}</TableCell>
                  <TableCell>
                    {expense.photoUrl && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
                            <ImageIcon className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Expense Proof - {expense.category}</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4 space-y-4">
                            <div className="aspect-video rounded-xl overflow-hidden bg-muted border">
                              <img src={expense.photoUrl} alt="Receipt" className="w-full h-full object-contain" />
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg text-sm italic">
                              {expense.notes || "No additional notes provided."}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-rose-600">-${expense.amount}</TableCell>
                  <TableCell>
                    <Badge variant={expense.isApproved ? "default" : "secondary"}>
                      {expense.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!expense.isApproved && (
                      <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold">Review</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
