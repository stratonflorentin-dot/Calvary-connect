
"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, FileText, TrendingUp, TrendingDown, Image as ImageIcon, Coins, Calendar, DollarSign, Receipt, CreditCard } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';
import { toast } from '@/hooks/use-toast';

export function AccountantView() {
  const { user } = useSupabase();
  const { format, toggleCurrency, currency } = useCurrency();
  const { t } = useLanguage();

  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [sales, setSales] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [currentMonthReport, setCurrentMonthReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load real expenses
        const { data: expensesData } = await supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load real invoices
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load real trips as sales data
        const { data: tripsData } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load monthly reports
        const { data: reportsData } = await supabase
          .from('monthly_reports')
          .select('*')
          .order('month', { ascending: false });
        
        setExpenses(expensesData || []);
        setInvoices(invoicesData || []);
        setSales(tripsData || []);
        setMonthlyReports(reportsData || []);
        
        // Set current month report
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentReport = reportsData?.find(report => 
          report.month.toISOString().slice(0, 7) === currentMonth
        );
        setCurrentMonthReport(currentReport);
        
      } catch (error) {
        console.error('Error loading accountant data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Calculate totals from real data
  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const unpaidInvoicesCount =
    invoices?.filter((i) => {
      const s = (i.status || '').toLowerCase();
      return s && !['paid', 'settled', 'closed'].includes(s);
    }).length ?? 0;
  const totalRecordedSales = sales?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) ?? 0;

  // Generate monthly report
  const generateMonthlyReport = async () => {
    if (!user) return;
    
    try {
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      // Get all trips for this month
      const { data: monthTrips } = await supabase
        .from('trips')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      
      // Get all expenses for this month
      const { data: monthExpenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      
      // Get all allowances for this month
      const { data: monthAllowances } = await supabase
        .from('driver_allowances')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());
      
      // Calculate totals from real data
      const totalRevenue = monthTrips?.reduce((sum, trip) => {
        // Use real pricing from trip data or default to 0 if not set
        const tripRevenue = trip.revenue || trip.price || 0; // Use actual revenue if available
        return sum + Number(tripRevenue);
      }, 0) || 0;
      
      const totalExpenses = monthExpenses?.reduce((sum, expense) => 
        sum + (expense.amount || 0), 0
      ) || 0;
      
      const totalAllowances = monthAllowances?.reduce((sum, allowance) => 
        sum + (allowance.amount || 0), 0
      ) || 0;
      
      const netProfit = totalRevenue - totalExpenses - totalAllowances;
      
      // Create report object
      const reportData = {
        id: crypto.randomUUID(),
        month: monthStart.toISOString(),
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_allowances: totalAllowances,
        net_profit: netProfit,
        trip_count: monthTrips?.length || 0,
        expense_count: monthExpenses?.length || 0,
        generated_at: new Date().toISOString()
      };
      
      // Try to save to database, but don't fail if permissions blocked
      const { error: reportError } = await supabase.from('monthly_reports').insert({
        month: monthStart,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_allowances: totalAllowances,
        net_profit: netProfit,
        trip_count: monthTrips?.length || 0,
        expense_count: monthExpenses?.length || 0
      });
      
      if (reportError) {
        // Silently log errors - report will still display
        console.log('Note: Could not save report to database:', reportError.message);
      }
      
      // Always update UI with the calculated report (works even if DB save failed)
      setCurrentMonthReport(reportData);
      setMonthlyReports(prev => [reportData, ...prev.filter(r => r.month !== monthStart.toISOString())]);
      
      toast({ 
        title: "Report Generated", 
        description: `Revenue: ${format(totalRevenue)} | Expenses: ${format(totalExpenses)} | Net: ${format(netProfit)}` 
      });
    } catch (error: any) {
      console.error('Error generating monthly report:', error);
      toast({ 
        title: "Report Generation Failed", 
        description: "Failed to generate monthly report.",
        variant: "destructive"
      });
    }
  };

  // Approve expense
  const approveExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved' })
        .eq('id', expenseId);
      
      if (error) throw error;
      
      toast({ title: "Expense Approved", description: "Expense has been approved." });
      
      // Refresh expenses
      const { data: refreshedExpenses } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      setExpenses(refreshedExpenses || []);
      
    } catch (error: any) {
      toast({ 
        title: "Approval Failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline tracking-tighter">{t.financial_dashboard}</h1>
          <p className="text-muted-foreground text-sm">{t.audit_revenue}</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleCurrency} className="gap-2 rounded-full border-primary text-primary">
          <Coins className="size-4" />
          {currency === 'USD' ? 'USD' : 'TZS'}
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">{t.recent_expenses}</CardTitle>
            <TrendingDown className="size-5 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl xl:text-3xl font-headline">{format(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-primary-foreground/70">{t.unpaid_invoices}</CardTitle>
            <FileText className="size-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl xl:text-3xl font-headline">{unpaidInvoicesCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Recorded sales</CardTitle>
            <TrendingUp className="size-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl xl:text-3xl font-headline">{format(totalRecordedSales)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-widest text-white/80">Monthly Report</CardTitle>
            <Calendar className="size-5 text-white" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-lg font-headline">
                {currentMonthReport ? format(currentMonthReport.net_profit) : 'No Report'}
              </div>
              <Button 
                onClick={generateMonthlyReport}
                size="sm" 
                className="w-full bg-white text-blue-600 hover:bg-white/90"
              >
                {currentMonthReport ? 'Regenerate' : 'Generate'} Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-headline flex items-center gap-2">
            <FileText className="size-5" />
            Monthly Reports History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyReports.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No monthly reports generated yet</p>
              <p className="text-xs text-muted-foreground mt-2">Generate your first monthly report to see financial summaries</p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyReports.map((report) => (
                <div key={report.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">
                        {new Date(report.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Generated: {new Date(report.generated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={report.net_profit >= 0 ? 'default' : 'destructive'}>
                      {report.net_profit >= 0 ? 'Profit' : 'Loss'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold text-green-600">{format(report.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expenses</p>
                      <p className="font-semibold text-red-600">{format(report.total_expenses)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Allowances</p>
                      <p className="font-semibold text-blue-600">{format(report.total_allowances)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Profit</p>
                      <p className={`font-semibold ${report.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {format(report.net_profit)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <span className="mr-4">{report.trip_count} trips</span>
                    <span className="mr-4">{report.expense_count} expenses</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-headline">{t.approval_queue}</CardTitle>
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
                  <TableCell className="font-bold text-rose-600">-{format(expense.amount)}</TableCell>
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
};

export default AccountantView;
