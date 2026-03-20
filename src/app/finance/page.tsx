
"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useFirestore, useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, Wallet, Image as ImageIcon, Coins, 
  Receipt, FileText, ShoppingCart, User as UserIcon, Plus, Save, FileEdit, Landmark
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function FinancePage() {
  const { role } = useRole();
  const { format, currency, toggleCurrency } = useCurrency();
  const firestore = useFirestore();
  const { user } = useUser();
  const [reportText, setReportText] = useState("");
  
  const salesQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'sales'), orderBy('date', 'desc')) : null, [firestore, user]);
  const purchasesQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'purchases'), orderBy('date', 'desc')) : null, [firestore, user]);
  const expenseQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'expenses'), orderBy('createdAt', 'desc')) : null, [firestore, user]);
  const taxQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'taxes'), orderBy('period', 'desc')) : null, [firestore, user]);
  const reportsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'financial_reports'), orderBy('updatedAt', 'desc')) : null, [firestore, user]);

  const { data: sales } = useCollection(salesQuery);
  const { data: purchases } = useCollection(purchasesQuery);
  const { data: expenses } = useCollection(expenseQuery);
  const { data: taxes } = useCollection(taxQuery);
  const { data: reports } = useCollection(reportsQuery);

  const totalSales = sales?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalPurchases = purchases?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const netProfit = totalSales - totalPurchases - totalExpenses;

  const handleAddSale = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      clientName: formData.get('clientName') as string,
      amount: Number(formData.get('amount')),
      date: new Date().toISOString(),
      description: formData.get('description') as string,
      status: 'Paid'
    };
    addDocumentNonBlocking(collection(firestore, 'sales'), data);
    toast({ title: "Sale Recorded", description: `Received ${format(data.amount)} from ${data.clientName}` });
    e.currentTarget.reset();
  };

  const handleSaveReport = () => {
    if (!firestore || !user) return;
    const reportData = {
      title: `Financial Report - ${new Date().toLocaleDateString()}`,
      content: reportText,
      updatedAt: new Date().toISOString(),
      authorId: user.uid
    };
    addDocumentNonBlocking(collection(firestore, 'financial_reports'), reportData);
    toast({ title: "Report Saved", description: "The financial report has been archived." });
    setReportText("");
  };

  if (!['CEO', 'ACCOUNTANT'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Financial Command Center</h1>
            <p className="text-muted-foreground text-sm">Comprehensive ledger for sales, purchases, and reporting.</p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2 bg-primary">
                  <Plus className="size-4" /> New Transaction
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record New Sale</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSale} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input id="clientName" name="clientName" placeholder="Client Ltd." required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Notes</Label>
                    <Textarea id="description" name="description" placeholder="Service details..." />
                  </div>
                  <Button type="submit" className="w-full">Confirm Sale</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={toggleCurrency} className="gap-2 rounded-full border-primary text-primary">
              <Coins className="size-4" />
              {currency === 'USD' ? 'USD' : 'TZS'}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-primary-foreground/70">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline">{format(totalSales)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline text-rose-500">{format(totalPurchases)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">OpEx</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline text-rose-600">{format(totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline" style={{ color: netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                {format(netProfit)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="sales" className="rounded-lg gap-2"><TrendingUp className="size-4"/> Sales</TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-lg gap-2"><ShoppingCart className="size-4"/> Purchases</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg gap-2"><Receipt className="size-4"/> Expenses</TabsTrigger>
            <TabsTrigger value="taxes" className="rounded-lg gap-2"><Landmark className="size-4"/> Tax</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg gap-2"><FileEdit className="size-4"/> Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold"><div className="flex items-center gap-2"><UserIcon className="size-3 text-muted-foreground"/> {s.clientName}</div></TableCell>
                      <TableCell className="text-xs">{new Date(s.date).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{s.status}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">+{format(s.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="purchases">
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases?.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.vendorName}</TableCell>
                      <TableCell className="text-xs">{p.category}</TableCell>
                      <TableCell className="text-right font-bold text-rose-600">-{format(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="expenses">
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.category}</TableCell>
                      <TableCell>
                        {e.photoUrl ? (
                          <Dialog>
                            <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1"><ImageIcon className="size-3"/> View</Button></DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <img src={e.photoUrl} className="w-full rounded-lg" alt="Receipt"/>
                            </DialogContent>
                          </Dialog>
                        ) : "None"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-rose-500">-{format(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="taxes">
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Tax Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxes?.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.type}</TableCell>
                      <TableCell className="text-xs">{t.period}</TableCell>
                      <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{format(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-headline">Write Financial Report</CardTitle>
                <Button onClick={handleSaveReport} className="gap-2"><Save className="size-4"/> Save Report</Button>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={reportText} 
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Summarize the current financial state, margin improvements, and future projections..."
                  className="min-h-[200px] border-muted bg-muted/20"
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="font-headline text-lg">Report Archive</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports?.map(r => (
                  <Card key={r.id} className="rounded-2xl shadow-sm border bg-white p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-sm">{r.title}</p>
                      <time className="text-[10px] text-muted-foreground">{new Date(r.updatedAt).toLocaleDateString()}</time>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 italic">"{r.content}"</p>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
