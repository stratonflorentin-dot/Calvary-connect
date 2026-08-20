"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { checkCreditLimit } from '@/lib/finance/credit-check';
import { sanitizeHtml } from '@/lib/sanitize-html';
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
import { logCustomerActivity } from '@/lib/customer-activity';
import { formatCurrency } from '@/components/ui/currency-badge';
import Link from 'next/link';
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
  vrn: string;
  credit_limit: number;
  credit_limit_currency?: 'TZS' | 'USD';
  status: string;
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
  const [quotations, setQuotations] = useState<any[]>([]);
  const [contracts, setContracts] = useState<TransportContract[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheetEntry[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
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

  // Freight rate sheets (JSONB format — a named sheet holding multiple routes)
  const [showFreightSheetDialog, setShowFreightSheetDialog] = useState(false);
  const [editingFreightSheet, setEditingFreightSheet] = useState<any>(null);
  const [freightSheetForm, setFreightSheetForm] = useState({
    rate_sheet_name: '',
    effective_date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: '',
    currency: 'USD',
    special_conditions: '',
    rates: [] as Array<{ from: string; destination: string; container_20ft: number; container_40ft: number; loose: number; truck_type: string; transit_days: number }>,
  });

  // Form states
  const [customerForm, setCustomerForm] = useState({
    company_name: '', contact_person: '', email: '', phone: '',
    address: '', city: 'Dar es Salaam', tax_id: '', vrn: '', credit_limit: '', credit_limit_currency: 'TZS',
    payment_terms: '30 days', status: 'prospect', notes: ''
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
    fetchLeads();
    fetchSalesOrders();
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
    // Real quotations table now — the old route_quotations-backed tab/form
    // was removed in favor of the full /quotations module; this is kept
    // only for the "N quotation(s)" stat card on this page.
    const { data, error } = await supabase
      .from('quotations')
      .select('id')
      .order('created_at', { ascending: false });
    if (!error) setQuotations(data || []);
  }

  // Sales Orders = bookings (this page's "New Sales Order" button already
  // links to /bookings, which is the real table — see interface Booking in
  // src/app/bookings/page.tsx). Real fields only: bookings has one total
  // `amount` + `currency`, not a base/onloading/offloading breakdown, and a
  // real status enum (pending/confirmed/in_progress/completed/cancelled),
  // not the "Pending Collection"/"Collected" labels the old mock data used.
  async function fetchSalesOrders() {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setSalesOrders(data || []);
  }

  async function fetchContracts() {
    const { data, error } = await supabase
      .from('transport_contracts')
      .select('*, customers(company_name)')
      .order('created_at', { ascending: false });
    if (!error) setContracts(data?.map(c => ({ ...c, company_name: c.customers?.company_name })) || []);
  }

  async function fetchRateSheets() {
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
    try {
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
    } catch (e) {
      console.log('Error fetching sales opportunities:', e);
    }
  }

  async function fetchLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setLeads(data || []);
    } catch (e) {
      console.log('Error fetching leads:', e);
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
        address: '', city: 'Dar es Salaam', tax_id: '', vrn: '', credit_limit: '', credit_limit_currency: 'TZS',
        payment_terms: '30 days', status: 'prospect', notes: ''
      });
      fetchCustomers();
    }
  }

  // saveQuotation/approveQuotation/sendQuotationToCustomer/convertQuotationToBooking
  // removed — quotation authoring now lives in /quotations (real quotations/
  // quotation_lines tables), which also auto-creates a Shipment on accept.
  async function convertContractToBooking(contractId: string) {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;

    const { data: booking, error: bookingError } = await supabase.from('bookings').insert([{
      booking_number: bookingNumber,
      customer_id: contract.customer_id,
      contract_id: contract.id,
      vehicle_requirement: contract.contract_type,
      amount: contract.contract_value,
      currency: contract.currency || 'TZS',
      pickup_date: new Date().toISOString().split('T')[0],
      operations_review_status: 'pending',
      status: 'pending'
    }]).select().single();

    if (bookingError) {
      toast({ title: 'Error', description: 'Failed to create booking', variant: 'destructive' });
      return;
    }

    const { error: updateError } = await supabase.from('transport_contracts').update({
      converted_to_booking_ids: [...((contract as any).converted_to_booking_ids || []), booking.id]
    }).eq('id', contractId);

    if (updateError) {
      toast({ title: 'Error', description: 'Failed to update contract', variant: 'destructive' });
    } else {
      logCustomerActivity({
        customerId: contract.customer_id,
        activityType: 'booking',
        description: `Booking ${bookingNumber} created from contract`,
        amount: contract.contract_value,
        createdBy: user?.id,
      });
      toast({ title: 'Success', description: `Booking created: ${bookingNumber}` });
      fetchContracts();
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
      logCustomerActivity({
        customerId: contractForm.customer_id,
        activityType: 'contract',
        description: `${contractForm.contract_type} contract signed`,
        amount: parseFloat(contractForm.contract_value as string) || 0,
        createdBy: user?.id,
      });
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

  function resetFreightSheetForm() {
    setFreightSheetForm({
      rate_sheet_name: '',
      effective_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: '',
      currency: 'USD',
      special_conditions: '',
      rates: [],
    });
  }

  function openFreightSheetDialog(sheet?: any) {
    if (sheet) {
      setEditingFreightSheet(sheet);
      setFreightSheetForm({
        rate_sheet_name: sheet.rate_sheet_name || '',
        effective_date: sheet.effective_date ? String(sheet.effective_date).slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
        expiry_date: sheet.expiry_date ? String(sheet.expiry_date).slice(0, 10) : '',
        currency: sheet.currency || 'USD',
        special_conditions: sheet.special_conditions || '',
        rates: Array.isArray(sheet.rates)
          ? sheet.rates.map((r: any) => ({
              from: r.from || '',
              destination: r.destination || '',
              container_20ft: r.container_20ft || 0,
              container_40ft: r.container_40ft || 0,
              loose: r.loose || 0,
              truck_type: r.truck_type || '',
              transit_days: r.transit_days || 0,
            }))
          : [],
      });
    } else {
      setEditingFreightSheet(null);
      resetFreightSheetForm();
    }
    setShowFreightSheetDialog(true);
  }

  function addFreightRateRow() {
    setFreightSheetForm(prev => ({
      ...prev,
      rates: [...prev.rates, { from: '', destination: '', container_20ft: 0, container_40ft: 0, loose: 0, truck_type: '', transit_days: 0 }],
    }));
  }

  function updateFreightRateRow(idx: number, field: keyof typeof freightSheetForm.rates[number], value: string | number) {
    setFreightSheetForm(prev => ({
      ...prev,
      rates: prev.rates.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    }));
  }

  function removeFreightRateRow(idx: number) {
    setFreightSheetForm(prev => ({ ...prev, rates: prev.rates.filter((_, i) => i !== idx) }));
  }

  async function saveFreightRateSheet() {
    if (!freightSheetForm.rate_sheet_name.trim()) {
      toast({ title: 'Error', description: 'Rate sheet name is required', variant: 'destructive' });
      return;
    }
    if (freightSheetForm.rates.length === 0) {
      toast({ title: 'Error', description: 'Add at least one route to the rate sheet', variant: 'destructive' });
      return;
    }
    if (freightSheetForm.rates.some(r => !r.from.trim() || !r.destination.trim())) {
      toast({ title: 'Error', description: 'Every route needs a "From" and a destination', variant: 'destructive' });
      return;
    }

    const payload = {
      rate_sheet_name: freightSheetForm.rate_sheet_name.trim(),
      effective_date: freightSheetForm.effective_date || null,
      expiry_date: freightSheetForm.expiry_date || null,
      currency: freightSheetForm.currency,
      special_conditions: freightSheetForm.special_conditions || null,
      rates: freightSheetForm.rates.map(r => ({
        from: r.from.trim(),
        destination: r.destination.trim(),
        container_20ft: Number(r.container_20ft) || 0,
        container_40ft: Number(r.container_40ft) || 0,
        loose: Number(r.loose) || 0,
        truck_type: r.truck_type.trim(),
        transit_days: Number(r.transit_days) || 0,
      })),
      is_active: true,
    } as any;

    try {
      if (editingFreightSheet?.id) {
        const { error } = await supabase.from('rate_sheets').update(payload).eq('id', editingFreightSheet.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Freight rate sheet updated' });
      } else {
        const { error } = await supabase.from('rate_sheets').insert([payload]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Freight rate sheet created' });
      }
      setShowFreightSheetDialog(false);
      setEditingFreightSheet(null);
      resetFreightSheetForm();
      fetchJsonbRateSheets();
    } catch (error: any) {
      console.error('Error saving freight rate sheet:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save freight rate sheet', variant: 'destructive' });
    }
  }

  async function deleteFreightRateSheet(id: string) {
    if (!confirm('Are you sure you want to delete this freight rate sheet?')) return;
    try {
      const { error } = await supabase.from('rate_sheets').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Freight rate sheet deleted' });
      if (viewingRateSheet?.id === id) setViewingRateSheet(null);
      fetchJsonbRateSheets();
    } catch (error: any) {
      console.error('Error deleting freight rate sheet:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete freight rate sheet', variant: 'destructive' });
    }
  }

  // Helper functions
  function getStatusColor(status: string) {
    switch (status) {
      case 'active': case 'sent': case 'won': case 'completed': case 'confirmed': return 'bg-success';
      case 'pending': case 'draft': case 'in_progress': return 'bg-warning';
      case 'expired': case 'lost': case 'cancelled': return 'bg-destructive';
      default: return 'bg-muted';
    }
  }

  function getStageColor(stage: string) {
    switch (stage) {
      case 'contract_won': return 'bg-success';
      case 'contract_lost': return 'bg-destructive';
      case 'negotiation': return 'bg-warning';
      case 'quotation_sent': return 'bg-primary';
      case 'qualification': return 'bg-info';
      default: return 'bg-warning';
    }
  }

  // Matches the sales_opportunities.stage CHECK constraint exactly —
  // database/patches/sales/sales-module-schema.sql line 167. Six real
  // stages, not the 5 a Stitch mockup assumed.
  const PIPELINE_STAGES: { value: string; label: string }[] = [
    { value: 'lead', label: 'Lead' },
    { value: 'qualification', label: 'Qualification' },
    { value: 'quotation_sent', label: 'Quotation Sent' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'contract_won', label: 'Contract Won' },
    { value: 'contract_lost', label: 'Contract Lost' },
  ];

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
      case 'active': return { bg: 'bg-success/10', text: 'text-success', label: 'Active' };
      case 'draft': return { bg: 'bg-muted/50', text: 'text-muted-foreground', label: 'Draft' };
      case 'expired': return { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Expired' };
      case 'terminated': return { bg: 'bg-warning/10', text: 'text-warning', label: 'Terminated' };
      case 'pending_signature': return { bg: 'bg-primary/10', text: 'text-primary', label: 'Pending Signature' };
      case 'suspended': return { bg: 'bg-warning/10', text: 'text-warning', label: 'Suspended' };
      default: return { bg: 'bg-muted/50', text: 'text-muted-foreground', label: status };
    }
  }

  if (loading) return (
    <div className="flex min-h-screen bg-muted">
      <Sidebar role={role || 'OPERATOR'} />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || 'OPERATOR'} />
      <div data-page-content className="flex-1 min-w-0 p-4 md:p-8 md:ml-64">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Sales & Commercial</h1>
          <p className="text-base text-muted-foreground mt-2">Manage customers, quotations, contracts, and sales pipeline</p>
        </div>

        {/* Stats - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wide mb-2">Total Customers</p>
                  <p className="text-2xl font-bold text-foreground">{totalCustomers}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wide mb-2">Active Quotations</p>
                  <p className="text-2xl font-bold text-foreground">{totalQuotations}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center shadow-sm flex-shrink-0">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wide mb-2">Contracts</p>
                  <p className="text-2xl font-bold text-foreground">{totalContracts}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shadow-sm flex-shrink-0">
                  <FileSignature className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wide mb-2">Pipeline Value</p>
                  <p className="text-2xl font-bold text-foreground">TZS {pipelineValue.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shadow-sm flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 h-11 bg-muted/50 p-1 rounded-xl flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-7">
            <TabsTrigger value="leads" className="h-9 rounded-lg">Leads</TabsTrigger>
            <TabsTrigger value="customers" className="h-9 rounded-lg">Customers</TabsTrigger>
            <TabsTrigger value="quotations" className="h-9 rounded-lg">Quotations</TabsTrigger>
            <TabsTrigger value="contracts" className="h-9 rounded-lg">Contracts</TabsTrigger>
            <TabsTrigger value="rate-sheets" className="h-9 rounded-lg">Rate Sheets</TabsTrigger>
            <TabsTrigger value="opportunities" className="h-9 rounded-lg">Pipeline</TabsTrigger>
            <TabsTrigger value="sales-orders" className="h-9 rounded-lg">Sales Orders</TabsTrigger>
          </TabsList>

          {/* Leads Tab */}
          <TabsContent value="leads">
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Lead Management
                </CardTitle>
                <Button asChild>
                  <Link href="/sales/leads">
                    <Plus className="h-4 w-4 mr-2" /> Manage Leads
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No leads found. <Link href="/sales/leads" className="text-primary hover:underline">Create your first lead</Link>
                          </TableCell>
                        </TableRow>
                      ) : (
                        leads.slice(0, 5).map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.company_name}</TableCell>
                            <TableCell>{lead.contact_person}</TableCell>
                            <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.lead_source || "-"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                lead.status === "new" ? "bg-blue-10 text-blue border-blue/20" :
                                  lead.status === "qualified" ? "bg-cyan-10 text-cyan border-cyan/20" :
                                    lead.status === "converted" ? "bg-success/10 text-success border-success/20" :
                                      lead.status === "lost" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                        "bg-purple-10 text-purple border-purple/20"
                              }>
                                {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${lead.probability}%` }} />
                                </div>
                                <span className="text-xs">{lead.probability}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {leads.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" asChild>
                      <Link href="/sales/leads">View All Leads</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Orders Tab (Professional Logistics Feature) */}
          <TabsContent value="sales-orders">
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Container className="h-5 w-5" />
                  Sales Orders & Freight Billing
                </CardTitle>
                <Button asChild>
                  <Link href="/bookings">
                    <Plus className="h-4 w-4 mr-2" /> New Sales Order
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {salesOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Container className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No sales orders yet</p>
                    <p className="text-sm mt-1">Convert a quotation or contract into a booking, or start one from the button above.</p>
                  </div>
                ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Order #</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Freight Details</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesOrders.map((order) => {
                        const freightBits = [
                          order.container_size || order.vehicle_requirement,
                          order.cargo_weight ? `${order.cargo_weight}MT` : null,
                          order.cargo_description,
                        ].filter(Boolean);
                        const route = [order.origin || order.pickup_location, order.destination || order.delivery_location]
                          .filter(Boolean)
                          .join(' → ');
                        return (
                          <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-bold text-foreground">{order.booking_number || order.id}</TableCell>
                            <TableCell className="font-semibold text-foreground">{order.clientName || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {freightBits.length > 0 && <div>{freightBits.join(' - ')}</div>}
                              {route && <div className="text-xs">{route}</div>}
                              {freightBits.length === 0 && !route && '—'}
                            </TableCell>
                            <TableCell className="text-sm font-bold text-foreground">
                              {order.currency || 'TZS'} {Number(order.amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>
                                {String(order.status || 'pending').replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.operations_review_status === 'pending' && (
                                <div className="flex items-center gap-1 text-destructive" title="Awaiting operations review">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-xs font-bold">Review</span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Customers
                </CardTitle>
                {canCreate && (
                  <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                    <DialogTrigger asChild>
                      <Button className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">Add New Customer</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Company Name *</Label>
                          <Input value={customerForm.company_name} onChange={e => setCustomerForm({ ...customerForm, company_name: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Contact Person *</Label>
                          <Input value={customerForm.contact_person} onChange={e => setCustomerForm({ ...customerForm, contact_person: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Phone *</Label>
                          <Input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Email</Label>
                          <Input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">City</Label>
                          <Select value={customerForm.city} onValueChange={v => setCustomerForm({ ...customerForm, city: v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                              <SelectItem value="Arusha">Arusha</SelectItem>
                              <SelectItem value="Mwanza">Mwanza</SelectItem>
                              <SelectItem value="Dodoma">Dodoma</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Credit Limit</Label>
                          <div className="flex gap-2">
                            <Input type="number" value={customerForm.credit_limit} onChange={e => setCustomerForm({ ...customerForm, credit_limit: e.target.value })} className="h-11 flex-1" />
                            <Select value={customerForm.credit_limit_currency} onValueChange={v => setCustomerForm({ ...customerForm, credit_limit_currency: v })}>
                              <SelectTrigger className="h-11 w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TZS">TZS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Status</Label>
                          <Select value={customerForm.status} onValueChange={v => setCustomerForm({ ...customerForm, status: v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Tax ID (TIN)</Label>
                          <Input value={customerForm.tax_id} onChange={e => setCustomerForm({ ...customerForm, tax_id: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">VRN</Label>
                          <Input value={customerForm.vrn} onChange={e => setCustomerForm({ ...customerForm, vrn: e.target.value })} className="h-11" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Address</Label>
                          <Textarea value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} className="min-h-[80px]" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Notes</Label>
                          <Textarea value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} className="min-h-[80px]" />
                        </div>
                      </div>
                      <DialogFooter className="pt-6">
                        <Button variant="outline" onClick={() => setShowCustomerDialog(false)} className="h-11 px-6">Cancel</Button>
                        <Button onClick={saveCustomer} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">Save Customer</Button>
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
                          <TableCell>{formatCurrency(customer.credit_limit || 0, customer.credit_limit_currency || 'TZS')}</TableCell>
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
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quotations
                </CardTitle>
                <Button asChild className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">
                  <Link href="/quotations"><Plus className="h-4 w-4 mr-2" /> Open Quotations</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Quotations now live in their own module — full builder, PDF, email, and customer accept/reject.
                </p>
                <p className="text-2xl font-bold text-foreground mt-3">{totalQuotations} quotation(s)</p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/quotations">View all quotations →</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            {showContractGenerator ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Calvary Transport Agreement</h2>
                    <p className="text-base text-muted-foreground mt-2">Generate and print the Calvary transport contract template.</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowContractGenerator(false)} className="h-11 px-6">
                    Close
                  </Button>
                </div>
                <TransportAgreementGenerator />
              </div>
            ) : (
              <Card className="shadow-lg border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Transport Contracts
                    <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">{totalContracts}</Badge>
                  </CardTitle>
                  {canCreate && (
                    <Button onClick={() => setShowContractGenerator(true)} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">
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
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              No contracts yet. Click "+ New Contract" to generate one.
                            </TableCell>
                          </TableRow>
                        ) : contracts.map(c => {
                          const statusBadge = getContractStatusBadge(c.status);
                          return (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewContract(c)}>
                              <TableCell>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary font-mono">
                                  {c.contract_number}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium text-foreground">{c.company_name || '—'}</TableCell>
                              <TableCell className="capitalize text-foreground">{(c.contract_type || 'standard').replace('_', ' ')}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {c.start_date ? format(new Date(c.start_date), 'MMM yyyy') : '—'}
                                {c.end_date && ` → ${format(new Date(c.end_date), 'MMM yyyy')}`}
                              </TableCell>
                              <TableCell className="text-foreground">{c.currency || 'USD'} {(c.contract_value || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={`${statusBadge.bg} ${statusBadge.text} text-xs font-medium`} variant="outline">
                                  {statusBadge.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" onClick={() => convertContractToBooking(c.id)} title="Create Booking" className="hover:bg-primary/10 hover:text-primary text-primary">
                                    <ArrowRight className="h-4 w-4 mr-1" /> Book
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setPreviewContract(c)} title="Preview" className="hover:bg-primary/10 hover:text-primary">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {c.generated_html && (
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      const w = window.open('', '_blank');
                                      if (w) {
                                        w.document.write(`<html><head><title>${c.contract_number}</title></head><body>${sanitizeHtml(c.generated_html ?? '')}</body></html>`);
                                        w.document.close();
                                        w.print();
                                      }
                                    }} title="Print PDF" className="hover:bg-primary/10 hover:text-primary">
                                      <Printer className="h-4 w-4" />
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
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Contract {previewContract?.contract_number}
                  </DialogTitle>
                </DialogHeader>
                {previewContract?.generated_html ? (
                  <div>
                    <div className="flex gap-3 mb-4">
                      <Button variant="outline" size="sm" onClick={() => {
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(`<html><head><title>${previewContract.contract_number}</title></head><body>${sanitizeHtml(previewContract.generated_html ?? '')}</body></html>`);
                          w.document.close();
                          w.print();
                        }
                      }} className="h-11 px-6">
                        <Printer className="h-4 w-4 mr-2" /> Print / PDF
                      </Button>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewContract.generated_html) }} />
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <p className="text-base">No contract document was generated for this contract.</p>
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
            <div className="space-y-8">
              {canCreate && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base text-muted-foreground">Create and manage route rate sheets for pricing and transport planning.</p>
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
                      }} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow gap-2">
                        <Plus className="h-4 w-4" /> New Rate Sheet
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">{editingRateSheet ? 'Edit Route Rate Sheet' : 'New Route Rate Sheet'}</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Route Name</Label>
                            <Input value={newRateSheet.route_name} onChange={e => setNewRateSheet({ ...newRateSheet, route_name: e.target.value })} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Service Type</Label>
                            <Select value={newRateSheet.service_type} onValueChange={v => setNewRateSheet({ ...newRateSheet, service_type: v })}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                            <Label className="text-sm font-semibold text-foreground">Origin</Label>
                            <Input value={newRateSheet.origin} onChange={e => setNewRateSheet({ ...newRateSheet, origin: e.target.value })} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Destination</Label>
                            <Input value={newRateSheet.destination} onChange={e => setNewRateSheet({ ...newRateSheet, destination: e.target.value })} className="h-11" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Distance (km)</Label>
                            <Input type="number" value={newRateSheet.distance_km} onChange={e => setNewRateSheet({ ...newRateSheet, distance_km: parseInt(e.target.value) || 0 })} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">20ft Rate</Label>
                            <Input type="number" value={newRateSheet.container_20ft} onChange={e => setNewRateSheet({ ...newRateSheet, container_20ft: Number(e.target.value) || 0 })} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">40ft Rate</Label>
                            <Input type="number" value={newRateSheet.container_40ft} onChange={e => setNewRateSheet({ ...newRateSheet, container_40ft: Number(e.target.value) || 0 })} className="h-11" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Loose Rate / MT</Label>
                            <Input type="number" value={newRateSheet.loose_rate_mt} onChange={e => setNewRateSheet({ ...newRateSheet, loose_rate_mt: Number(e.target.value) || 0 })} className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground">Transit Days</Label>
                            <Input type="number" value={newRateSheet.transit_days} onChange={e => setNewRateSheet({ ...newRateSheet, transit_days: Number(e.target.value) || 0 })} className="h-11" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Special Conditions</Label>
                          <Textarea value={newRateSheet.special_conditions} onChange={e => setNewRateSheet({ ...newRateSheet, special_conditions: e.target.value })} rows={3} className="min-h-[80px]" />
                        </div>
                      </div>
                      <DialogFooter className="pt-6">
                        <Button variant="outline" onClick={() => {
                          setShowRateSheetDialog(false);
                          setEditingRateSheet(null);
                          resetRateSheetForm();
                        }} className="h-11 px-6">Cancel</Button>
                        <Button onClick={saveRateSheet} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">{editingRateSheet ? 'Update Rate Sheet' : 'Create Rate Sheet'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* JSONB Rate Sheets (from contract system) */}
              <Card className="shadow-lg border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Freight Rate Sheets
                    <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">{jsonbRateSheets.length}</Badge>
                  </CardTitle>
                  {canCreate && (
                    <Button onClick={() => openFreightSheetDialog()} className="h-10 px-4 gap-2">
                      <Plus className="h-4 w-4" /> New Freight Rate Sheet
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {jsonbRateSheets.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No freight rate sheets yet. {canCreate && 'Create one to get started.'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {jsonbRateSheets.map(rs => (
                        <div key={rs.id} className="border border-border rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between p-4 bg-muted/50">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setViewingRateSheet(viewingRateSheet?.id === rs.id ? null : rs)}
                            >
                              <h3 className="font-semibold text-sm text-foreground">{rs.rate_sheet_name}</h3>
                              <p className="text-xs text-muted-foreground">
                                Effective: {rs.effective_date ? new Date(rs.effective_date).toLocaleDateString() : '—'} · {rs.currency} · {rs.rates?.length || 0} routes
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge className="bg-success/10 text-success text-xs font-medium mr-1" variant="outline">Active</Badge>
                              {canCreate && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary" onClick={() => openFreightSheetDialog(rs)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => deleteFreightRateSheet(rs.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setViewingRateSheet(viewingRateSheet?.id === rs.id ? null : rs)}
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          {viewingRateSheet?.id === rs.id && (
                            <div className="p-4 border-t border-border">
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
                                        <TableCell className="text-sm text-foreground">{rate.from}</TableCell>
                                        <TableCell className="text-sm font-medium text-foreground">{rate.destination}</TableCell>
                                        <TableCell className="text-right text-sm text-foreground">{rate.container_20ft?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-sm text-foreground">{rate.container_40ft?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-sm text-foreground">{rate.loose?.toLocaleString()}</TableCell>
                                        <TableCell className="text-center text-sm text-foreground">{rate.truck_type}</TableCell>
                                        <TableCell className="text-center text-sm text-foreground">{rate.transit_days}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {rs.special_conditions && (
                                <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded text-xs text-warning">
                                  <strong>Note:</strong> {rs.special_conditions}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                <Dialog open={showFreightSheetDialog} onOpenChange={(open) => {
                  if (!open) {
                    setEditingFreightSheet(null);
                    resetFreightSheetForm();
                  }
                  setShowFreightSheetDialog(open);
                }}>
                  <DialogContent className="max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">{editingFreightSheet ? 'Edit Freight Rate Sheet' : 'New Freight Rate Sheet'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-2 space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Rate Sheet Name</Label>
                          <Input value={freightSheetForm.rate_sheet_name} onChange={e => setFreightSheetForm({ ...freightSheetForm, rate_sheet_name: e.target.value })} placeholder="e.g., 2026 Regional Transport Rates" className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Currency</Label>
                          <Select value={freightSheetForm.currency} onValueChange={v => setFreightSheetForm({ ...freightSheetForm, currency: v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="TZS">TZS</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="KES">KES</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Effective Date</Label>
                          <Input type="date" value={freightSheetForm.effective_date} onChange={e => setFreightSheetForm({ ...freightSheetForm, effective_date: e.target.value })} className="h-11" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Expiry Date</Label>
                          <Input type="date" value={freightSheetForm.expiry_date} onChange={e => setFreightSheetForm({ ...freightSheetForm, expiry_date: e.target.value })} className="h-11" />
                        </div>
                        <div className="sm:col-span-3 space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Special Conditions</Label>
                          <Input value={freightSheetForm.special_conditions} onChange={e => setFreightSheetForm({ ...freightSheetForm, special_conditions: e.target.value })} placeholder="Optional note shown with this rate sheet" className="h-11" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-foreground">Routes</Label>
                          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addFreightRateRow}>
                            <Plus className="h-3.5 w-3.5" /> Add Route
                          </Button>
                        </div>
                        {freightSheetForm.rates.length === 0 ? (
                          <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                            No routes yet. Click "Add Route" to add one.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>From</TableHead>
                                  <TableHead>Destination</TableHead>
                                  <TableHead className="text-right">20ft</TableHead>
                                  <TableHead className="text-right">40ft</TableHead>
                                  <TableHead className="text-right">Loose</TableHead>
                                  <TableHead>Truck</TableHead>
                                  <TableHead className="text-right">Days</TableHead>
                                  <TableHead className="w-10"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {freightSheetForm.rates.map((rate, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="p-1.5"><Input value={rate.from} onChange={e => updateFreightRateRow(idx, 'from', e.target.value)} placeholder="Dar es Salaam" className="h-9 min-w-[120px]" /></TableCell>
                                    <TableCell className="p-1.5"><Input value={rate.destination} onChange={e => updateFreightRateRow(idx, 'destination', e.target.value)} placeholder="Kigali" className="h-9 min-w-[120px]" /></TableCell>
                                    <TableCell className="p-1.5"><Input type="number" value={rate.container_20ft} onChange={e => updateFreightRateRow(idx, 'container_20ft', Number(e.target.value) || 0)} className="h-9 w-24 text-right" /></TableCell>
                                    <TableCell className="p-1.5"><Input type="number" value={rate.container_40ft} onChange={e => updateFreightRateRow(idx, 'container_40ft', Number(e.target.value) || 0)} className="h-9 w-24 text-right" /></TableCell>
                                    <TableCell className="p-1.5"><Input type="number" value={rate.loose} onChange={e => updateFreightRateRow(idx, 'loose', Number(e.target.value) || 0)} className="h-9 w-24 text-right" /></TableCell>
                                    <TableCell className="p-1.5"><Input value={rate.truck_type} onChange={e => updateFreightRateRow(idx, 'truck_type', e.target.value)} placeholder="C28" className="h-9 w-20" /></TableCell>
                                    <TableCell className="p-1.5"><Input type="number" value={rate.transit_days} onChange={e => updateFreightRateRow(idx, 'transit_days', Number(e.target.value) || 0)} className="h-9 w-16 text-right" /></TableCell>
                                    <TableCell className="p-1.5">
                                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeFreightRateRow(idx)}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter className="pt-6">
                      <Button variant="outline" onClick={() => {
                        setShowFreightSheetDialog(false);
                        setEditingFreightSheet(null);
                        resetFreightSheetForm();
                      }} className="h-11 px-6">Cancel</Button>
                      <Button onClick={saveFreightRateSheet} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">{editingFreightSheet ? 'Update Rate Sheet' : 'Create Rate Sheet'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>

              {/* Legacy flat rate sheets */}
              {rateSheets.length > 0 && (
                <Card className="shadow-lg border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
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
                            <TableRow key={r.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium text-foreground">{r.route_name}</TableCell>
                              <TableCell className="capitalize text-foreground">{String(r.service_type || "").replace('_', ' ')}</TableCell>
                              <TableCell className="text-muted-foreground">{r.distance_km} km</TableCell>
                              <TableCell className="text-foreground">{r.container_20ft ? r.container_20ft.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-foreground">{r.container_40ft ? r.container_40ft.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-foreground">{r.loose_rate_mt ? r.loose_rate_mt.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-foreground">{r.transit_days}</TableCell>
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
                                        is_active: true,
                                      });
                                      setShowRateSheetDialog(true);
                                    }} className="hover:bg-primary/10 hover:text-primary">
                                      Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={async () => {
                                      if (confirm('Are you sure you want to delete this rate sheet?')) {
                                        try {
                                          const { error } = await supabase
                                            .from('rate_sheets')
                                            .update({ is_active: false })
                                            .eq('id', r.id);

                                          if (error) throw error;

                                          toast({ title: 'Success', description: 'Rate sheet deleted successfully' });
                                          fetchRateSheets();
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
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sales Pipeline
                </CardTitle>
                {canCreate && (
                  <Dialog open={showOpportunityDialog} onOpenChange={setShowOpportunityDialog}>
                    <DialogTrigger asChild>
                      <Button className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow"><Plus className="h-4 w-4 mr-2" /> Add Opportunity</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">Add Sales Opportunity</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Customer</Label>
                          <Select value={opportunityForm.customer_id} onValueChange={v => setOpportunityForm({ ...opportunityForm, customer_id: v })}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Select customer" /></SelectTrigger>
                            <SelectContent>
                              {customers.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Opportunity Name</Label>
                          <Input value={opportunityForm.opportunity_name} onChange={e => setOpportunityForm({ ...opportunityForm, opportunity_name: e.target.value })} placeholder="e.g., Q1 Logistics Contract" className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Service Type</Label>
                          <Select value={opportunityForm.service_type} onValueChange={v => setOpportunityForm({ ...opportunityForm, service_type: v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Monthly Revenue (TZS)</Label>
                          <Input type="number" value={opportunityForm.estimated_monthly_revenue} onChange={e => setOpportunityForm({ ...opportunityForm, estimated_monthly_revenue: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Probability (%)</Label>
                          <Input type="number" min="0" max="100" value={opportunityForm.probability} onChange={e => setOpportunityForm({ ...opportunityForm, probability: parseInt(e.target.value) || 0 })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Stage</Label>
                          <Select value={opportunityForm.stage} onValueChange={v => setOpportunityForm({ ...opportunityForm, stage: v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                          <Label className="text-sm font-semibold text-foreground">Expected Close Date</Label>
                          <Input type="date" value={opportunityForm.expected_close_date} onChange={e => setOpportunityForm({ ...opportunityForm, expected_close_date: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Competitor</Label>
                          <Input value={opportunityForm.competitor} onChange={e => setOpportunityForm({ ...opportunityForm, competitor: e.target.value })} placeholder="Who are we competing with?" className="h-11" />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label className="text-sm font-semibold text-foreground">Notes</Label>
                          <Textarea value={opportunityForm.notes} onChange={e => setOpportunityForm({ ...opportunityForm, notes: e.target.value })} className="min-h-[80px]" />
                        </div>
                      </div>
                      <DialogFooter className="pt-6">
                        <Button variant="outline" onClick={() => setShowOpportunityDialog(false)} className="h-11 px-6">Cancel</Button>
                        <Button onClick={saveOpportunity} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">Save Opportunity</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-4 items-start min-w-max">
                    {PIPELINE_STAGES.map(({ value, label }) => {
                      const stageDeals = opportunities.filter(o => o.stage === value);
                      const stageValue = stageDeals.reduce((sum, o) => sum + (o.estimated_monthly_revenue || 0), 0);
                      return (
                        <div key={value} className="w-[280px] shrink-0 flex flex-col">
                          <div className="flex items-center justify-between border-b-2 border-border pb-2 mb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              {label}
                              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                            </h3>
                            <span className="text-xs font-medium text-muted-foreground">
                              TZS {stageValue >= 1_000_000 ? `${(stageValue / 1_000_000).toFixed(1)}M` : stageValue.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            {stageDeals.map(o => (
                              <Card key={o.id} className="cv-surface hover:border-primary/40 hover:shadow-md transition-all cursor-default">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-foreground text-sm leading-snug">{o.company_name || o.opportunity_name}</p>
                                  </div>
                                  {o.expected_close_date && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <CalendarDays className="h-3.5 w-3.5" />
                                      Close: {format(new Date(o.expected_close_date), 'MMM dd')}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between pt-1">
                                    <Badge variant="outline" className={`${getStageColor(o.stage)} text-white border-0 text-[11px]`}>
                                      {o.probability}%
                                    </Badge>
                                    <span className="text-sm font-semibold text-primary">
                                      TZS {(o.estimated_monthly_revenue || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            {stageDeals.length === 0 && (
                              <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                                No deals
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
      <div className="flex min-h-screen bg-background">
        <Sidebar role="OPERATOR" />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    }>
      <SalesModuleContent />
    </Suspense>
  );
}
