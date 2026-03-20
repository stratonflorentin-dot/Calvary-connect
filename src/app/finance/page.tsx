
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
  Receipt, FileText, ShoppingCart, User as UserIcon, Plus, Save, FileEdit, Landmark,
  ArrowUpRight, ArrowDownLeft, CheckCircle2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function FinancePage() {
  const { role } = useRole();
  const { format, currency, toggleCurrency } = useCurrency();
  const firestore = useFirestore();
  const { user } = useUser();
  
  // State for the "Excel-like" report
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  
  const salesQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'sales'), orderBy('date', 'desc')) : null, [firestore, user]);
  const purchasesQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'purchases'), orderBy('date', 'desc')) : null, [firestore, user]);
  const expenseQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'expenses'), orderBy('createdAt', 'desc')) : null, [firestore, user]);
  const taxQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'taxes'), orderBy('period', 'desc')) : null, [firestore, user]);
  const reportsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'financial_reports'), orderBy('updatedAt', 'desc')) : null, [firestore, user]);
  const invoicesQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'invoices'), orderBy('dueDate', 'asc')) : null, [firestore, user]);

  const { data: sales } = useCollection(salesQuery);
  const { data: purchases } = useCollection(purchasesQuery);
  const { data: expenses } = useCollection(expenseQuery);
  const { data: taxes } = useCollection(taxQuery);
  const { data: reports } = useCollection(reportsQuery);
  const { data: invoices } = useCollection(invoicesQuery);

  const totalSales = sales?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalPurchases = purchases?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalTax = taxes?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const netProfit = totalSales - totalPurchases - totalExpenses - totalTax;

  const handleAddSale = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      clientName: formData.get('clientName') as string,
      amount: Number(formData.get('amount')),
      date: new Date().toISOString(),
      description: formData.get('description') as string,
      status: 'Paid' // Marking as Payment Received
    };
    addDocumentNonBlocking(collection(firestore, 'sales'), data);
    toast({ title: "Payment Received", description: `Recorded ${format(data.amount)} from ${data.clientName}` });
    e.currentTarget.reset();
  };

  const handleAddPurchase = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      vendorName: formData.get('vendorName') as string,
      amount: Number(formData.get('amount')),
      date: new Date().toISOString(),
      category: formData.get('category') as string,
      status: 'Paid' // Marking as Payment Given
    };
    addDocumentNonBlocking(collection(firestore, 'purchases'), data);
    toast({ title: "Payment Recorded", description: `Paid ${format(data.amount)} to ${data.vendorName}` });
    e.currentTarget.reset();
  };

  const handleSaveReport = () => {
    if (!firestore || !user || !reportTitle) {
      toast({ variant: "destructive", title: "Incomplete", description: "Please provide a title and content." });
      return;
    }
    const reportData = {
      title: reportTitle,
      content: reportContent,
      updatedAt: new Date().toISOString(),
      authorId: user.uid,
      year: new Date().getFullYear(),
      month: new Date().toLocaleString('default', { month: 'long' })
    };
    addDocumentNonBlocking(collection(firestore, 'financial_reports'), reportData);
    toast({ title: "Ledger Finalized", description: "Report has been archived in the system." });
    setReportTitle("");
    setReportContent("");
  };

  if (!['CEO', 'ACCOUNTANT'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Financial Command Center</h1>
            <p className="text-muted-foreground text-sm font-sans">Full ledger management for fleet logistics and corporate accounting.</p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2 bg-primary shadow-lg">
                  <Plus className="size-4" /> Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <Tabs defaultValue="sale">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="sale">Client Payment</TabsTrigger>
                    <TabsTrigger value="purchase">Vendor Payment</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sale">
                    <DialogHeader>
                      <CardTitle className="text-lg">Record Client Payment (Income)</CardTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddSale} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Client Name</Label>
                        <Input name="clientName" placeholder="E.g. Simba Logistics" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input name="amount" type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Service Description</Label>
                        <Textarea name="description" placeholder="Notes for this payment..." />
                      </div>
                      <Button type="submit" className="w-full">Confirm Receipt</Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="purchase">
                    <DialogHeader>
                      <CardTitle className="text-lg">Record Vendor Payment (Expense)</CardTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPurchase} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Vendor Name</Label>
                        <Input name="vendorName" placeholder="E.g. Fuel Depot Ltd." required />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input name="amount" type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input name="category" placeholder="Fuel, Maintenance, Office..." required />
                      </div>
                      <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">Confirm Payment</Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={toggleCurrency} className="gap-2 rounded-full border-primary text-primary">
              <Coins className="size-4" />
              {currency === 'USD' ? 'USD' : 'TZS'}
            </Button>
          </div>
        </header>

        {/* Excel-style Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <FinancialMetricCard title="Sales (Received)" value={totalSales} color="primary" icon={<ArrowUpRight className="size-4" />} />
          <FinancialMetricCard title="Payments (Given)" value={totalPurchases} color="rose" icon={<ArrowDownLeft className="size-4" />} />
          <FinancialMetricCard title="OpEx Total" value={totalExpenses} color="amber" icon={<Receipt className="size-4" />} />
          <FinancialMetricCard title="Tax Liability" value={totalTax} color="slate" icon={<Landmark className="size-4" />} />
          <FinancialMetricCard title="Net Profit" value={netProfit} color={netProfit >= 0 ? "emerald" : "destructive"} icon={<TrendingUp className="size-4" />} />
        </div>

        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="sales" className="rounded-lg gap-2"><ArrowUpRight className="size-4"/> Sales/Income</TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-lg gap-2"><ArrowDownLeft className="size-4"/> Purchases/Out</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg gap-2"><Receipt className="size-4"/> OpEx Receipts</TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg gap-2"><FileText className="size-4"/> Invoices</TabsTrigger>
            <TabsTrigger value="taxes" className="rounded-lg gap-2"><Landmark className="size-4"/> Tax Ledger</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg gap-2"><FileEdit className="size-4"/> Financial Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <LedgerTable 
              headers={["Client Name", "Date", "Status", "Amount"]}
              data={sales?.map(s => ({
                id: s.id,
                col1: s.clientName,
                col2: new Date(s.date).toLocaleDateString(),
                col3: <Badge className="bg-emerald-500">{s.status}</Badge>,
                col4: <span className="text-emerald-600 font-bold">+{format(s.amount)}</span>
              }))}
            />
          </TabsContent>

          <TabsContent value="purchases">
            <LedgerTable 
              headers={["Vendor/Supplier", "Date", "Category", "Amount"]}
              data={purchases?.map(p => ({
                id: p.id,
                col1: p.vendorName,
                col2: new Date(p.date).toLocaleDateString(),
                col3: p.category,
                col4: <span className="text-rose-600 font-bold">-{format(p.amount)}</span>
              }))}
            />
          </TabsContent>

          <TabsContent value="expenses">
            <LedgerTable 
              headers={["Description", "User", "Proof", "Amount"]}
              data={expenses?.map(e => ({
                id: e.id,
                col1: e.category,
                col2: "Employee",
                col3: e.photoUrl ? (
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1"><ImageIcon className="size-3"/> View</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl"><img src={e.photoUrl} className="w-full rounded-lg" alt="Receipt"/></DialogContent>
                  </Dialog>
                ) : "No Proof",
                col4: <span className="text-rose-500 font-bold">-{format(e.amount)}</span>
              }))}
            />
          </TabsContent>

          <TabsContent value="invoices">
            <LedgerTable 
              headers={["Client", "Due Date", "Status", "Amount"]}
              data={invoices?.map(i => ({
                id: i.id,
                col1: i.clientName,
                col2: i.dueDate,
                col3: <Badge variant="outline">{i.status}</Badge>,
                col4: <span className="font-bold">{format(i.amount)}</span>
              }))}
            />
          </TabsContent>

          <TabsContent value="taxes">
            <LedgerTable 
              headers={["Tax Type", "Period", "Status", "Amount"]}
              data={taxes?.map(t => ({
                id: t.id,
                col1: t.type,
                col2: t.period,
                col3: <Badge variant="secondary">{t.status}</Badge>,
                col4: <span className="font-bold">{format(t.amount)}</span>
              }))}
            />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b mb-4">
                <CardTitle className="text-lg font-headline">Generate Financial Summary</CardTitle>
                <Button onClick={handleSaveReport} className="gap-2 rounded-full"><Save className="size-4"/> Finalize Ledger</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Report Title</Label>
                    <Input 
                      value={reportTitle} 
                      onChange={(e) => setReportTitle(e.target.value)} 
                      placeholder="E.g. Q3 Logistics Performance Report" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Financial Analysis (Excel-style Worksheet Summary)</Label>
                  <Textarea 
                    value={reportContent} 
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="Provide a detailed breakdown of revenue streams, driver payouts, and maintenance overheads..."
                    className="min-h-[300px] border-muted font-mono text-sm p-4"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="font-headline text-lg flex items-center gap-2"><CheckCircle2 className="size-5 text-primary"/> Historical Audit Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reports?.map(r => (
                  <Card key={r.id} className="rounded-2xl shadow-sm border bg-white p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-bold text-sm text-primary">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{r.month} {r.year}</p>
                      </div>
                      <FileEdit className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4 italic bg-muted/20 p-3 rounded-lg">"{r.content}"</p>
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                       <span className="text-[9px] text-muted-foreground">Updated: {new Date(r.updatedAt).toLocaleDateString()}</span>
                       <Button variant="link" size="sm" className="h-auto p-0 text-xs">View Full</Button>
                    </div>
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

function FinancialMetricCard({ title, value, color, icon }: { title: string, value: number, color: string, icon: React.ReactNode }) {
  const { format } = useCurrency();
  return (
    <Card className={cn("rounded-2xl border-none shadow-sm", `bg-${color}-50`)}>
      <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
        <span className={cn("text-[9px] font-sans font-bold uppercase tracking-widest", `text-${color}-600`)}>{title}</span>
        <div className={cn("p-1.5 rounded-full bg-white text-primary shadow-sm")}>{icon}</div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={cn("text-lg font-headline truncate", value < 0 ? "text-rose-600" : `text-${color}-900`)}>
          {format(Math.abs(value))}
        </div>
      </CardContent>
    </Card>
  );
}

function LedgerTable({ headers, data }: { headers: string[], data: any[] | undefined }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i} className={cn(i === headers.length - 1 && "text-right", "px-6")}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-6 font-medium">{row.col1}</TableCell>
              <TableCell>{row.col2}</TableCell>
              <TableCell>{row.col3}</TableCell>
              <TableCell className="text-right px-6 font-bold">{row.col4}</TableCell>
            </TableRow>
          ))}
          {(!data || data.length === 0) && (
            <TableRow><TableCell colSpan={headers.length} className="text-center py-12 text-muted-foreground italic">No entries in this ledger.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
