"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/navigation/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Building2, FileText, Users, Plus, Search, Phone, Mail, MapPin,
  DollarSign, TrendingUp, CheckCircle, Clock, AlertCircle, ArrowRight,
  Briefcase, FileSignature, Printer, Download, Route, Truck, Container,
  Thermometer, Weight, Ruler, CalendarDays, X, Eye, Save, Pencil, Trash2
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ContractGenerator } from './contract-generator';
import { TransportAgreementGenerator } from './transport-agreement-generator';

// ─── Types ──────────────────────────────────────────────────────────

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
}

interface RouteQuotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  company_name?: string;
  service_type: string;
  origin: string;
  destination: string;
  distance_km: number;
  cargo_type: string;
  cargo_weight_mt: number;
  container_size?: string;
  rate_per_km: number;
  base_amount: number;
  fuel_surcharge_pct: number;
  fuel_surcharge_amount: number;
  border_fees: number;
  escort_fees: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  validity_days: number;
  expiry_date: string;
  status: string;
  notes: string;
  created_at: string;
}

interface TransportContract {
  id: string;
  contract_number: string;
  customer_id: string;
  company_name?: string;
  contract_type: string;
  service_types?: string[];
  routes?: Array<{ origin: string; destination: string; rate: number }>;
  start_date: string;
  end_date?: string;
  min_monthly_trips?: number;
  contract_value: number;
  currency: string;
  payment_terms?: string;
  status: string;
  signed_by_client?: boolean;
  signed_by_calvary?: boolean;
  template_id?: string;
  rate_sheet_id?: string;
  generated_html?: string;
  client_signatory_name?: string;
  client_signatory_title?: string;
  contract_date?: string;
  created_at: string;
}

interface RateSheetEntry {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  service_type: string;
  distance_km: number;
  container_20ft: number;
  container_40ft: number;
  loose_rate_mt: number;
  lowbed_rate: number;
  reefer_surcharge: number;
  border_clearance_fee: number;
  transit_days: number;
}

interface SalesOpportunity {
  id: string;
  customer_id: string;
  company_name?: string;
  opportunity_name: string;
  service_type: string;
  estimated_monthly_revenue: number;
  probability: number;
  stage: string;
  expected_close_date: string;
  competitor?: string;
  notes: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: 'local_transport', label: 'Local Transport (TZ)', icon: Truck },
  { value: 'cross_border', label: 'Cross-Border Transit', icon: Route },
  { value: 'lowbed', label: 'Lowbed / Heavy Haulage', icon: Weight },
  { value: 'reefer', label: 'Reefer / Cold Chain', icon: Thermometer },
  { value: 'loose_cargo', label: 'Loose Cargo / Bulk', icon: Container },
];

const CROSS_BORDER_ROUTES = [
  { origin: 'Dar es Salaam', destination: 'Lusaka (Zambia)', distance: 1850, border: 'Tunduma/Nakonde' },
  { origin: 'Dar es Salaam', destination: 'Lubumbashi (DRC)', distance: 1650, border: 'Kasumulu' },
  { origin: 'Dar es Salaam', destination: 'Bujumbura (Burundi)', distance: 1100, border: 'Mutukula/Kobero' },
  { origin: 'Dar es Salaam', destination: 'Kigali (Rwanda)', distance: 1150, border: 'Rusumo' },
  { origin: 'Dar es Salaam', destination: 'Kampala (Uganda)', distance: 1450, border: 'Mutukula' },
  { origin: 'Dar es Salaam', destination: 'Nairobi (Kenya)', distance: 850, border: 'Namanga' },
  { origin: 'Dar es Salaam', destination: 'Juba (South Sudan)', distance: 2100, border: 'Nimule' },
];

const LOCAL_ROUTES = [
  { origin: 'Dar es Salaam', destination: 'Mwanza', distance: 1150 },
  { origin: 'Dar es Salaam', destination: 'Arusha', distance: 630 },
  { origin: 'Dar es Salaam', destination: 'Dodoma', distance: 450 },
  { origin: 'Dar es Salaam', destination: 'Mbeya', distance: 830 },
  { origin: 'Dar es Salaam', destination: 'Tanga', distance: 350 },
  { origin: 'Dar es Salaam', destination: 'Morogoro', distance: 190 },
  { origin: 'Dar es Salaam', destination: 'Kigoma', distance: 1050 },
];

// ─── Main Component ────────────────────────────────────────────────

function SalesModuleContent() {
  const { role } = useRole();
  const { user } = useSupabase();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState(tabParam || 'customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<RouteQuotation[]>([]);
  const [contracts, setContracts] = useState<TransportContract[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheetEntry[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showQuotationDialog, setShowQuotationDialog] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showOpportunityDialog, setShowOpportunityDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [previewContract, setPreviewContract] = useState<TransportContract | null>(null);

  // Rate sheets from JSONB format (contract_templates system)
  const [jsonbRateSheets, setJsonbRateSheets] = useState<Array<{ id: string; rate_sheet_name: string; effective_date: string; currency: string; rates: any[]; special_conditions: string; is_active: boolean }>>([]);
  const [showRateSheetDialog, setShowRateSheetDialog] = useState(false);
  const [viewingRateSheet, setViewingRateSheet] = useState<any>(null);
  const [editingRateSheet, setEditingRateSheet] = useState<any>(null);
  const [newRateSheet, setNewRateSheet] = useState({
    route_name: '',
    service_type: 'local_transport',
    origin: '',
    destination: '',
    distance_km: 0,
    currency: 'TZS',
    container_20ft: 0,
    container_40ft: 0,
    loose_rate_mt: 0,
    transit_days: 0,
    special_conditions: '',
    is_active: true,
  });

  // Form states
  const [customerForm, setCustomerForm] = useState({
    company_name: '', contact_person: '', email: '', phone: '',
    address: '', city: 'Dar es Salaam', tax_id: '', credit_limit: '',
    payment_terms: '30 days', status: 'prospect', notes: ''
  });

  const [quotationForm, setQuotationForm] = useState({
    customer_id: '', service_type: 'local_transport', origin: '', destination: '',
    distance_km: 0, cargo_type: '', cargo_weight_mt: '', container_size: '20ft',
    rate_per_km: 0, fuel_surcharge_pct: 15, border_fees: 0, escort_fees: 0,
    vat_rate: 18, validity_days: 30, notes: ''
  });

  const [contractForm, setContractForm] = useState({
    customer_id: '', quotation_id: '', contract_type: 'long_term',
    start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '',
    min_monthly_trips: 10, contract_value: '', payment_terms: '30 days',
    notes: ''
  });

  const [opportunityForm, setOpportunityForm] = useState({
    customer_id: '', opportunity_name: '', service_type: 'local_transport',
    estimated_monthly_revenue: '', probability: 50, stage: 'lead',
    expected_close_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    competitor: '', notes: ''
  });

  // Permissions
  const canCreate = role === 'CEO' || role === 'ADMIN' || role === 'SALESMAN';
  console.log('User role:', role, 'Can create:', canCreate);

  // Fetch data
  useEffect(() => {
    fetchCustomers();
    fetchQuotations();
    fetchContracts();
    fetchRateSheets();
    fetchJsonbRateSheets();
    fetchOpportunities();
  }, []);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setCustomers(data || []);
    setLoading(false);
  }

  async function fetchQuotations() {
    const { data, error } = await supabase
      .from('route_quotations')
      .select('*, customers(company_name)')
      .order('created_at', { ascending: false });
    if (!error) {
      const processedData = data?.map(q => ({
        ...q,
        company_name: q.customers?.company_name || '',
        service_type: q.service_type || 'unknown',
      })) || [];
      setQuotations(processedData);
    }
  }

  async function fetchContracts() {
    const { data, error } = await supabase
      .from('transport_contracts')
      .select('*, customers(company_name)')
      .order('created_at', { ascending: false });
    if (!error) setContracts(data?.map(c => ({ ...c, company_name: c.customers?.company_name })) || []);
  }

  async function fetchRateSheets() {
    // First check if the created_by column exists, if not add it
    try {
      await supabase.rpc('add_created_by_column_if_not_exists');
    } catch (e) {
      console.log('Error checking/adding created_by column:', e);
    }

    const { data, error } = await supabase
      .from('rate_sheets')
      .select('*')
      .eq('is_active', true)
      .not('route_name', 'is', null)
      .order('route_name');
    if (!error) setRateSheets(data || []);
  }

  async function fetchJsonbRateSheets() {
    const { data, error } = await supabase
      .from('rate_sheets')
      .select('*')
      .eq('is_active', true)
      .not('rate_sheet_name', 'is', null)
      .order('created_at', { ascending: false });
    if (!error) setJsonbRateSheets(data || []);
  }

  async function fetchOpportunities() {
    const { data, error } = await supabase
      .from('sales_opportunities')
      .select('*, customers(company_name)')
      .order('created_at', { ascending: false });
    if (!error) {
      const processedData = data?.map(o => ({
        ...o,
        company_name: o.customers?.company_name || '',
        service_type: o.service_type || 'unknown',
        stage: o.stage || 'lead',
      })) || [];
      setOpportunities(processedData);
    }
  }

  // Save functions
  async function saveCustomer() {
    if (!customerForm.company_name || !customerForm.contact_person || !customerForm.phone) {
      toast({ title: 'Error', description: 'Please fill required fields', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('customers').insert([{
      ...customerForm,
      credit_limit: parseFloat(customerForm.credit_limit) || 0,
      created_by: user?.id
    }]);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Customer created successfully' });
      setShowCustomerDialog(false);
      setCustomerForm({
        company_name: '', contact_person: '', email: '', phone: '',
        address: '', city: 'Dar es Salaam', tax_id: '', credit_limit: '',
        payment_terms: '30 days', status: 'prospect', notes: ''
      });
      fetchCustomers();
    }
  }

  async function saveQuotation() {
    const base = quotationForm.distance_km * quotationForm.rate_per_km;
    const fuel = base * (quotationForm.fuel_surcharge_pct / 100);
    const subtotal = base + fuel + quotationForm.border_fees + quotationForm.escort_fees;
    const vat = subtotal * (quotationForm.vat_rate / 100);
    const total = subtotal + vat;

    const { error } = await supabase.from('route_quotations').insert([{
      customer_id: quotationForm.customer_id,
      service_type: quotationForm.service_type,
      origin: quotationForm.origin,
      destination: quotationForm.destination,
      distance_km: quotationForm.distance_km,
      cargo_type: quotationForm.cargo_type,
      cargo_weight_mt: parseFloat(quotationForm.cargo_weight_mt as string) || 0,
      container_size: quotationForm.container_size,
      rate_per_km: quotationForm.rate_per_km,
      base_amount: base,
      fuel_surcharge_pct: quotationForm.fuel_surcharge_pct,
      fuel_surcharge_amount: fuel,
      border_fees: quotationForm.border_fees,
      escort_fees: quotationForm.escort_fees,
      subtotal,
      vat_rate: quotationForm.vat_rate,
      vat_amount: vat,
      total_amount: total,
      validity_days: quotationForm.validity_days,
      expiry_date: format(addDays(new Date(), quotationForm.validity_days), 'yyyy-MM-dd'),
      notes: quotationForm.notes,
      created_by: user?.id
    }]);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quotation created successfully' });
      setShowQuotationDialog(false);
      fetchQuotations();
    }
  }

  async function saveContract() {
    const { error } = await supabase.from('transport_contracts').insert([{
      customer_id: contractForm.customer_id,
      contract_type: contractForm.contract_type,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      min_monthly_trips: contractForm.min_monthly_trips,
      contract_value: parseFloat(contractForm.contract_value as string) || 0,
      payment_terms: contractForm.payment_terms,
      notes: contractForm.notes,
      created_by: user?.id
    }]);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Contract created successfully' });
      setShowContractDialog(false);
      fetchContracts();
    }
  }

  async function saveOpportunity() {
    const { error } = await supabase.from('sales_opportunities').insert([{
      customer_id: opportunityForm.customer_id,
      opportunity_name: opportunityForm.opportunity_name,
      service_type: opportunityForm.service_type,
      estimated_monthly_revenue: parseFloat(opportunityForm.estimated_monthly_revenue as string) || 0,
      probability: opportunityForm.probability,
      stage: opportunityForm.stage,
      expected_close_date: opportunityForm.expected_close_date,
      competitor: opportunityForm.competitor,
      notes: opportunityForm.notes,
      created_by: user?.id
    }]);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Opportunity created successfully' });
      setShowOpportunityDialog(false);
      fetchOpportunities();
    }
  }

  async function saveRateSheet() {
    if (!newRateSheet.route_name || !newRateSheet.origin || !newRateSheet.destination) {
      toast({ title: 'Error', description: 'Route name, origin and destination are required', variant: 'destructive' });
      return;
    }

    const rateSheetPayload = {
      ...newRateSheet,
      container_20ft: Number(newRateSheet.container_20ft) || 0,
      container_40ft: Number(newRateSheet.container_40ft) || 0,
      loose_rate_mt: Number(newRateSheet.loose_rate_mt) || 0,
      transit_days: Number(newRateSheet.transit_days) || 0,
      distance_km: Number(newRateSheet.distance_km) || 0,
      is_active: true,
    } as any;

    try {
      if (editingRateSheet?.id) {
        const { error } = await supabase.from('rate_sheets').update(rateSheetPayload).eq('id', editingRateSheet.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Rate sheet updated successfully' });
      } else {
        const { error } = await supabase.from('rate_sheets').insert([rateSheetPayload]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Rate sheet created successfully' });
      }
      setShowRateSheetDialog(false);
      setEditingRateSheet(null);
      resetRateSheetForm();
      fetchRateSheets();
    } catch (error: any) {
      console.error('Error saving rate sheet:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save rate sheet', variant: 'destructive' });
    }
  }

  function resetRateSheetForm() {
    setNewRateSheet({
      route_name: '',
      service_type: 'local_transport',
      origin: '',
      destination: '',
      distance_km: 0,
      currency: 'TZS',
      container_20ft: 0,
      container_40ft: 0,
      loose_rate_mt: 0,
      transit_days: 0,
      special_conditions: '',
      is_active: true,
    });
  }

  // Helper functions
  function getStatusColor(status: string) {
    switch (status) {
      case 'active': case 'sent': case 'won': return 'bg-green-500';
      case 'pending': case 'draft': return 'bg-yellow-500';
      case 'expired': case 'lost': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  function getStageColor(stage: string) {
    switch (stage) {
      case 'contract_won': return 'bg-green-500';
      case 'contract_lost': return 'bg-red-500';
      case 'negotiation': return 'bg-orange-500';
      case 'quotation_sent': return 'bg-blue-500';
      default: return 'bg-yellow-500';
    }
  }

  // Calculate totals
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalQuotations = quotations.length;
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalOpportunities = opportunities.length;
  const pipelineValue = opportunities.reduce((sum, o) => sum + (o.estimated_monthly_revenue || 0), 0)
    + contracts.filter(c => c.status !== 'terminated' && c.status !== 'expired').reduce((sum, c) => sum + (c.contract_value || 0), 0);

  // Contract status badge helper
  function getContractStatusBadge(status: string) {
    switch (status) {
      case 'active': return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' };
      case 'draft': return { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Draft' };
      case 'expired': return { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired' };
      case 'terminated': return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Terminated' };
      case 'pending_signature': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Pending Signature' };
      case 'suspended': return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Suspended' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    }
  }

  if (loading) return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar role={role || 'OPERATOR'} />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar role={role || 'OPERATOR'} />
      <div className="flex-1 p-4 md:p-6 md:ml-64">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Sales & Commercial</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Manage customers, quotations, contracts, and sales pipeline</p>
        </div>

        {/* Stats - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 mb-1">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 mb-1">Active Quotations</p>
                  <p className="text-2xl font-bold text-gray-900">{totalQuotations}</p>
                </div>
                <div className="bg-amber-100 p-3 rounded-lg flex-shrink-0">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 mb-1">Contracts</p>
                  <p className="text-2xl font-bold text-gray-900">{totalContracts}</p>
                </div>
                <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
                  <FileSignature className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 mb-1">Pipeline Value</p>
                  <p className="text-2xl font-bold text-gray-900">TZS {pipelineValue.toLocaleString()}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="rate-sheets">Rate Sheets</TabsTrigger>
            <TabsTrigger value="opportunities">Pipeline</TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Customers
                </CardTitle>
                {canCreate && (
                  <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                    <DialogTrigger asChild>
                      <Button><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Customer</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Company Name *</Label>
                          <Input value={customerForm.company_name} onChange={e => setCustomerForm({ ...customerForm, company_name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Person *</Label>
                          <Input value={customerForm.contact_person} onChange={e => setCustomerForm({ ...customerForm, contact_person: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone *</Label>
                          <Input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Select value={customerForm.city} onValueChange={v => setCustomerForm({ ...customerForm, city: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                              <SelectItem value="Arusha">Arusha</SelectItem>
                              <SelectItem value="Mwanza">Mwanza</SelectItem>
                              <SelectItem value="Dodoma">Dodoma</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Credit Limit (TZS)</Label>
                          <Input type="number" value={customerForm.credit_limit} onChange={e => setCustomerForm({ ...customerForm, credit_limit: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={customerForm.status} onValueChange={v => setCustomerForm({ ...customerForm, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Address</Label>
                          <Textarea value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomerDialog(false)}>Cancel</Button>
                        <Button onClick={saveCustomer}>Save Customer</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Code</TableHead>
                        <TableHead className="min-w-[120px]">Company</TableHead>
                        <TableHead className="min-w-[100px]">Contact</TableHead>
                        <TableHead className="min-w-[100px]">Phone</TableHead>
                        <TableHead className="min-w-[80px]">City</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Credit Limit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map(customer => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.customer_code}</TableCell>
                          <TableCell>{customer.company_name}</TableCell>
                          <TableCell>{customer.contact_person}</TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>{customer.city}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(customer.status)}>
                              {customer.status}
                            </Badge>
                          </TableCell>
                          <TableCell>TZS {(customer.credit_limit || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quotations Tab */}
          <TabsContent value="quotations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Route Quotations
                </CardTitle>
                {canCreate && (
                  <Dialog open={showQuotationDialog} onOpenChange={setShowQuotationDialog}>
                    <DialogTrigger asChild>
                      <Button><Plus className="h-4 w-4 mr-2" /> New Quotation</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Route Quotation</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Customer</Label>
                          <Select value={quotationForm.customer_id} onValueChange={v => setQuotationForm({ ...quotationForm, customer_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                            <SelectContent>
                              {customers.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Service Type</Label>
                          <Select value={quotationForm.service_type} onValueChange={v => {
                            setQuotationForm({ ...quotationForm, service_type: v });
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Origin</Label>
                          <Input value={quotationForm.origin} onChange={e => setQuotationForm({ ...quotationForm, origin: e.target.value })} placeholder="e.g., Dar es Salaam" />
                        </div>
                        <div className="space-y-2">
                          <Label>Destination</Label>
                          <Input value={quotationForm.destination} onChange={e => setQuotationForm({ ...quotationForm, destination: e.target.value })} placeholder="e.g., Lusaka" />
                        </div>
                        <div className="space-y-2">
                          <Label>Distance (km)</Label>
                          <Input type="number" value={quotationForm.distance_km} onChange={e => setQuotationForm({ ...quotationForm, distance_km: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo Type</Label>
                          <Input value={quotationForm.cargo_type} onChange={e => setQuotationForm({ ...quotationForm, cargo_type: e.target.value })} placeholder="e.g., Electronics, Maize" />
                        </div>
                        <div className="space-y-2">
                          <Label>Weight (MT)</Label>
                          <Input type="number" value={quotationForm.cargo_weight_mt} onChange={e => setQuotationForm({ ...quotationForm, cargo_weight_mt: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Container Size</Label>
                          <Select value={quotationForm.container_size} onValueChange={v => setQuotationForm({ ...quotationForm, container_size: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20ft">20ft Container</SelectItem>
                              <SelectItem value="40ft">40ft Container</SelectItem>
                              <SelectItem value="45ft">45ft Container</SelectItem>
                              <SelectItem value="loose">Loose Cargo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Rate per km (TZS)</Label>
                          <Input type="number" value={quotationForm.rate_per_km} onChange={e => setQuotationForm({ ...quotationForm, rate_per_km: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fuel Surcharge %</Label>
                          <Input type="number" value={quotationForm.fuel_surcharge_pct} onChange={e => setQuotationForm({ ...quotationForm, fuel_surcharge_pct: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Border Fees (TZS)</Label>
                          <Input type="number" value={quotationForm.border_fees} onChange={e => setQuotationForm({ ...quotationForm, border_fees: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Escort Fees (TZS)</Label>
                          <Input type="number" value={quotationForm.escort_fees} onChange={e => setQuotationForm({ ...quotationForm, escort_fees: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>VAT Rate %</Label>
                          <Input type="number" value={quotationForm.vat_rate} onChange={e => setQuotationForm({ ...quotationForm, vat_rate: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Validity (days)</Label>
                          <Input type="number" value={quotationForm.validity_days} onChange={e => setQuotationForm({ ...quotationForm, validity_days: parseInt(e.target.value) || 30 })} />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={quotationForm.notes} onChange={e => setQuotationForm({ ...quotationForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <Separator className="my-4" />
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Base Amount:</div>
                          <div className="text-right">TZS {(quotationForm.distance_km * quotationForm.rate_per_km).toLocaleString()}</div>
                          <div>Fuel Surcharge ({quotationForm.fuel_surcharge_pct}%):</div>
                          <div className="text-right">TZS {((quotationForm.distance_km * quotationForm.rate_per_km) * (quotationForm.fuel_surcharge_pct / 100)).toLocaleString()}</div>
                          <div>Border Fees:</div>
                          <div className="text-right">TZS {quotationForm.border_fees.toLocaleString()}</div>
                          <div>Subtotal:</div>
                          <div className="text-right font-medium">
                            TZS {((quotationForm.distance_km * quotationForm.rate_per_km) * (1 + quotationForm.fuel_surcharge_pct / 100) + quotationForm.border_fees + quotationForm.escort_fees).toLocaleString()}
                          </div>
                          <div>VAT ({quotationForm.vat_rate}%):</div>
                          <div className="text-right">
                            TZS {(((quotationForm.distance_km * quotationForm.rate_per_km) * (1 + quotationForm.fuel_surcharge_pct / 100) + quotationForm.border_fees + quotationForm.escort_fees) * (quotationForm.vat_rate / 100)).toLocaleString()}
                          </div>
                          <div className="font-bold">Total Amount:</div>
                          <div className="text-right font-bold text-lg text-green-600">
                            TZS {(((quotationForm.distance_km * quotationForm.rate_per_km) * (1 + quotationForm.fuel_surcharge_pct / 100) + quotationForm.border_fees + quotationForm.escort_fees) * (1 + quotationForm.vat_rate / 100)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowQuotationDialog(false)}>Cancel</Button>
                        <Button onClick={saveQuotation}>Create Quotation</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map(q => (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium">{q.quotation_number}</TableCell>
                          <TableCell>{q.company_name}</TableCell>
                          <TableCell>{q.origin} → {q.destination}</TableCell>
                          <TableCell>{String(q.service_type || "").replace('_', ' ')}</TableCell>
                          <TableCell>TZS {(q.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(q.status)}>{q.status}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(q.expiry_date), 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            {showContractGenerator ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">Calvary Transport Agreement</h2>
                    <p className="text-sm text-muted-foreground">Generate and print the Calvary transport contract template.</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowContractGenerator(false)}>
                    Close
                  </Button>
                </div>
                <TransportAgreementGenerator />
              </div>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Transport Contracts
                    <Badge variant="outline" className="ml-2">{totalContracts}</Badge>
                  </CardTitle>
                  {canCreate && (
                    <Button onClick={() => setShowContractGenerator(true)}>
                      <Plus className="h-4 w-4 mr-2" /> New Contract
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contract #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No contracts yet. Click "+ New Contract" to generate one.
                            </TableCell>
                          </TableRow>
                        ) : contracts.map(c => {
                          const statusBadge = getContractStatusBadge(c.status);
                          return (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setPreviewContract(c)}>
                              <TableCell>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 font-mono">
                                  {c.contract_number}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">{c.company_name || '—'}</TableCell>
                              <TableCell className="capitalize">{(c.contract_type || 'standard').replace('_', ' ')}</TableCell>
                              <TableCell>
                                {c.start_date ? format(new Date(c.start_date), 'MMM yyyy') : '—'}
                                {c.end_date && ` → ${format(new Date(c.end_date), 'MMM yyyy')}`}
                              </TableCell>
                              <TableCell>{c.currency || 'USD'} {(c.contract_value || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={`${statusBadge.bg} ${statusBadge.text} text-xs`}>
                                  {statusBadge.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" onClick={() => setPreviewContract(c)} title="Preview">
                                    <Eye className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  {c.generated_html && (
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      const w = window.open('', '_blank');
                                      if (w) {
                                        w.document.write(`<html><head><title>${c.contract_number}</title></head><body>${c.generated_html}</body></html>`);
                                        w.document.close();
                                        w.print();
                                      }
                                    }} title="Print PDF">
                                      <Printer className="h-4 w-4 text-slate-500" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract Preview Dialog */}
            <Dialog open={!!previewContract} onOpenChange={() => setPreviewContract(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Contract {previewContract?.contract_number}
                  </DialogTitle>
                </DialogHeader>
                {previewContract?.generated_html ? (
                  <div>
                    <div className="flex gap-2 mb-4">
                      <Button variant="outline" size="sm" onClick={() => {
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(`<html><head><title>${previewContract.contract_number}</title></head><body>${previewContract.generated_html}</body></html>`);
                          w.document.close();
                          w.print();
                        }
                      }}>
                        <Printer className="h-4 w-4 mr-2" /> Print / PDF
                      </Button>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: previewContract.generated_html }} />
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No contract document was generated for this contract.</p>
                    <p className="text-sm mt-2">Contract details:</p>
                    <div className="text-left mt-4 space-y-2 max-w-md mx-auto">
                      <p><strong>Customer:</strong> {previewContract?.company_name}</p>
                      <p><strong>Type:</strong> {previewContract?.contract_type}</p>
                      <p><strong>Value:</strong> {previewContract?.currency} {previewContract?.contract_value?.toLocaleString()}</p>
                      <p><strong>Status:</strong> {previewContract?.status}</p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Rate Sheets Tab */}
          <TabsContent value="rate-sheets">
            <div className="space-y-6">
              {canCreate && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Create and manage route rate sheets for pricing and transport planning.</p>
                  </div>
                  <Dialog open={showRateSheetDialog} onOpenChange={(open) => {
                    if (!open) {
                      setEditingRateSheet(null);
                      resetRateSheetForm();
                    }
                    setShowRateSheetDialog(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingRateSheet(null);
                        resetRateSheetForm();
                      }} className="gap-2">
                        <Plus className="h-4 w-4" /> New Rate Sheet
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editingRateSheet ? 'Edit Route Rate Sheet' : 'New Route Rate Sheet'}</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Route Name</Label>
                            <Input value={newRateSheet.route_name} onChange={e => setNewRateSheet({ ...newRateSheet, route_name: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Service Type</Label>
                            <Select value={newRateSheet.service_type} onValueChange={v => setNewRateSheet({ ...newRateSheet, service_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SERVICE_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Origin</Label>
                            <Input value={newRateSheet.origin} onChange={e => setNewRateSheet({ ...newRateSheet, origin: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Destination</Label>
                            <Input value={newRateSheet.destination} onChange={e => setNewRateSheet({ ...newRateSheet, destination: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Distance (km)</Label>
                            <Input type="number" value={newRateSheet.distance_km} onChange={e => setNewRateSheet({ ...newRateSheet, distance_km: parseInt(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>20ft Rate</Label>
                            <Input type="number" value={newRateSheet.container_20ft} onChange={e => setNewRateSheet({ ...newRateSheet, container_20ft: Number(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>40ft Rate</Label>
                            <Input type="number" value={newRateSheet.container_40ft} onChange={e => setNewRateSheet({ ...newRateSheet, container_40ft: Number(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Loose Rate / MT</Label>
                            <Input type="number" value={newRateSheet.loose_rate_mt} onChange={e => setNewRateSheet({ ...newRateSheet, loose_rate_mt: Number(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Transit Days</Label>
                            <Input type="number" value={newRateSheet.transit_days} onChange={e => setNewRateSheet({ ...newRateSheet, transit_days: Number(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Special Conditions</Label>
                          <Textarea value={newRateSheet.special_conditions} onChange={e => setNewRateSheet({ ...newRateSheet, special_conditions: e.target.value })} rows={3} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setShowRateSheetDialog(false);
                          setEditingRateSheet(null);
                          resetRateSheetForm();
                        }}>Cancel</Button>
                        <Button onClick={saveRateSheet}>{editingRateSheet ? 'Update Rate Sheet' : 'Create Rate Sheet'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* JSONB Rate Sheets (from contract system) */}
              {jsonbRateSheets.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Freight Rate Sheets
                      <Badge variant="outline" className="ml-2">{jsonbRateSheets.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {jsonbRateSheets.map(rs => (
                        <div key={rs.id} className="border rounded-lg overflow-hidden">
                          <div
                            className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100"
                            onClick={() => setViewingRateSheet(viewingRateSheet?.id === rs.id ? null : rs)}
                          >
                            <div>
                              <h3 className="font-semibold text-sm">{rs.rate_sheet_name}</h3>
                              <p className="text-xs text-muted-foreground">
                                Effective: {rs.effective_date ? new Date(rs.effective_date).toLocaleDateString() : '—'} · {rs.currency} · {rs.rates?.length || 0} routes
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-100 text-emerald-800 text-xs">Active</Badge>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          {viewingRateSheet?.id === rs.id && (
                            <div className="p-4 border-t">
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>From</TableHead>
                                      <TableHead>Destination</TableHead>
                                      <TableHead className="text-right">20ft ({rs.currency})</TableHead>
                                      <TableHead className="text-right">40ft ({rs.currency})</TableHead>
                                      <TableHead className="text-right">Loose ({rs.currency})</TableHead>
                                      <TableHead className="text-center">Truck</TableHead>
                                      <TableHead className="text-center">Days</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {rs.rates?.map((rate: any, idx: number) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-sm">{rate.from}</TableCell>
                                        <TableCell className="text-sm font-medium">{rate.destination}</TableCell>
                                        <TableCell className="text-right text-sm">{rate.container_20ft?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-sm">{rate.container_40ft?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-sm">{rate.loose?.toLocaleString()}</TableCell>
                                        <TableCell className="text-center text-sm">{rate.truck_type}</TableCell>
                                        <TableCell className="text-center text-sm">{rate.transit_days}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {rs.special_conditions && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                  <strong>Note:</strong> {rs.special_conditions}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Legacy flat rate sheets */}
              {rateSheets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Route Rate Sheet
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Route</TableHead>
                            <TableHead>Service Type</TableHead>
                            <TableHead>Distance</TableHead>
                            <TableHead>20ft (TZS)</TableHead>
                            <TableHead>40ft (TZS)</TableHead>
                            <TableHead>Loose/MT</TableHead>
                            <TableHead>Transit Days</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rateSheets.map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{r.route_name}</TableCell>
                              <TableCell className="capitalize">{String(r.service_type || "").replace('_', ' ')}</TableCell>
                              <TableCell>{r.distance_km} km</TableCell>
                              <TableCell>{r.container_20ft ? r.container_20ft.toLocaleString() : '-'}</TableCell>
                              <TableCell>{r.container_40ft ? r.container_40ft.toLocaleString() : '-'}</TableCell>
                              <TableCell>{r.loose_rate_mt ? r.loose_rate_mt.toLocaleString() : '-'}</TableCell>
                              <TableCell>{r.transit_days}</TableCell>
                              <TableCell>
                                {canCreate && (
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setEditingRateSheet({ ...r });
                                      setNewRateSheet({
                                        route_name: r.route_name || '',
                                        service_type: r.service_type || 'local_transport',
                                        origin: r.origin || '',
                                        destination: r.destination || '',
                                        distance_km: r.distance_km || 0,
                                        currency: (r as any).currency || 'TZS',
                                        container_20ft: r.container_20ft || 0,
                                        container_40ft: r.container_40ft || 0,
                                        loose_rate_mt: r.loose_rate_mt || 0,
                                        transit_days: r.transit_days || 0,
                                        special_conditions: (r as any).special_conditions || '',
                                        is_active: r.is_active !== false,
                                      });
                                      setShowRateSheetDialog(true);
                                    }}>
                                      Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={async () => {
                                      if (confirm('Are you sure you want to delete this rate sheet?')) {
                                        try {
                                          const { error } = await supabase
                                            .from('rate_sheets')
                                            .update({ is_active: false })
                                            .eq('id', r.id);

                                          if (error) throw error;

                                          toast({ title: 'Success', description: 'Rate sheet deleted successfully', variant: 'success' });

                                          // Refresh rate sheets
                                          const { data: refreshed, error: fetchErr } = await supabase.from('rate_sheets').select('*').eq('is_active', true);
                                          if (!fetchErr) setRateSheets(refreshed || []);
                                        } catch (e: any) {
                                          console.error('Error deleting rate sheet:', e);
                                          toast({ title: 'Error', description: e.message || 'Failed to delete rate sheet', variant: 'destructive' });
                                        }
                                      }
                                    }}>
                                      Delete
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {rateSheets.length === 0 && jsonbRateSheets.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No rate sheets found. Run the SQL migration to seed default rates.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sales Pipeline
                </CardTitle>
                {canCreate && (
                  <Dialog open={showOpportunityDialog} onOpenChange={setShowOpportunityDialog}>
                    <DialogTrigger asChild>
                      <Button><Plus className="h-4 w-4 mr-2" /> Add Opportunity</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Sales Opportunity</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Customer</Label>
                          <Select value={opportunityForm.customer_id} onValueChange={v => setOpportunityForm({ ...opportunityForm, customer_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                            <SelectContent>
                              {customers.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Opportunity Name</Label>
                          <Input value={opportunityForm.opportunity_name} onChange={e => setOpportunityForm({ ...opportunityForm, opportunity_name: e.target.value })} placeholder="e.g., Q1 Logistics Contract" />
                        </div>
                        <div className="space-y-2">
                          <Label>Service Type</Label>
                          <Select value={opportunityForm.service_type} onValueChange={v => setOpportunityForm({ ...opportunityForm, service_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Monthly Revenue (TZS)</Label>
                          <Input type="number" value={opportunityForm.estimated_monthly_revenue} onChange={e => setOpportunityForm({ ...opportunityForm, estimated_monthly_revenue: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Probability (%)</Label>
                          <Input type="number" min="0" max="100" value={opportunityForm.probability} onChange={e => setOpportunityForm({ ...opportunityForm, probability: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Stage</Label>
                          <Select value={opportunityForm.stage} onValueChange={v => setOpportunityForm({ ...opportunityForm, stage: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="qualification">Qualification</SelectItem>
                              <SelectItem value="quotation_sent">Quotation Sent</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="contract_won">Contract Won</SelectItem>
                              <SelectItem value="contract_lost">Contract Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Expected Close Date</Label>
                          <Input type="date" value={opportunityForm.expected_close_date} onChange={e => setOpportunityForm({ ...opportunityForm, expected_close_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Competitor</Label>
                          <Input value={opportunityForm.competitor} onChange={e => setOpportunityForm({ ...opportunityForm, competitor: e.target.value })} placeholder="Who are we competing with?" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={opportunityForm.notes} onChange={e => setOpportunityForm({ ...opportunityForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowOpportunityDialog(false)}>Cancel</Button>
                        <Button onClick={saveOpportunity}>Save Opportunity</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Monthly Revenue</TableHead>
                        <TableHead>Probability</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Expected Close</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opportunities.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.opportunity_name}</TableCell>
                          <TableCell>{o.company_name}</TableCell>
                          <TableCell>{String(o.service_type || "").replace('_', ' ')}</TableCell>
                          <TableCell>TZS {(o.estimated_monthly_revenue || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${o.probability}%` }}></div>
                              </div>
                              <span className="text-sm">{o.probability}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStageColor(o.stage)}>{String(o.stage || "").replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(o.expected_close_date), 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Wrapper with Suspense boundary for useSearchParams
export default function SalesModule() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar role="OPERATOR" />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    }>
      <SalesModuleContent />
    </Suspense>
  );
}
