"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export default function FinancePage() {
  const { role } = useRole();
  const firestore = useFirestore();
  
  const incomeQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'income');
  }, [firestore]);

  const expenseQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'expenses');
  }, [firestore]);

  const { data: income } = useCollection(incomeQuery);
  const { data: expenses } = useCollection(expenseQuery);

  const totalIncome = income?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const netProfit = totalIncome - totalExpenses;

  if (!['CEO', 'ACCOUNTANT'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Financial Ledger</h1>
          <p className="text-muted-foreground text-sm">Real-time tracking of revenue and expenditures.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-primary-foreground/70">Total Revenue</CardTitle>
              <TrendingUp className="size-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">${totalIncome.toLocaleString()}</div>
              <p className="text-xs text-primary-foreground/60 mt-1">+12.5% from last month</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Expenses</CardTitle>
              <TrendingDown className="size-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">${totalExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending approval: $1,240</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Net Profit</CardTitle>
              <Wallet className="size-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline" style={{ color: netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                ${netProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Operating margin: 34%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-xl font-headline tracking-tighter">Recent Income</h2>
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {income?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.notes || 'Trip Delivery Payment'}</TableCell>
                      <TableCell><Badge variant="outline">{item.paymentMethod}</Badge></TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">+${item.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-headline tracking-tighter">Recent Expenses</h2>
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.category}</TableCell>
                      <TableCell>
                        <Badge className={item.isApproved ? 'bg-emerald-500' : 'bg-amber-500'}>
                          {item.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-600">-${item.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
