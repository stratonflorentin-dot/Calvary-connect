
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Wallet, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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
                <TableHead>Reporter</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses?.map(expense => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{expense.reporterUserId?.slice(0, 8) || 'System'}</TableCell>
                  <TableCell className="font-bold text-rose-600">-${expense.amount}</TableCell>
                  <TableCell>
                    <Badge variant={expense.isApproved ? "default" : "secondary"}>
                      {expense.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!expense.isApproved && <button className="text-[10px] font-bold text-primary hover:underline">Review</button>}
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
