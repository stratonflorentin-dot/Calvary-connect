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
import { Truck, Plus, Search, Building2, ShieldAlert, CheckCircle2, ShoppingCart } from 'lucide-react';

interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  vrn: string;
  payment_terms: string;
  status: 'active' | 'inactive' | 'blacklisted';
  notes: string;
  created_at: string;
}

export default function SuppliersPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [loading, setLoading] = useState(true);

  const emptyForm = {
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Tanzania',
    tax_id: '',
    vrn: '',
    payment_terms: '30 days',
    status: 'active' as Supplier['status'],
    notes: '',
  };
  const [supplierForm, setSupplierForm] = useState(emptyForm);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('suppliers').insert({
        ...supplierForm,
        created_by: user?.id,
      }).select().single();

      if (error) throw error;

      toast({ title: 'Success', description: `Supplier ${data.supplier_code} created` });
      setShowAddSupplier(false);
      setSupplierForm(emptyForm);
      loadSuppliers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      blacklisted: 'bg-destructive/10 text-destructive',
    };
    return <Badge className={styles[status] || 'bg-muted text-muted-foreground'}>{status}</Badge>;
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.supplier_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const blacklistedSuppliers = suppliers.filter(s => s.status === 'blacklisted').length;

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold">Suppliers</h1>
              <p className="text-muted-foreground">Manage your vendor database</p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/purchase-orders'}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Purchase Orders
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Suppliers</p>
                    <p className="text-2xl font-bold">{totalSuppliers}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Suppliers</p>
                    <p className="text-2xl font-bold">{activeSuppliers}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Blacklisted</p>
                    <p className="text-2xl font-bold">{blacklistedSuppliers}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <ShieldAlert className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <CardTitle>Supplier List</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers..."
                    className="pl-10 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Add Supplier</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Supplier</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSupplier} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name *</Label>
                        <Input
                          value={supplierForm.company_name}
                          onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input
                          value={supplierForm.contact_person}
                          onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Textarea value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax ID (TIN)</Label>
                        <Input value={supplierForm.tax_id} onChange={(e) => setSupplierForm({ ...supplierForm, tax_id: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>VRN</Label>
                        <Input value={supplierForm.vrn} onChange={(e) => setSupplierForm({ ...supplierForm, vrn: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Payment Terms</Label>
                        <Select value={supplierForm.payment_terms} onValueChange={(v) => setSupplierForm({ ...supplierForm, payment_terms: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15 days">15 days</SelectItem>
                            <SelectItem value="30 days">30 days</SelectItem>
                            <SelectItem value="45 days">45 days</SelectItem>
                            <SelectItem value="60 days">60 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={supplierForm.status} onValueChange={(v) => setSupplierForm({ ...supplierForm, status: v as Supplier['status'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="blacklisted">Blacklisted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Supplier</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && filteredSuppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No suppliers yet — add your first one.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplier_code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{supplier.company_name}</p>
                          <p className="text-sm text-muted-foreground">{supplier.city}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{supplier.contact_person}</p>
                          <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>{supplier.payment_terms}</TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.location.href = `/purchase-orders?supplier=${supplier.id}&name=${encodeURIComponent(supplier.company_name)}`}
                        >
                          <ShoppingCart className="size-3 mr-1" />
                          New PO
                        </Button>
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
