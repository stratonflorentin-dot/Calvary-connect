"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileText,
  Target,
  Plus,
  Search,
  Download,
  Calendar,
  CreditCard,
  Globe,
  Anchor,
  Thermometer,
  Truck,
  MapPin,
  Fuel,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { format } from 'date-fns';

interface CalvaryExpense {
  id: string;
  category: string;
  vehicle_id: string;
  driver_id: string;
  amount: number;
  description: string;
  vendor: string;
  payment_method: string;
  expense_date: string;
  status: string;
  created_at: string;
  trip_id?: string;
  is_cross_border?: boolean;
  is_reefer?: boolean;
  is_lowbed?: boolean;
  border_point?: string;
  vehicles?: { plate_number: string; make: string; model: string };
  user_profiles?: { name: string };
}

interface CalvaryRevenue {
  id: string;
  trip_id: string;
  vehicle_id: string;
  amount: number;
  description: string;
  invoice_number: string;
  payment_status: string;
  revenue_date: string;
  created_at: string;
  is_cross_border: boolean;
  cargo_type: string;
  client: string;
  vehicles?: { plate_number: string; make: string; model: string };
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  created_at: string;
  is_cross_border?: boolean;
  cargo_type?: string;
}

interface TaxRecord {
  id: string;
  tax_name: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid';
  type: 'VAT' | 'PAYE' | 'Income' | 'Road' | 'Import' | 'Excise';
}

export function CalvaryFinancialManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [expenses, setExpenses] = useState<CalvaryExpense[]>([]);
  const [revenue, setRevenue] = useState<CalvaryRevenue[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [taxes, setTaxes] = useState<TaxRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { format: formatCurrency } = useCurrency();

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    vehicle_id: '',
    amount: '',
    description: '',
    vendor: '',
    payment_method: 'cash',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    trip_id: '',
    is_cross_border: false,
    border_point: ''
  });

  const [revenueForm, setRevenueForm] = useState({
    trip_id: '',
    vehicle_id: '',
    amount: '',
    description: '',
    invoice_number: '',
    payment_status: 'pending',
    payment_method: 'bank_transfer',
    revenue_date: format(new Date(), 'yyyy-MM-dd'),
    client: '',
    is_cross_border: false,
    cargo_type: 'GENERAL'
  });

  const [invoiceForm, setInvoiceForm] = useState({
    customer_name: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    invoice_number: `CAL-${Date.now()}`,
    is_cross_border: false,
    cargo_type: 'GENERAL'
  });

  const [taxForm, setTaxForm] = useState({
    tax_name: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    type: 'VAT' as TaxRecord['type']
  });

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setLoading(true);

      const [
        { data: expensesData },
        { data: revenueData },
        { data: invoicesData },
        { data: taxesData },
        { data: vehiclesData },
        { data: tripsData }
      ] = await Promise.all([
        supabase.from('expenses').select('*, vehicles(plate_number, make, model), user_profiles(name)').order('created_at', { ascending: false }),
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('taxes').select('*').order('due_date', { ascending: true }),
        supabase.from('vehicles').select('id, plate_number, make, model').eq('status', 'active').order('plate_number'),
        supabase.from('trips').select('*').order('created_at', { ascending: false })
      ]);

      // Process trips as revenue
      const processedRevenue: CalvaryRevenue[] = (tripsData || []).map(trip => ({
        id: trip.id,
        trip_id: trip.id,
        vehicle_id: trip.vehicle_id,
        amount: Number(trip.revenue) || Number(trip.price) || 0,
        description: `${trip.origin} → ${trip.destination}`,
        invoice_number: `TRIP-${trip.id?.slice(0, 8) || 'N/A'}`,
        payment_status: trip.status === 'completed' ? 'paid' : 'pending',
        revenue_date: trip.created_at,
        created_at: trip.created_at,
        is_cross_border: trip.is_cross_border || false,
        cargo_type: trip.cargo_type || 'GENERAL',
        client: trip.client || 'Direct Client'
      })).filter(r => r.amount > 0);

      setExpenses(expensesData || []);
      setRevenue(processedRevenue);
      setInvoices(invoicesData || []);
      setTaxes(taxesData || []);
      setVehicles(vehiclesData || []);
      setTrips(tripsData || []);
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error",
        description: "Failed to load financial data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('expenses').insert({
        category: expenseForm.category,
        vehicle_id: expenseForm.vehicle_id || null,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        vendor: expenseForm.vendor,
        payment_method: expenseForm.payment_method,
        expense_date: expenseForm.expense_date,
        notes: expenseForm.notes,
        trip_id: expenseForm.trip_id || null,
        is_cross_border: expenseForm.is_cross_border,
        border_point: expenseForm.border_point,
        status: 'pending',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({ title: "Success", description: "Expense recorded successfully" });

      setExpenseForm({
        category: '', vehicle_id: '', amount: '', description: '',
        vendor: '', payment_method: 'cash',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '', trip_id: '', is_cross_border: false, border_point: ''
      });

      loadFinancialData();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    }
  };

  const handleAddRevenue = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('trips').update({
        revenue: parseFloat(revenueForm.amount),
        price: parseFloat(revenueForm.amount),
        status: 'completed'
      }).eq('id', revenueForm.trip_id);

      if (error) throw error;

      toast({ title: "Success", description: "Trip revenue recorded" });

      setRevenueForm({
        trip_id: '', vehicle_id: '', amount: '', description: '',
        invoice_number: '', payment_status: 'pending',
        payment_method: 'bank_transfer',
        revenue_date: format(new Date(), 'yyyy-MM-dd'),
        client: '', is_cross_border: false, cargo_type: 'GENERAL'
      });

      loadFinancialData();
    } catch (error) {
      console.error('Error adding revenue:', error);
      toast({ title: "Error", description: "Failed to record revenue", variant: "destructive" });
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('invoices').insert({
        ...invoiceForm,
        amount: parseFloat(invoiceForm.amount),
        status: 'pending',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      toast({ title: "Invoice Created", description: `Invoice ${invoiceForm.invoice_number} saved.` });
      setInvoiceForm({
        customer_name: '', amount: '', due_date: format(new Date(), 'yyyy-MM-dd'),
        invoice_number: `CAL-${Date.now()}`, is_cross_border: false, cargo_type: 'GENERAL'
      });
      loadFinancialData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddTax = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('taxes').insert({
        ...taxForm,
        amount: parseFloat(taxForm.amount),
        status: 'pending',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      toast({ title: "Tax Recorded", description: "Tax obligation added." });
      setTaxForm({ tax_name: '', amount: '', due_date: format(new Date(), 'yyyy-MM-dd'), type: 'VAT' });
      loadFinancialData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getCargoTypeBadge = (type: string) => {
    switch (type) {
      case 'REEFER':
      case 'cold_chain':
        return <Badge className="bg-cyan-500/20 text-cyan-700"><Thermometer className="size-3 mr-1" /> Cold Chain</Badge>;
      case 'LOWBED':
      case 'heavy_equipment':
        return <Badge className="bg-amber-500/20 text-amber-700"><Anchor className="size-3 mr-1" /> Heavy Cargo</Badge>;
      case 'CROSS_BORDER':
        return <Badge className="bg-purple-500/20 text-purple-700"><Globe className="size-3 mr-1" /> Cross-Border</Badge>;
      default:
        return <Badge variant="outline">General</Badge>;
    }
  };

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalRevenue = revenue.reduce((sum, rev) => sum + rev.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Logistics-specific breakdowns
  const crossBorderExpenses = expenses.filter(e => e.is_cross_border).reduce((sum, e) => sum + e.amount, 0);
  const crossBorderRevenue = revenue.filter(r => r.is_cross_border).reduce((sum, r) => sum + r.amount, 0);
  const coldChainExpenses = expenses.filter(e => e.is_reefer).reduce((sum, e) => sum + e.amount, 0);
  const coldChainRevenue = revenue.filter(r => r.cargo_type === 'REEFER' || r.cargo_type === 'cold_chain').reduce((sum, r) => sum + r.amount, 0);

  const filteredExpenses = expenses.filter(e =>
    (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.vendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRevenue = revenue.filter(r =>
    (r.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.client || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground flex items-center justify-center gap-2">
          <Truck className="size-5 animate-pulse" /> Loading Calvary Financial Data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calvary Brand Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="size-8 text-amber-500" />
            Calvary Financial Operations
          </h1>
          <p className="text-muted-foreground">East Africa Logistics - Revenue & Expense Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="size-4" /> Export Report
          </Button>
        </div>
      </div>

      {/* Overview Cards - Logistics Specific */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-white/60 mt-1">{revenue.length} trips recorded</p>
              </div>
              <TrendingUp className="h-10 w-10 text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-white/60 mt-1">{expenses.length} entries</p>
              </div>
              <TrendingDown className="h-10 w-10 text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Net Profit</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Cross-Border</p>
                <p className="text-2xl font-bold">{formatCurrency(crossBorderRevenue)}</p>
                <p className="text-xs text-white/60 mt-1">Revenue from DRC/Zambia/Kenya routes</p>
              </div>
              <Globe className="h-10 w-10 text-white/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Service Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-green-600" />
                  Revenue by Service Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Globe className="size-5 text-purple-600" />
                      <span className="font-medium">Cross-Border Transit</span>
                    </div>
                    <span className="font-bold text-purple-600">{formatCurrency(crossBorderRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MapPin className="size-5 text-blue-600" />
                      <span className="font-medium">Local Tanzania</span>
                    </div>
                    <span className="font-bold text-blue-600">{formatCurrency(totalRevenue - crossBorderRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Thermometer className="size-5 text-cyan-600" />
                      <span className="font-medium">Cold Chain</span>
                    </div>
                    <span className="font-bold text-cyan-600">{formatCurrency(coldChainRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="size-5 text-red-600" />
                  Expense Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['fuel', 'border', 'maintenance', 'allowance'].map(cat => {
                    const catExpenses = expenses.filter(e => (e.category || '').toLowerCase().includes(cat));
                    const catTotal = catExpenses.reduce((sum, e) => sum + e.amount, 0);
                    const percentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;

                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{cat === 'border' ? 'Border Fees' : cat}</span>
                          <span className="font-medium">{formatCurrency(catTotal)} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="text-2xl font-bold">Expense Management</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="size-4" /> Add Expense</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Receipt className="size-5" /> Record New Expense
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({...expenseForm, category: v})}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fuel">Fuel</SelectItem>
                            <SelectItem value="border">Border Fees</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="customs">Customs/Duties</SelectItem>
                            <SelectItem value="toll">Toll Charges</SelectItem>
                            <SelectItem value="parking">Parking</SelectItem>
                            <SelectItem value="food">Meals/Accommodation</SelectItem>
                            <SelectItem value="allowance">Driver Allowance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Vehicle (Optional)</Label>
                        <Select value={expenseForm.vehicle_id} onValueChange={(v) => setExpenseForm({...expenseForm, vehicle_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                          <SelectContent>
                            {vehicles.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.plate_number} - {v.make}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (TZS)</Label>
                        <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Vendor/Source</Label>
                        <Input value={expenseForm.vendor} onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})} placeholder="e.g., Oryx Fuel Station" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm({...expenseForm, payment_method: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money (M-Pesa)</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="fuel_card">Fuel Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({...expenseForm, expense_date: e.target.value})} required />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={expenseForm.is_cross_border} onChange={(e) => setExpenseForm({...expenseForm, is_cross_border: e.target.checked})} className="rounded" />
                        Cross-Border Expense
                      </label>
                    </div>

                    {expenseForm.is_cross_border && (
                      <div className="space-y-2">
                        <Label>Border Point</Label>
                        <Select value={expenseForm.border_point} onValueChange={(v) => setExpenseForm({...expenseForm, border_point: v})}>
                          <SelectTrigger><SelectValue placeholder="Select border" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kasumbalesa">Kasumbalesa (DRC)</SelectItem>
                            <SelectItem value="Tunduma">Tunduma (Zambia)</SelectItem>
                            <SelectItem value="Sirari">Sirari (Kenya)</SelectItem>
                            <SelectItem value="Rusumo">Rusumo (Rwanda)</SelectItem>
                            <SelectItem value="Mutukula">Mutukula (Uganda)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="Expense details..." rows={2} />
                    </div>

                    <Button type="submit" className="w-full">Record Expense</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Cross-Border</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{expense.category || 'Other'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell>{expense.vehicles?.plate_number || 'N/A'}</TableCell>
                      <TableCell>
                        {expense.is_cross_border ? (
                          <Badge className="bg-purple-500/20 text-purple-700 gap-1">
                            <Globe className="size-3" /> {expense.border_point || 'Yes'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Local</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-red-600">-{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={expense.status === 'approved' ? 'default' : 'secondary'}>
                          {expense.status || 'pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No expenses found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="text-2xl font-bold">Trip Revenue Management</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-green-600 hover:bg-green-700"><Plus className="size-4" /> Record Trip Revenue</Button>
 </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record Trip Revenue</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddRevenue} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Completed Trip</Label>
                    <Select value={revenueForm.trip_id} onValueChange={(v) => setRevenueForm({...revenueForm, trip_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger>
                      <SelectContent>
                        {trips.filter(t => t.status !== 'completed').map(trip => (
                          <SelectItem key={trip.id} value={trip.id}>
                            {trip.origin} → {trip.destination}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Revenue Amount (TZS)</Label>
                    <Input type="number" value={revenueForm.amount} onChange={(e) => setRevenueForm({...revenueForm, amount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input value={revenueForm.client} onChange={(e) => setRevenueForm({...revenueForm, client: e.target.value})} placeholder="Client name" />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={revenueForm.is_cross_border} onChange={(e) => setRevenueForm({...revenueForm, is_cross_border: e.target.checked})} className="rounded" />
                      Cross-Border Trip
                    </label>
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Record Revenue</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRevenue.map((rev) => (
                    <TableRow key={rev.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(rev.revenue_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{rev.description}</TableCell>
                      <TableCell>{getCargoTypeBadge(rev.cargo_type)}</TableCell>
                      <TableCell>{rev.client}</TableCell>
                      <TableCell className="font-medium text-green-600">{formatCurrency(rev.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={rev.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {rev.payment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRevenue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No revenue records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Client Invoices</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="size-4" /> Create Invoice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Client Invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddInvoice} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input value={invoiceForm.invoice_number} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer/Client Name</Label>
                    <Input value={invoiceForm.customer_name} onChange={e => setInvoiceForm({...invoiceForm, customer_name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (TZS)</Label>
                    <Input type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})} required />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={invoiceForm.is_cross_border} onChange={(e) => setInvoiceForm({...invoiceForm, is_cross_border: e.target.checked})} className="rounded" />
                      Cross-Border Service
                    </label>
                  </div>
                  <Button type="submit" className="w-full">Create Invoice</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{inv.is_cross_border ? <Badge className="bg-purple-500/20 text-purple-700"><Globe className="size-3 mr-1" /> Cross-Border</Badge> : <Badge variant="outline">Local</Badge>}</TableCell>
                    <TableCell className="font-medium text-green-600">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell>{format(new Date(inv.due_date), 'PP')}</TableCell>
                    <TableCell>
                      <Badge
                        variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'}
                        className="gap-1"
                      >
                        {inv.status === 'paid' && <CheckCircle2 className="size-3" />}
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No invoices yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Taxes Tab */}
        <TabsContent value="taxes" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Tax Obligations</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="size-4" /> Record Tax</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Tax Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTax} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tax Name</Label>
                    <Input value={taxForm.tax_name} onChange={e => setTaxForm({...taxForm, tax_name: e.target.value})} placeholder="e.g., Q2 VAT Payment" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={taxForm.type} onValueChange={v => setTaxForm({...taxForm, type: v as TaxRecord['type']})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VAT">VAT</SelectItem>
                        <SelectItem value="PAYE">PAYE</SelectItem>
                        <SelectItem value="Income">Income Tax</SelectItem>
                        <SelectItem value="Road">Road Tax</SelectItem>
                        <SelectItem value="Import">Import Duty</SelectItem>
                        <SelectItem value="Excise">Excise Duty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (TZS)</Label>
                    <Input type="number" value={taxForm.amount} onChange={e => setTaxForm({...taxForm, amount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={taxForm.due_date} onChange={e => setTaxForm({...taxForm, due_date: e.target.value})} required />
                  </div>
                  <Button type="submit" className="w-full">Record Tax</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxes.map(tax => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">{tax.tax_name}</TableCell>
                    <TableCell><Badge variant="outline">{tax.type}</Badge></TableCell>
                    <TableCell className="font-medium">{formatCurrency(tax.amount)}</TableCell>
                    <TableCell className={new Date(tax.due_date) < new Date() && tax.status === 'pending' ? 'text-red-600' : ''}>
                      {format(new Date(tax.due_date), 'PP')}
                      {new Date(tax.due_date) < new Date() && tax.status === 'pending' && (
                        <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tax.status === 'paid' ? 'default' : 'secondary'}>
                        {tax.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {taxes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No tax records yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Logistics Costs Tab */}
        <TabsContent value="logistics" className="space-y-6">
          <h2 className="text-2xl font-bold">Logistics-Specific Costs</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-5 text-purple-600" />
                  Cross-Border Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="font-bold text-purple-600">{formatCurrency(crossBorderExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-bold text-green-600">{formatCurrency(crossBorderRevenue)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Net from Cross-Border</span>
                      <span className={`font-bold ${crossBorderRevenue - crossBorderExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(crossBorderRevenue - crossBorderExpenses)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-cyan-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="size-5 text-cyan-600" />
                  Cold Chain Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-bold text-cyan-600">{formatCurrency(coldChainExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-bold text-green-600">{formatCurrency(coldChainRevenue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="size-5 text-amber-600" />
                  Fuel Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['fuel', 'diesel'].map(cat => {
                    const catTotal = expenses.filter(e => (e.category || '').toLowerCase().includes(cat)).reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div key={cat} className="flex justify-between items-center">
                        <span className="text-muted-foreground capitalize">{cat}</span>
                        <span className="font-bold text-amber-600">{formatCurrency(catTotal)}</span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Fuel</span>
                      <span className="font-bold">
                        {formatCurrency(expenses.filter(e => (e.category || '').toLowerCase().includes('fuel')).reduce((sum, e) => sum + e.amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Border Route Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Border Route Cost Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {['Kasumbalesa', 'Tunduma', 'Sirari', 'Rusumo', 'Mutukula', 'Kabanga'].map(route => {
                  const routeExpenses = expenses.filter(e => (e.description || '').toLowerCase().includes(route.toLowerCase()));
                  const routeTotal = routeExpenses.reduce((sum, e) => sum + e.amount, 0);

                  return (
                    <div key={route} className="p-4 border rounded-xl text-center">
                      <p className="font-medium text-sm mb-2">{route}</p>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(routeTotal)}</p>
                      <p className="text-xs text-muted-foreground">{routeExpenses.length} entries</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}