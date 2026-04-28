"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/navigation/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Plus, Search, Phone, Mail, MapPin, FileText, DollarSign, TrendingUp, Briefcase, Route, CalendarDays } from 'lucide-react';

interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  credit_limit: number;
  payment_terms: string;
  status: string;
  notes: string;
  created_at: string;
}

interface CustomerStats {
  total_quotations: number;
  total_contracts: number;
  total_revenue: number;
  outstanding_balance: number;
}

export default function CustomersPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [activeTab, setActiveTab] = useState('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [customerForm, setCustomerForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Tanzania',
    tax_id: '',
    credit_limit: '',
    payment_terms: '30 days',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
        country: 'Tanzania',
        tax_id: '',
        credit_limit: '',
        payment_terms: '30 days',
        notes: ''
      });
      loadCustomers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      blacklisted: 'bg-red-100 text-red-700'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const filteredCustomers = customers.filter(c => 
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalCreditLimit = customers.reduce((sum, c) => sum + (c.credit_limit || 0), 0);

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">Manage your customer database</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Customers</p>
                    <p className="text-2xl font-bold">{totalCustomers}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Customers</p>
                    <p className="text-2xl font-bold">{activeCustomers}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Credit Limit</p>
                    <p className="text-2xl font-bold">Tsh {totalCreditLimit.toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Customer List</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search customers..." 
                    className="pl-10 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
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
                          onChange={(e) => setCustomerForm({...customerForm, company_name: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input 
                          value={customerForm.contact_person} 
                          onChange={(e) => setCustomerForm({...customerForm, contact_person: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={customerForm.phone} onChange={(e) => setCustomerForm({...customerForm, phone: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Textarea value={customerForm.address} onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={customerForm.city} onChange={(e) => setCustomerForm({...customerForm, city: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax ID (TIN)</Label>
                        <Input value={customerForm.tax_id} onChange={(e) => setCustomerForm({...customerForm, tax_id: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Credit Limit (Tsh)</Label>
                        <Input type="number" value={customerForm.credit_limit} onChange={(e) => setCustomerForm({...customerForm, credit_limit: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Terms</Label>
                        <Select value={customerForm.payment_terms} onValueChange={(v) => setCustomerForm({...customerForm, payment_terms: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Textarea value={customerForm.notes} onChange={(e) => setCustomerForm({...customerForm, notes: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Customer</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
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
                  {filteredCustomers.map((customer) => (
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
                      <TableCell>{getStatusBadge(customer.status)}</TableCell>
                      <TableCell>Tsh {customer.credit_limit?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm">View</Button>
                          <Button variant="ghost" size="sm" onClick={() => window.location.href = `/trips?customer=${customer.id}&name=${encodeURIComponent(customer.company_name)}`}>
                            <Route className="size-3 mr-1" />
                            Trip
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => window.location.href = `/bookings?customer=${customer.id}&name=${encodeURIComponent(customer.company_name)}&email=${encodeURIComponent(customer.email)}&phone=${encodeURIComponent(customer.phone)}`}>
                            <CalendarDays className="size-3 mr-1" />
                            Booking
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => window.location.href = `/sales?customer=${customer.id}`}>
                            <FileText className="size-3 mr-1" />
                            Quote
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
