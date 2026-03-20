"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Wallet, Image as ImageIcon, Coins } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function FinancePage() {
  const { role } = useRole();
  const { format, currency, toggleCurrency } = useCurrency();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const incomeQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'income');
  }, [firestore, user]);

  const expenseQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'expenses');
  }, [firestore, user]);

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
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Financial Ledger</h1>
            <p className="text-muted-foreground text-sm">Real-time tracking of revenue and expenditures.</p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleCurrency} className="gap-2 rounded-full border-primary text-primary">
            <Coins className="size-4" />
            Switch to {currency === 'USD' ? 'TZS' : 'USD'}
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-primary-foreground/70">Total Revenue</CardTitle>
              <TrendingUp className="size-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-headline">{format(totalIncome)}</div>
              <p className="text-xs text-primary-foreground/60 mt-1">+12.5% from last month</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Expenses</CardTitle>
              <TrendingDown className="size-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-headline">{format(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending approval: {format(1240)}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Net Profit</CardTitle>
              <Wallet className="size-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-3xl font-headline" style={{ color: netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                {format(netProfit)}
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
                      <TableCell className="text-right font-medium text-emerald-600">+{format(item.amount)}</TableCell>
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
                    <TableHead>Proof</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.category}</TableCell>
                      <TableCell>
                        {item.photoUrl ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-primary hover:text-primary">
                                <ImageIcon className="size-3" /> View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Expense Evidence</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4 aspect-video rounded-xl overflow-hidden bg-muted">
                                <img 
                                  src={item.photoUrl} 
                                  alt="Receipt proof" 
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="mt-4 space-y-2">
                                <p className="text-sm font-bold">{item.category} - {format(item.amount)}</p>
                                <p className="text-xs text-muted-foreground">{item.notes}</p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No image</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.isApproved ? 'bg-emerald-500' : 'bg-amber-500'}>
                          {item.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-600">-{format(item.amount)}</TableCell>
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
