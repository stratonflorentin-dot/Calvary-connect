/**
 * HR Responsibilities
 *
 * 1. Recruitment and Hiring
 *    - Identify job needs
 *    - Write job descriptions
 *    - Advertise positions
 *    - Screen CVs and interview candidates
 *    - Select and onboard new employees
 * 2. Training and Development
 *    - Organize employee training
 *    - Improve skills and productivity
 *    - Plan career growth paths
 *    - Run workshops and mentorship programs
 * 3. Payroll and Compensation
 *    - Process salaries
 *    - Manage bonuses and incentives
 *    - Handle benefits like insurance and leave
 *    - Ensure fair and competitive pay
 * 4. Employee Relations
 *    - Handle conflicts between employees
 *    - Address complaints
 *    - Maintain discipline
 *    - Build a positive work environment
 * 5. Performance Management
 *    - Set performance standards
 *    - Conduct appraisals
 *    - Track employee progress
 *    - Support underperforming staff
 * 6. Compliance and Legal
 *    - Ensure company follows labor laws
 *    - Maintain employee records
 *    - Handle contracts and policies
 *    - Reduce legal risks
 * 7. Health and Safety
 *    - Ensure safe working conditions
 *    - Enforce safety policies
 *    - Handle workplace accidents
 * 8. Employee Engagement
 *    - Improve motivation and satisfaction
 *    - Organize team activities
 *    - Retain top talent
 * 9. Organizational Planning
 *    - Plan workforce needs
 *    - Structure departments
 *    - Support company growth strategy
 *
 * 10. Vehicle & Road Insurance
 *    - Manage all vehicle insurance policies
 *    - Handle renewals and claims for vehicle insurance
 *    - Oversee road insurance for all company vehicles
 *    - Ensure compliance with legal insurance requirements
 */

"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { SupabaseService } from '@/services/supabase-service';
import { rowsToCsv, downloadCsv } from '@/lib/export-csv';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Wallet, Image as ImageIcon, Coins,
  Receipt,   FileText, ShoppingCart, User as UserIcon, Plus, Save, FileEdit, Landmark,
  ArrowUpRight, ArrowDownLeft, CheckCircle2, Truck, Users as UsersIcon, Download, Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Utility to get editable fields for each ledger type
const LEDGER_FIELDS: { [key: string]: { key: string; label: string; type: string; required: boolean }[] } = {
  sales: [
    { key: 'clientName', label: 'Client Name', type: 'text', required: true },
    { key: 'amount', label: 'Total Amount (Including VAT)', type: 'number', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: false },
    { key: 'status', label: 'Status', type: 'text', required: true },
  ],
  purchases: [
    { key: 'clientName', label: 'Vendor Name', type: 'text', required: true },
    { key: 'receiptId', label: 'Receipt ID (from your receipt)', type: 'text', required: true },
    { key: 'amount', label: 'Total Amount (Including VAT)', type: 'number', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'category', label: 'Category (Fuel, Maintenance, etc.)', type: 'text', required: false },
  ],
  expenses: [
    { key: 'category', label: 'Description', type: 'text', required: true },
    { key: 'userName', label: 'User Name', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
    { key: 'photoUrl', label: 'Proof (URL)', type: 'text', required: false },
    { key: 'clientReference', label: 'Client / Trip Reference', type: 'text', required: false },
    { key: 'createdAt', label: 'Date', type: 'date', required: true },
  ],
  taxes: [
    { key: 'type', label: 'Tax Type', type: 'text', required: true },
    { key: 'period', label: 'Period', type: 'text', required: true },
    { key: 'status', label: 'Status', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
  ],
  invoices: [
    { key: 'clientName', label: 'Client', type: 'text', required: true },
    { key: 'dueDate', label: 'Due Date', type: 'date', required: true },
    { key: 'status', label: 'Status', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
  ],
  fuel_requests: [
    { key: 'driverName', label: 'Driver Name', type: 'text', required: false },
    { key: 'vehicleId', label: 'Vehicle ID', type: 'text', required: false },
    { key: 'fuelStation', label: 'Fuel Station', type: 'text', required: true },
    { key: 'verificationId', label: 'Receipt Verification ID', type: 'text', required: true },
    { key: 'createdAt', label: 'Date', type: 'date', required: true },
    { key: 'status', label: 'Status', type: 'text', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
  ],
  allowances: [
    { key: 'workerName', label: 'Worker Name', type: 'text', required: true },
    { key: 'role', label: 'Role', type: 'text', required: true },
    { key: 'userId', label: 'Worker user ID (for driver app)', type: 'text', required: false },
    { key: 'createdAt', label: 'Date', type: 'date', required: true },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
  ],
};

import { cn } from '@/lib/utils';

export default function FinancePage() {
  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean, ledger: string | null, entry: any | null }>({ open: false, ledger: null, entry: null });

  // Handle opening edit dialog
  const handleOpenEdit = (ledger: string, entry: any) => {
    setEditDialog({ open: true, ledger, entry });
  };

  // Handle saving edit
  const ledgerToCollection = (ledger: string) => {
    if (ledger === 'fuel') return 'fuel_requests';
    return ledger;
  };

  const handleSaveEdit = async (updated: any) => {
    if (!editDialog.ledger || !editDialog.entry?.id) return;
    
    try {
      let result: any;
      switch (editDialog.ledger) {
        case 'sales':
          result = await SupabaseService.updateSale(editDialog.entry.id, updated);
          setSales(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'purchases':
          result = await SupabaseService.updatePurchase(editDialog.entry.id, updated);
          setPurchases(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'expenses':
          result = await SupabaseService.updateExpense(editDialog.entry.id, updated);
          setExpenses(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'fuel_requests':
          result = await SupabaseService.updateFuelRequest(editDialog.entry.id, updated);
          setFuelRequests(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'allowances':
          result = await SupabaseService.createAllowance({...updated, id: editDialog.entry.id});
          setAllowances(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'invoices':
          result = await SupabaseService.updateInvoice(editDialog.entry.id, updated);
          setInvoices(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
        case 'taxes':
          result = await SupabaseService.updateTax(editDialog.entry.id, updated);
          setTaxes(prev => prev.map(item => item.id === editDialog.entry.id ? result : item));
          break;
      }
      
      setEditDialog({ open: false, ledger: null, entry: null });
      toast({ title: "Entry Updated", description: "Changes saved to database." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update entry.", variant: "destructive" });
    }
  };

  const handleDeleteEntry = async () => {
    if (!editDialog.ledger || !editDialog.entry?.id || (role !== 'CEO' && role !== 'ADMIN')) return;
    
    try {
      switch (editDialog.ledger) {
        case 'sales':
          await SupabaseService.deleteSale(editDialog.entry.id);
          setSales(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
        case 'purchases':
          await SupabaseService.deletePurchase(editDialog.entry.id);
          setPurchases(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
        case 'expenses':
          await SupabaseService.deleteExpense(editDialog.entry.id);
          setExpenses(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
        case 'fuel_requests':
          await SupabaseService.deleteFuelRequest(editDialog.entry.id);
          setFuelRequests(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
        case 'invoices':
          await SupabaseService.deleteInvoice(editDialog.entry.id);
          setInvoices(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
        case 'taxes':
          await SupabaseService.deleteTax(editDialog.entry.id);
          setTaxes(prev => prev.filter(item => item.id !== editDialog.entry.id));
          break;
      }
      
      setEditDialog({ open: false, ledger: null, entry: null });
      toast({ title: "Entry Deleted", description: "Entry removed from database." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete entry.", variant: "destructive" });
    }
  };

  const exportLedgersToExcelCsv = () => {
    const sections: (string | number | boolean | null | undefined)[][] = [];
    const push = (title: string, header: string[], rows: (string | number | boolean | null | undefined)[][]) => {
      sections.push([title]);
      sections.push(header);
      rows.forEach((r) => sections.push(r));
      sections.push([]);
    };

    push(
      'SALES / INCOME',
      ['id', 'clientName', 'amount', 'date', 'status', 'description'],
      (sales || []).map((s) => [
        s.id,
        s.clientName,
        s.amount,
        s.date,
        s.status,
        s.description ?? '',
      ])
    );
    push(
      'PURCHASES',
      ['id', 'clientName', 'receiptId', 'priceBeforeVat', 'vat', 'amount', 'date', 'category', 'status'],
      (purchases || []).map((p) => [
        p.id,
        p.clientName || p.vendorName,
        p.receiptId || '',
        p.priceBeforeVat || 0,
        p.vat || 0,
        p.amount,
        p.date,
        p.category || '',
        p.status,
      ])
    );
    push(
      'OPERATING EXPENSES',
      ['id', 'category', 'amount', 'createdAt', 'reporterUserId', 'notes'],
      (expenses || []).map((e) => [
        e.id,
        e.category,
        e.amount,
        e.createdAt,
        e.reporterUserId ?? '',
        e.notes ?? '',
      ])
    );
    push(
      'INVOICES',
      ['id', 'clientName', 'amount', 'dueDate', 'status'],
      (invoices || []).map((i) => [i.id, i.clientName, i.amount, i.dueDate, i.status])
    );
    push(
      'FUEL REQUESTS',
      ['id', 'driverName', 'vehicleId', 'fuelStation', 'verificationId', 'amount', 'status', 'createdAt'],
      (fuelRequests || []).map((f) => [
        f.id,
        f.driverName ?? '',
        f.vehicleId ?? '',
        f.fuelStation ?? '',
        f.verificationId ?? '',
        f.amount,
        f.status,
        f.createdAt ?? '',
      ])
    );
    push(
      'ALLOWANCES',
      ['id', 'workerName', 'role', 'userId', 'amount', 'createdAt'],
      (allowances || []).map((a) => [
        a.id,
        a.workerName,
        a.role,
        a.userId ?? '',
        a.amount,
        a.createdAt ?? '',
      ])
    );
    push(
      'TAXES',
      ['id', 'type', 'period', 'status', 'amount'],
      (taxes || []).map((t) => [t.id, t.type, t.period, t.status, t.amount])
    );
    push(
      'FINANCIAL REPORTS',
      ['id', 'title', 'month', 'year', 'updatedAt', 'content'],
      (reports || []).map((r) => [
        r.id,
        r.title,
        r.month ?? '',
        r.year ?? '',
        r.updatedAt,
        (r.content ?? '').replace(/\\\\r?\\\\n/g, ' '),
      ])
    );

    const csv = rowsToCsv(sections);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`calvary-ledgers-${stamp}.csv`, csv);
  };

  // Render edit dialog fields
  const renderEditFields = () => {
    if (!editDialog.ledger || !editDialog.entry) return null;
    const fields = LEDGER_FIELDS[editDialog.ledger as keyof typeof LEDGER_FIELDS] || [];
    return (fields as any[]).map((field) => (
      <div className="space-y-2" key={field.key}>
        <Label>{field.label}</Label>
        {field.type === 'textarea' ? (
          <Textarea
            name={field.key}
            defaultValue={editDialog.entry[field.key] || ''}
            required={field.required}
          />
        ) : (
          <Input
            name={field.key}
            type={field.type}
            defaultValue={field.type === 'date' && editDialog.entry[field.key] ? new Date(editDialog.entry[field.key]).toISOString().slice(0, 10) : (editDialog.entry[field.key] || '')}
            required={field.required}
          />
        )}
      </div>
    ));
  };

  // Handle edit dialog form submit
  const handleEditFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updated: any = {};
    if (!editDialog.ledger) return;
    const fields = LEDGER_FIELDS[editDialog.ledger as keyof typeof LEDGER_FIELDS] || [];
    (fields as any[]).forEach((field) => {
      let value = formData.get(field.key);
      updated[field.key] = value;
    });
    // Post-process for correct types
    (fields as any[]).forEach((field) => {
      if (field.type === 'number' && updated[field.key] !== null && updated[field.key] !== undefined) {
        updated[field.key] = Number(updated[field.key]);
      }
      if (field.type === 'date' && updated[field.key]) {
        updated[field.key] = new Date(updated[field.key] as string).toISOString();
      }
    });
    handleSaveEdit(updated);
  };
  const { role, isAdmin } = useRole();
  const { format, currency, toggleCurrency } = useCurrency();
  const { user } = useSupabase();

  // State for the "Excel-like" report
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);

  // Use SupabaseService for data fetching
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [fuelRequests, setFuelRequests] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    // Check if admin user (owner) - should always have access
    const isAdminUser = isAdmin;
    
    if (!user && !isAdminUser) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load each data source individually with error handling
        const results = await Promise.allSettled([
          SupabaseService.getSales(),
          SupabaseService.getPurchases(),
          SupabaseService.getExpenses(),
          SupabaseService.getTaxes(),
          SupabaseService.getReports(),
          SupabaseService.getInvoices(),
          SupabaseService.getFuelRequests(),
          SupabaseService.getAllowances(),
        ]);
        
        // Process results
        const [salesRes, purchasesRes, expensesRes, taxesRes, reportsRes, invoicesRes, fuelRes, allowancesRes] = results;
        
        if (salesRes.status === 'fulfilled') setSales(salesRes.value);
        else console.error('Failed to load sales:', salesRes.reason);
        
        if (purchasesRes.status === 'fulfilled') setPurchases(purchasesRes.value);
        else console.error('Failed to load purchases:', purchasesRes.reason);
        
        if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value);
        else console.error('Failed to load expenses:', expensesRes.reason);
        
        if (taxesRes.status === 'fulfilled') setTaxes(taxesRes.value);
        else console.error('Failed to load taxes:', taxesRes.reason);
        
        if (reportsRes.status === 'fulfilled') setReports(reportsRes.value);
        else console.error('Failed to load reports:', reportsRes.reason);
        
        if (invoicesRes.status === 'fulfilled') setInvoices(invoicesRes.value);
        else console.error('Failed to load invoices:', invoicesRes.reason);
        
        if (fuelRes.status === 'fulfilled') setFuelRequests(fuelRes.value);
        else console.error('Failed to load fuel requests:', fuelRes.reason);
        
        if (allowancesRes.status === 'fulfilled') setAllowances(allowancesRes.value);
        else console.error('Failed to load allowances:', allowancesRes.reason);
        
      } catch (error) {
        console.error('Unexpected error loading finance data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  // Calculate totals from real data
  const totalSales = sales?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalPurchases = purchases?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalTax = taxes?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  // VAT from sales (18% calculated from total amount)
  const totalSalesVat = sales?.reduce((sum, item) => {
    const vat = item.vat || (item.amount * 0.18); // Use stored VAT or calculate
    return sum + vat;
  }, 0) || 0;
  // Total tax liability includes taxes table + sales VAT
  const totalTaxLiability = totalTax + totalSalesVat;
  const netProfit = totalSales - totalPurchases - totalExpenses - totalTaxLiability;

  // Connected to Supabase - add handlers
  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const totalAmount = Number(formData.get('amount'));
      const vat = totalAmount * 0.18;
      const priceBeforeVat = totalAmount - vat;
      
      const sale = await SupabaseService.createSale({
        clientName: formData.get('clientName') as string,
        amount: totalAmount,
        vat: vat,
        price_before_vat: priceBeforeVat,
        description: formData.get('description') as string,
        date: new Date().toISOString(),
        status: 'completed'
      });
      setSales(prev => [sale, ...prev]);
      toast({ title: "Sale Added", description: `Sale recorded with ${format(vat)} VAT.` });
      e.currentTarget.reset();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add sale.", variant: "destructive" });
    }
  };

  const handleAddPurchase = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    
    const clientName = formData.get('clientName') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const date = formData.get('date') as string;
    const category = formData.get('category') as string;
    const receiptId = formData.get('receiptId') as string;
    
    if (!clientName || !amount || !date || !receiptId) {
      toast({
        title: "Missing Fields",
        description: "Please fill in vendor name, receipt ID, amount, and date.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const vat = amount * 0.18;
      const priceBeforeVat = amount - vat;
      
      const purchase = await SupabaseService.createPurchase({
        client_name: clientName,
        receipt_id: receiptId,
        price_before_vat: priceBeforeVat,
        vat: vat,
        amount: amount,
        date: date,
        category: category || 'general',
        status: 'completed'
      });
      
      setPurchases(prev => [purchase, ...prev]);
      
      toast({
        title: "Purchase Added",
        description: `Vendor payment of ${format(amount)} added to database.`,
      });
      
      setAddPurchaseOpen(false);
      e.currentTarget.reset();
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add purchase. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Clear all test purchases from database
  const handleClearTestData = async () => {
    if (!confirm('Delete ALL test data from database? This cannot be undone.')) return;
    
    try {
      // Delete test purchases from Supabase
      const { error } = await supabase
        .from('purchases')
        .delete()
        .or('client_name.ilike.%test%,receipt_id.ilike.TEST-%,category.ilike.test');
      
      if (error) throw error;
      
      // Clear local state
      setPurchases([]);
      
      toast({
        title: "Test Data Cleared",
        description: "All test entries have been deleted from the database.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear test data.",
        variant: "destructive"
      });
    }
  };

  const handleApproveFuel = async (id: string) => {
    try {
      await SupabaseService.updateFuelRequest(id, { status: 'Approved' });
      setFuelRequests(prev => prev.map(f => f.id === id ? { ...f, status: 'Approved' } : f));
      toast({ title: "Fuel Approved", description: "Fuel request has been successfully approved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve fuel request.", variant: "destructive" });
    }
  };

  const handleSaveReport = async () => {
    // Check if admin user (owner) - should always have access
    const isAdminUser = isAdmin;
    
    if (!user && !isAdminUser) {
      console.error('Missing user');
      return;
    }
    
    if (!reportTitle) {
      console.error('Missing report title');
      return;
    }
    try {
      await SupabaseService.createReport({
        title: reportTitle,
        content: reportContent,
        authorId: user?.id || 'admin-straton',
        status: 'draft',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date().toISOString()
      } as any);
      toast({ title: "Report Saved", description: "Financial report has been saved successfully." });
    } catch (error) {
      console.error('Error saving report:', error);
      toast({ title: "Error", description: "Failed to save the report.", variant: "destructive" });
    }
    setReportTitle("");
    setReportContent("");
  };

  if (!isAdmin && !role) return <div className="p-8">Access Denied</div>;

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
                <DialogTitle className="sr-only">Add Financial Record</DialogTitle>
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
                        <Input name="clientName" placeholder="Client name" required />
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
                        <Input name="clientName" placeholder="E.g. Fuel Depot Ltd." required />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Amount (Including VAT)</Label>
                        <Input name="amount" type="number" step="0.01" placeholder="0.00" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input name="date" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input name="category" placeholder="Fuel, Maintenance, Office..." />
                      </div>
                      <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">Confirm Purchase</Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            {(role === 'ACCOUNTANT' || role === 'CEO' || role === 'ADMIN') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportLedgersToExcelCsv}
                className="gap-2 rounded-full border-primary text-primary"
              >
                <Download className="size-4" />
                Export to Excel (CSV)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleClearTestData} className="gap-2 rounded-full border-red-600 text-red-600">
              <Trash2 className="size-4" />
              Clear Test Data
            </Button>
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
          <FinancialMetricCard title="Tax Liability" value={totalTaxLiability} color="slate" icon={<Landmark className="size-4" />} />
          <FinancialMetricCard title="Net Profit" value={netProfit} color={netProfit >= 0 ? "emerald" : "destructive"} icon={<TrendingUp className="size-4" />} />
        </div>

        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="sales" className="rounded-lg gap-2"><ArrowUpRight className="size-4" /> Sales/Income</TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-lg gap-2"><ArrowDownLeft className="size-4" /> Purchases/Out</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg gap-2"><Receipt className="size-4" /> OpEx Receipts</TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg gap-2"><FileText className="size-4" /> Invoices</TabsTrigger>
            <TabsTrigger value="fuel" className="rounded-lg gap-2"><Truck className="size-4" /> Fuel Approvals</TabsTrigger>
            <TabsTrigger value="allowances" className="rounded-lg gap-2"><UsersIcon className="size-4" /> Allowances</TabsTrigger>
            <TabsTrigger value="taxes" className="rounded-lg gap-2"><Landmark className="size-4" /> Tax Ledger</TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg gap-2"><FileEdit className="size-4" /> Financial Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <LedgerTable
              headers={["Client Name", "Date", "Status", "Net Amount", "VAT (18%)", "Total", "Action"]}
              data={sales?.map(s => ({
                id: s.id,
                col1: s.clientName,
                col2: new Date(s.date).toLocaleDateString(),
                col3: <Badge className="bg-emerald-500">{s.status}</Badge>,
                col4: <span className="text-emerald-600">{format(s.price_before_vat || (s.amount * 0.82))}</span>,
                col5: <span className="text-amber-600 font-semibold">{format(s.vat || (s.amount * 0.18))}</span>,
                col6: <span className="text-emerald-600 font-bold">+{format(s.amount)}</span>,
                col7: <Button size="sm" variant="outline" onClick={() => handleOpenEdit('sales', s)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const totalAmount = Number(entry.amount);
                  const vat = totalAmount * 0.18;
                  const priceBeforeVat = totalAmount - vat;
                  const sale = await SupabaseService.createSale({
                    clientName: entry.clientName,
                    amount: totalAmount,
                    vat: vat,
                    price_before_vat: priceBeforeVat,
                    description: entry.description || '',
                    date: entry.date || new Date().toISOString(),
                    status: entry.status || 'completed'
                  });
                  setSales(prev => [sale, ...prev]);
                  toast({ title: "Sale Added", description: `Sale saved with ${format(vat)} VAT.` });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add sale.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="purchases">
            <LedgerTable
              headers={["Vendor", "Receipt ID", "Category", "Price Before VAT", "VAT", "Total Amount", "Date", "Status", "Action"]}
              data={purchases?.map(p => ({
                id: p.id,
                col1: (
                  <div>
                    <div className="font-medium">{p.client_name || p.clientName}</div>
                    <div className="text-xs text-muted-foreground">Purchase Entry</div>
                  </div>
                ),
                col2: (
                  <div>
                    <div className="font-mono text-xs">{p.receipt_id || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground">Transaction ID</div>
                  </div>
                ),
                col3: p.category || 'general',
                col4: (
                  <div>
                    <div className="font-semibold">{format(p.price_before_vat || 0)}</div>
                    <div className="text-xs text-muted-foreground">Net Amount</div>
                  </div>
                ),
                col5: (
                  <div>
                    <div className="text-amber-600 font-semibold">{format(p.vat || 0)}</div>
                    <div className="text-xs text-muted-foreground">VAT (18%)</div>
                  </div>
                ),
                col6: (
                  <div>
                    <div className="text-rose-600 font-bold">{format(p.amount || 0)}</div>
                    <div className="text-xs text-muted-foreground">Total Payment</div>
                  </div>
                ),
                col7: (
                  <div>
                    <div className="text-sm">{new Date(p.date).toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground">Purchase Date</div>
                  </div>
                ),
                col8: (
                  <div className="flex items-center gap-2">
                    <Badge className={p.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {p.status || 'Completed'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">Payment Status</div>
                  </div>
                ),
                col9: (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit('purchases', p)}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-blue-600">View Details</Button>
                  </div>
                )
              }))}
              onAddEntry={async (entry) => {
                const amount = Number(entry.amount);
                const vat = amount * 0.18;
                const priceBeforeVat = amount - vat;
                
                try {
                  const purchase = await SupabaseService.createPurchase({
                    client_name: entry.clientName,
                    receipt_id: entry.receiptId,
                    price_before_vat: priceBeforeVat,
                    vat: vat,
                    amount: amount,
                    date: entry.date,
                    category: entry.category || 'general',
                    status: 'completed'
                  });
                  
                  setPurchases(prev => [purchase, ...prev]);
                  
                  toast({
                    title: "Purchase Added",
                    description: `Vendor payment of ${format(amount)} saved to database.`,
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to save purchase to database.",
                    variant: "destructive"
                  });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="expenses">
            <LedgerTable
              headers={["Description", "Reference", "User", "Proof", "Amount", "Action"]}
              data={expenses?.map((e: any) => ({
                id: e.id,
                col1: e.category,
                col2: e.clientReference || '-',
                col3: e.userName || e.user_id || '-',
                col4: e.photoUrl ? (
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1"><ImageIcon className="size-3" /> View</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl"><DialogTitle className="sr-only">View Receipt</DialogTitle><img src={e.photoUrl} className="w-full rounded-lg" alt="Receipt" /></DialogContent>
                  </Dialog>
                ) : '-',
                col5: <span className="text-rose-500 font-bold">-{format(e.amount)}</span>,
                col6: <Button size="sm" variant="outline" onClick={() => handleOpenEdit('expenses', e)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const expense = await SupabaseService.createExpense({
                    category: entry.category,
                    userName: entry.userName,
                    amount: Number(entry.amount),
                    photoUrl: entry.photoUrl || null,
                    clientReference: entry.clientReference || null,
                    createdAt: entry.createdAt || new Date().toISOString(),
                    status: 'pending'
                  });
                  setExpenses(prev => [expense as never, ...prev]);
                  toast({ title: "Expense Added", description: "Expense saved to database." });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add expense.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="invoices">
            <LedgerTable
              headers={["Client", "Due Date", "Status", "Amount", "Action"]}
              data={invoices?.map(i => ({
                id: i.id,
                col1: i.clientName,
                col2: i.dueDate,
                col3: <Badge variant="outline">{i.status}</Badge>,
                col4: <span className="font-bold">{format(i.amount)}</span>,
                col5: <Button size="sm" variant="outline" onClick={() => handleOpenEdit('invoices', i)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const invoice = await SupabaseService.createInvoice({
                    clientName: entry.clientName,
                    amount: Number(entry.amount),
                    dueDate: entry.dueDate,
                    status: entry.status || 'pending'
                  });
                  setInvoices(prev => [invoice, ...prev]);
                  toast({ title: "Invoice Added", description: "Invoice saved to database." });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add invoice.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="fuel">
            <LedgerTable
              headers={["Driver/Vehicle", "Fuel Station", "Receipt ID", "Date", "Status", "Amount", "Action"]}
              data={fuelRequests?.map(f => ({
                id: f.id,
                col1: f.driverName || f.vehicleId,
                col2: f.fuelStation || 'N/A',
                col3: <span className="font-mono text-xs">{f.verificationId || 'N/A'}</span>,
                col4: f.createdAt ? new Date(f.createdAt).toLocaleDateString() : 'N/A',
                col5: <Badge variant={f.status === 'Approved' ? 'default' : 'secondary'} className={f.status === 'Approved' ? 'bg-emerald-500' : ''}>{f.status || 'Pending'}</Badge>,
                col6: <span className="font-bold">{format(f.amount || 0)}</span>,
                col7: f.status !== 'Approved' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveFuel(f.id)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit('fuel_requests', f)}>Edit</Button>
                  </div>
                ) : <Button size="sm" variant="outline" onClick={() => handleOpenEdit('fuel_requests', f)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const fuelReq = await SupabaseService.createFuelRequest({
                    driverName: entry.driverName || null,
                    vehicleId: entry.vehicleId || null,
                    fuelStation: entry.fuelStation,
                    verificationId: entry.verificationId || null,
                    amount: Number(entry.amount),
                    status: entry.status || 'pending',
                    createdAt: entry.createdAt || new Date().toISOString()
                  });
                  setFuelRequests(prev => [fuelReq, ...prev]);
                  toast({ title: "Fuel Request Added", description: "Fuel request saved to database." });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add fuel request.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="allowances">
            <LedgerTable
              headers={["Worker Name", "Role", "Date", "Amount", "Action"]}
              data={allowances?.map(a => ({
                id: a.id,
                col1: a.workerName,
                col2: a.role,
                col3: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'N/A',
                col4: <span className="text-primary font-bold">{format(a.amount || 0)}</span>,
                col5: <Button size="sm" variant="outline" onClick={() => handleOpenEdit('allowances', a)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const allowance = await SupabaseService.createAllowance({
                    workerName: entry.workerName,
                    role: entry.role,
                    userId: entry.userId || null,
                    amount: Number(entry.amount),
                    createdAt: entry.createdAt || new Date().toISOString()
                  });
                  setAllowances(prev => [allowance, ...prev]);
                  toast({ title: "Allowance Added", description: "Allowance saved to database." });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add allowance.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="taxes">
            <LedgerTable
              headers={["Tax Type", "Period", "Status", "Amount", "Action"]}
              data={taxes?.map(t => ({
                id: t.id,
                col1: t.type,
                col2: t.period,
                col3: <Badge variant="secondary">{t.status}</Badge>,
                col4: <span className="font-bold">{format(t.amount)}</span>,
                col5: <Button size="sm" variant="outline" onClick={() => handleOpenEdit('taxes', t)}>Edit</Button>
              }))}
              onAddEntry={async (entry) => {
                try {
                  const tax = await SupabaseService.createTax({
                    type: entry.type,
                    period: entry.period,
                    amount: Number(entry.amount),
                    status: entry.status || 'pending'
                  });
                  setTaxes(prev => [tax, ...prev]);
                  toast({ title: "Tax Added", description: "Tax record saved to database." });
                } catch (error) {
                  toast({ title: "Error", description: "Failed to add tax.", variant: "destructive" });
                }
              }}
            />
          </TabsContent>
      {/* Edit Dialog for all ledgers */}
      <Dialog open={editDialog.open} onOpenChange={open => !open && setEditDialog({ open: false, ledger: null, entry: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Ledger Entry</DialogTitle>
          </DialogHeader>
          {editDialog.entry && editDialog.ledger && (
            <form onSubmit={handleEditFormSubmit} className="space-y-4 pt-2">
              {renderEditFields()}
              <div className="flex flex-wrap gap-2 justify-end">
                {role === 'CEO' && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2 mr-auto"
                    onClick={() => {
                      if (confirm('Permanently delete this ledger row? This cannot be undone.')) handleDeleteEntry();
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setEditDialog({ open: false, ledger: null, entry: null })}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

          <TabsContent value="reports" className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b mb-4">
                <CardTitle className="text-lg font-headline">Generate Financial Summary</CardTitle>
                <Button onClick={handleSaveReport} className="gap-2 rounded-full"><Save className="size-4" /> Finalize Ledger</Button>
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
              <h3 className="font-headline text-lg flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" /> Historical Audit Reports</h3>
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
      <BottomTabs role={role!} />
      <RoleSelector />
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


function LedgerTable({ headers, data, onAddEntry }: { headers: string[], data: any[] | undefined, onAddEntry?: (entry: any) => void }) {
  // Add state for showing the add dialog from empty state
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Determine which ledger this table is for, based on headers
  let ledgerType: string | null = null;
  if (headers.includes("Client Name")) ledgerType = "sales";
  else if (headers.includes("Vendor") && headers.includes("Receipt ID")) ledgerType = "purchases";
  else if (headers.includes("Description") && headers.includes("User")) ledgerType = "expenses";
  else if (headers.includes("Tax Type")) ledgerType = "taxes";
  else if (headers.includes("Client") && headers.includes("Due Date")) ledgerType = "invoices";
  else if (headers.includes("Driver/Vehicle")) ledgerType = "fuel_requests";
  else if (headers.includes("Worker Name")) ledgerType = "allowances";

  // Render add dialog for empty state
  const renderAddDialog = () => {
    if (!ledgerType) return null;
    const fields = LEDGER_FIELDS[ledgerType as keyof typeof LEDGER_FIELDS] || [];
    return (
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Entry</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newEntry: any = {};
              (fields as any[]).forEach((field) => {
                let value = formData.get(field.key);
                newEntry[field.key] = value;
              });
              // Post-process for correct types
              (fields as any[]).forEach((field) => {
                if (field.type === 'number' && newEntry[field.key] !== null && newEntry[field.key] !== undefined) {
                  newEntry[field.key] = Number(newEntry[field.key]);
                }
                if (field.type === 'date' && newEntry[field.key]) {
                  newEntry[field.key] = new Date(newEntry[field.key] as string).toISOString();
                }
              });
              // Call onAddEntry if provided, otherwise just log
              if (onAddEntry) {
                onAddEntry(newEntry);
              } else {
                console.log('Add entry - no handler provided:', newEntry);
              }
              setShowAddDialog(false);
            }}
            className="space-y-4 pt-2"
          >
            {(fields as any[]).map((field) => (
              <div className="space-y-2" key={field.key}>
                <Label>{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea name={field.key} required={field.required} />
                ) : (
                  <Input name={field.key} type={field.type} required={field.required} />
                )}
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit">Add Entry</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i} className={cn((i === headers.length - 1 || i === headers.length - 2 && headers.includes("Action")) && "text-right", "px-6")}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-6 font-medium">{row.col1}</TableCell>
              <TableCell>{row.col2}</TableCell>
              {row.col3 && <TableCell>{row.col3}</TableCell>}
              {row.col4 && <TableCell>{row.col4}</TableCell>}
              {row.col5 && <TableCell className="text-right">{row.col5}</TableCell>}
              {row.col6 && <TableCell>{row.col6}</TableCell>}
              {row.col7 && <TableCell>{row.col7}</TableCell>}
              {row.col8 && <TableCell>{row.col8}</TableCell>}
              {row.col9 && <TableCell className="text-right px-6">{row.col9}</TableCell>}
            </TableRow>
          ))}
          {(!data || data.length === 0) && (
            <TableRow>
              <TableCell colSpan={headers.length} className="text-center py-12 text-muted-foreground italic">
                No entries in this ledger.
                {ledgerType && (
                  <div className="mt-4 flex justify-center">
                    <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                      Add New Entry
                    </Button>
                  </div>
                )}
                {renderAddDialog()}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}




