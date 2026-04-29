"use client";

import { useState, useEffect } from 'react';
import { QuoteGenerator } from './quote-generator';
import { TransportAgreementGenerator } from './transport-agreement-generator';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/navigation/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, FileText, Users, Plus, Search, Phone, Mail, MapPin,
  Calendar, DollarSign, TrendingUp, CheckCircle, Clock, AlertCircle,
  ArrowRight, Briefcase, FileSignature, PhoneCall, Printer
} from 'lucide-react';

interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tax_id: string;
  credit_limit: number;
  status: string;
  notes: string;
  total_quotations?: number;
  active_contracts?: number;
}

interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  company_name?: string;
  quotation_date: string;
  expiry_date: string;
  status: string;
  origin: string;
  destination: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
}

interface Contract {
  id: string;
  contract_number: string;
  customer_id: string;
  company_name?: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  contract_value: number;
  currency: string;
  status: string;
  origin: string;
  destination: string;
  trips_per_month: number;
  total_trips_completed: number;
}

interface FollowUp {
  id: string;
  customer_id: string;
  company_name?: string;
  follow_up_type: string;
  scheduled_date: string;
  status: string;
  subject: string;
  notes: string;
}

interface Opportunity {
  id: string;
  customer_id: string;
  company_name?: string;
  opportunity_name: string;
  stage: string;
  probability: number;
  estimated_value: number;
  expected_close_date: string;
}

export default function SalesModule() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [activeTab, setActiveTab] = useState('customers');

  // Permission checks - CEO, ADMIN, and SALESMAN can create quotations
  const canCreateQuotation = role === 'CEO' || role === 'ADMIN' || role === 'SALESMAN';
  const canCreateContract = role === 'CEO' || role === 'ADMIN' || role === 'SALESMAN';
  const canCreateCustomer = role === 'CEO' || role === 'ADMIN' || role === 'SALESMAN';

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddQuotation, setShowAddQuotation] = useState(false);
  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);
  const [showTransportAgreement, setShowTransportAgreement] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);

  // Form states
  const [customerForm, setCustomerForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    tax_id: '',
    credit_limit: '',
    payment_terms: '30 days',
    notes: ''
  });

  const [quotationForm, setQuotationForm] = useState({
    customer_id: '',
    origin: '',
    destination: '',
    cargo_type: '',
    cargo_weight_kg: '',
    subtotal: '',
    vat_rate: '18',
    validity_days: '30',
    notes: ''
  });

  const [contractForm, setContractForm] = useState({
    customer_id: '',
    quotation_id: '',
    contract_type: 'one_time',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    origin: '',
    destination: '',
    contract_value: '',
    trips_per_month: '',
    rate_per_km: '',
    payment_schedule: 'monthly',
    notes: ''
  });

  // Load all data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersRes, quotationsRes, contractsRes, followUpsRes, opportunitiesRes] = await Promise.all([
        supabase.from('customers').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('quotations').select('*, customers(company_name)').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('contracts').select('*, customers(company_name)').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('follow_ups').select('*, customers(company_name)').order('scheduled_date', { ascending: true }),
        supabase.from('sales_opportunities').select('*, customers(company_name)').is('deleted_at', null).order('created_at', { ascending: false })
      ]);

      setCustomers(customersRes.data || []);
      setQuotations(quotationsRes.data?.map(q => ({ ...q, company_name: q.customers?.company_name })) || []);
      setContracts(contractsRes.data?.map(c => ({ ...c, company_name: c.customers?.company_name })) || []);
      setFollowUps(followUpsRes.data?.map(f => ({ ...f, company_name: f.customers?.company_name })) || []);
      setOpportunities(opportunitiesRes.data?.map(o => ({ ...o, company_name: o.customers?.company_name })) || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Create customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('customers').insert({
        ...customerForm,
        credit_limit: parseFloat(customerForm.credit_limit) || 0,
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      toast({ title: 'Success', description: `Customer ${data.customer_code} created` });
      setShowAddCustomer(false);
      setCustomerForm({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        tax_id: '',
        credit_limit: '',
        payment_terms: '30 days',
        notes: ''
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Create quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtotal = parseFloat(quotationForm.subtotal) || 0;
      const vatRate = parseFloat(quotationForm.vat_rate) || 18;
      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const { data, error } = await supabase.from('quotations').insert({
        customer_id: quotationForm.customer_id,
        origin: quotationForm.origin,
        destination: quotationForm.destination,
        cargo_type: quotationForm.cargo_type,
        cargo_weight_kg: parseFloat(quotationForm.cargo_weight_kg) || 0,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        validity_days: parseInt(quotationForm.validity_days) || 30,
        notes: quotationForm.notes,
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      toast({ title: 'Success', description: `Quotation ${data.quotation_number} created` });
      setShowAddQuotation(false);
      setQuotationForm({
        customer_id: '',
        origin: '',
        destination: '',
        cargo_type: '',
        cargo_weight_kg: '',
        subtotal: '',
        vat_rate: '18',
        validity_days: '30',
        notes: ''
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Create contract
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('contracts').insert({
        customer_id: contractForm.customer_id,
        quotation_id: contractForm.quotation_id || null,
        contract_type: contractForm.contract_type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || null,
        origin: contractForm.origin,
        destination: contractForm.destination,
        contract_value: parseFloat(contractForm.contract_value) || 0,
        trips_per_month: parseInt(contractForm.trips_per_month) || 0,
        rate_per_km: parseFloat(contractForm.rate_per_km) || 0,
        payment_schedule: contractForm.payment_schedule,
        notes: contractForm.notes,
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      toast({ title: 'Success', description: `Contract ${data.contract_number} created` });
      setShowAddContract(false);
      setContractForm({
        customer_id: '',
        quotation_id: '',
        contract_type: 'one_time',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        origin: '',
        destination: '',
        contract_value: '',
        trips_per_month: '',
        rate_per_km: '',
        payment_schedule: 'monthly',
        notes: ''
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Convert quotation to contract
  const convertQuotationToContract = async (quotation: Quotation) => {
    try {
      // Create contract from quotation
      const { data: contract, error } = await supabase.from('contracts').insert({
        customer_id: quotation.customer_id,
        quotation_id: quotation.id,
        contract_type: 'one_time',
        start_date: new Date().toISOString().split('T')[0],
        origin: quotation.origin,
        destination: quotation.destination,
        contract_value: quotation.total_amount,
        currency: quotation.currency,
        status: 'draft',
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      // Update quotation status
      await supabase.from('quotations').update({
        status: 'converted',
        converted_to_contract_id: contract.id,
        converted_at: new Date().toISOString()
      }).eq('id', quotation.id);

      toast({ title: 'Success', description: `Quotation converted to contract ${contract.contract_number}` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Status badges
  const getCustomerStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      blacklisted: 'bg-red-100 text-red-700'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getQuotationStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      converted: 'bg-purple-100 text-purple-700',
      expired: 'bg-yellow-100 text-yellow-700'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getContractStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
      suspended: 'bg-orange-100 text-orange-700',
      expired: 'bg-red-100 text-red-700',
      terminated: 'bg-red-100 text-red-700'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  // Stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const pendingQuotations = quotations.filter(q => q.status === 'sent').length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalPipelineValue = opportunities.reduce((sum, o) => sum + (o.estimated_value || 0), 0);

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Sales Module</h1>
            <p className="text-muted-foreground">Customer management, quotations, contracts, and pipeline</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Customers</p>
                    <p className="text-2xl font-bold">{totalCustomers}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Quotations</p>
                    <p className="text-2xl font-bold">{pendingQuotations}</p>
                  </div>
                  <FileText className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Contracts</p>
                    <p className="text-2xl font-bold">{activeContracts}</p>
                  </div>
                  <FileSignature className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pipeline Value</p>
                    <p className="text-2xl font-bold">Tsh {totalPipelineValue.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="quotations">Quotations</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            </TabsList>

            {/* Customers Tab */}
            <TabsContent value="customers">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Customer Database</CardTitle>
                  {canCreateCustomer && (
                    <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
                      <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Add New Customer</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateCustomer} className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Company Name *</Label>
                              <Input
                                value={customerForm.company_name}
                                onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Contact Person</Label>
                              <Input
                                value={customerForm.contact_person}
                                onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input
                                type="email"
                                value={customerForm.email}
                                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Phone</Label>
                              <Input
                                value={customerForm.phone}
                                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Address</Label>
                            <Textarea
                              value={customerForm.address}
                              onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={customerForm.city}
                                onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tax ID (TIN)</Label>
                              <Input
                                value={customerForm.tax_id}
                                onChange={(e) => setCustomerForm({ ...customerForm, tax_id: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Credit Limit (Tsh)</Label>
                              <Input
                                type="number"
                                value={customerForm.credit_limit}
                                onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Payment Terms</Label>
                              <Select
                                value={customerForm.payment_terms}
                                onValueChange={(v) => setCustomerForm({ ...customerForm, payment_terms: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15 days">15 days</SelectItem>
                                  <SelectItem value="30 days">30 days</SelectItem>
                                  <SelectItem value="45 days">45 days</SelectItem>
                                  <SelectItem value="60 days">60 days</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              value={customerForm.notes}
                              onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                            <Button type="submit" className="flex-1">Create Customer</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Credit Limit</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.customer_code}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{customer.company_name}</p>
                              <p className="text-sm text-muted-foreground">{customer.city}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{customer.contact_person}</p>
                              <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getCustomerStatusBadge(customer.status)}</TableCell>
                          <TableCell>Tsh {customer.credit_limit?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quotations Tab */}
            <TabsContent value="quotations">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Quotations & RFQ</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowQuoteGenerator(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Quote
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowTransportAgreement(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Transport Agreement
                    </Button>
                    {canCreateQuotation && (
                      <Dialog open={showAddQuotation} onOpenChange={setShowAddQuotation}>
                        <DialogTrigger asChild>
                          <Button><Plus className="h-4 w-4 mr-2" /> New Quotation</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Create Quotation</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCreateQuotation} className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Customer *</Label>
                              <Select
                                value={quotationForm.customer_id}
                                onValueChange={(v) => setQuotationForm({ ...quotationForm, customer_id: v })}
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select customer..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers.filter(c => c.status === 'active').map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.company_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Origin</Label>
                                <Input
                                  value={quotationForm.origin}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, origin: e.target.value })}
                                  placeholder="e.g. Dar es Salaam"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Destination</Label>
                                <Input
                                  value={quotationForm.destination}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, destination: e.target.value })}
                                  placeholder="e.g. Mwanza"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Cargo Type</Label>
                                <Input
                                  value={quotationForm.cargo_type}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, cargo_type: e.target.value })}
                                  placeholder="e.g. Container"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Cargo Weight (kg)</Label>
                                <Input
                                  type="number"
                                  value={quotationForm.cargo_weight_kg}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, cargo_weight_kg: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Amount (excl. VAT) *</Label>
                                <Input
                                  type="number"
                                  value={quotationForm.subtotal}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, subtotal: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Valid for (days)</Label>
                                <Input
                                  type="number"
                                  value={quotationForm.validity_days}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, validity_days: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Notes</Label>
                              <Textarea
                                value={quotationForm.notes}
                                onChange={(e) => setQuotationForm({ ...quotationForm, notes: e.target.value })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddQuotation(false)}>Cancel</Button>
                              <Button type="submit" className="flex-1">Create Quotation</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium">{q.quotation_number}</TableCell>
                          <TableCell>{q.company_name}</TableCell>
                          <TableCell>
                            {q.origin && q.destination ? (
                              <span className="text-sm">{q.origin} → {q.destination}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {q.currency === 'USD' ? '$' : 'Tsh'} {q.total_amount?.toLocaleString()}
                          </TableCell>
                          <TableCell>{getQuotationStatusBadge(q.status)}</TableCell>
                          <TableCell>{q.expiry_date ? new Date(q.expiry_date).toLocaleDateString() : '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedQuotation(q);
                                  setShowQuoteGenerator(true);
                                }}
                              >
                                <FileText className="size-4 mr-1" />
                                View Quote
                              </Button>
                              {q.status === 'accepted' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  onClick={() => convertQuotationToContract(q)}
                                >
                                  Convert to Contract
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contracts Tab */}
            <TabsContent value="contracts">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Contracts</CardTitle>
                  {canCreateContract && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline"><Printer className="h-4 w-4 mr-2" /> Generate Agreement</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Generate Transportation Agreement</DialogTitle>
                          </DialogHeader>
                          <ContractGenerator onClose={() => { }} />
                        </DialogContent>
                      </Dialog>
                      <Dialog open={showAddContract} onOpenChange={setShowAddContract}>
                        <DialogTrigger asChild>
                          <Button><Plus className="h-4 w-4 mr-2" /> New Contract</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Create Contract</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCreateContract} className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Customer *</Label>
                              <Select
                                value={contractForm.customer_id}
                                onValueChange={(v) => setContractForm({ ...contractForm, customer_id: v })}
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select customer..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {customers.filter(c => c.status === 'active').map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      {customer.company_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Contract Type</Label>
                              <Select
                                value={contractForm.contract_type}
                                onValueChange={(v) => setContractForm({ ...contractForm, contract_type: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="one_time">One Time</SelectItem>
                                  <SelectItem value="recurring">Recurring</SelectItem>
                                  <SelectItem value="retainer">Retainer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Start Date *</Label>
                                <Input
                                  type="date"
                                  value={contractForm.start_date}
                                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                  type="date"
                                  value={contractForm.end_date}
                                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Origin</Label>
                                <Input
                                  value={contractForm.origin}
                                  onChange={(e) => setContractForm({ ...contractForm, origin: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Destination</Label>
                                <Input
                                  value={contractForm.destination}
                                  onChange={(e) => setContractForm({ ...contractForm, destination: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Contract Value *</Label>
                                <Input
                                  type="number"
                                  value={contractForm.contract_value}
                                  onChange={(e) => setContractForm({ ...contractForm, contract_value: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Trips per Month</Label>
                                <Input
                                  type="number"
                                  value={contractForm.trips_per_month}
                                  onChange={(e) => setContractForm({ ...contractForm, trips_per_month: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Payment Schedule</Label>
                              <Select
                                value={contractForm.payment_schedule}
                                onValueChange={(v) => setContractForm({ ...contractForm, payment_schedule: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="upfront">Upfront</SelectItem>
                                  <SelectItem value="per_delivery">Per Delivery</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Notes</Label>
                              <Textarea
                                value={contractForm.notes}
                                onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddContract(false)}>Cancel</Button>
                              <Button type="submit" className="flex-1">Create Contract</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Trips</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.contract_number}</TableCell>
                          <TableCell>{contract.company_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{contract.contract_type}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            Tsh {contract.contract_value?.toLocaleString()}
                          </TableCell>
                          <TableCell>{getContractStatusBadge(contract.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(contract.start_date).toLocaleDateString()} -
                              {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Ongoing'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {contract.total_trips_completed || 0} / {contract.trips_per_month || '-'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pipeline Tab */}
            <TabsContent value="pipeline">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    {['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won'].map((stage) => (
                      <div key={stage} className="bg-muted rounded-lg p-4">
                        <h3 className="font-semibold mb-3 capitalize">{stage.replace('_', ' ')}</h3>
                        <div className="space-y-2">
                          {opportunities
                            .filter(o => o.stage === stage)
                            .map((opp) => (
                              <Card key={opp.id} className="p-3">
                                <p className="font-medium text-sm">{opp.opportunity_name}</p>
                                <p className="text-xs text-muted-foreground">{opp.company_name}</p>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs font-semibold">
                                    Tsh {opp.estimated_value?.toLocaleString()}
                                  </span>
                                  <span className="text-xs">{opp.probability}%</span>
                                </div>
                              </Card>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Follow-ups Tab */}
            <TabsContent value="followups">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Follow-ups & CRM</CardTitle>
                  <Button><Plus className="h-4 w-4 mr-2" /> Schedule Follow-up</Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followUps.map((followUp) => (
                        <TableRow key={followUp.id}>
                          <TableCell>
                            {new Date(followUp.scheduled_date).toLocaleString()}
                          </TableCell>
                          <TableCell>{followUp.company_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{followUp.follow_up_type}</Badge>
                          </TableCell>
                          <TableCell>{followUp.subject}</TableCell>
                          <TableCell>
                            <Badge className={
                              followUp.status === 'completed' ? 'bg-green-100 text-green-700' :
                                followUp.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                                  followUp.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                            }>
                              {followUp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">Complete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quote Generator Dialog */}
          <Dialog open={showQuoteGenerator} onOpenChange={setShowQuoteGenerator}>
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedQuotation ? `Quote ${selectedQuotation.quotation_number}` : 'Transport Price Quote'}
                </DialogTitle>
              </DialogHeader>
              <QuoteGenerator
                initialData={selectedQuotation ? {
                  quoteNumber: selectedQuotation.quotation_number,
                  issueDate: selectedQuotation.quotation_date,
                  validThrough: selectedQuotation.expiry_date,
                  receiverName: selectedQuotation.company_name,
                  receiverAddress1: selectedQuotation.origin,
                  receiverAddress2: selectedQuotation.destination,
                  lineItems: [
                    {
                      id: '1',
                      description: `Transport Services: ${selectedQuotation.origin} to ${selectedQuotation.destination}`,
                      quantity: 1,
                      unitPrice: selectedQuotation.subtotal,
                      discount: 0
                    }
                  ],
                  taxRate: 10
                } : undefined}
                onClose={() => {
                  setShowQuoteGenerator(false);
                  setSelectedQuotation(null);
                }}
              />
            </DialogContent>
          </Dialog>

          {/* Transport Agreement Dialog */}
          <Dialog open={showTransportAgreement} onOpenChange={setShowTransportAgreement}>
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Transportation Agreement</DialogTitle>
              </DialogHeader>
              <TransportAgreementGenerator
                initialData={{
                  clientCompany: selectedCustomer?.company_name || '',
                  clientAddress: selectedCustomer?.address || '',
                  clientEmail: selectedCustomer?.email || '',
                  clientTel: selectedCustomer?.phone || ''
                }}
                onClose={() => setShowTransportAgreement(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
