"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Truck, Plus, Search, Phone, Mail, MapPin, Shield, Award, Clock, Globe, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

export function HRView() {
  const { user } = useSupabase();
  const { t } = useLanguage();

  const [employees, setEmployees] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEmployeeDialog, setShowAddEmployeeDialog] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'DRIVER',
    license_number: '',
    license_expiry: '',
    emergency_contact: '',
    emergency_phone: '',
    address: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load all user profiles
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        setEmployees(profilesData || []);

        // Separate drivers
        const driverList = profilesData?.filter(p => p.role === 'DRIVER') || [];
        setDrivers(driverList);

      } catch (error) {
        console.error('Error loading HR data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleAddEmployee = async () => {
    try {
      const { error } = await supabase.from('user_profiles').insert([{
        name: employeeForm.name,
        email: employeeForm.email,
        phone: employeeForm.phone,
        role: employeeForm.role,
        license_number: employeeForm.license_number,
        license_expiry: employeeForm.license_expiry,
        emergency_contact: employeeForm.emergency_contact,
        emergency_phone: employeeForm.emergency_phone,
        address: employeeForm.address,
        status: 'active',
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;

      toast({ title: 'Success', description: 'Employee added successfully!' });
      setShowAddEmployeeDialog(false);
      setEmployeeForm({
        name: '', email: '', phone: '', role: 'DRIVER',
        license_number: '', license_expiry: '', emergency_contact: '',
        emergency_phone: '', address: ''
      });

      // Refresh data
      const { data: profilesData } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
      setEmployees(profilesData || []);
      setDrivers(profilesData?.filter(p => p.role === 'DRIVER') || []);

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'CEO':
        return <Badge className="bg-purple-500/20 text-purple-700">Executive</Badge>;
      case 'ACCOUNTANT':
        return <Badge className="bg-blue-500/20 text-blue-700">Accounting</Badge>;
      case 'DRIVER':
        return <Badge className="bg-green-500/20 text-green-700">Driver</Badge>;
      case 'HR':
        return <Badge className="bg-amber-500/20 text-amber-700">HR</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getLicenseStatus = (expiryDate: string) => {
    if (!expiryDate) return { color: 'text-muted-foreground', text: 'No expiry' };
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return { color: 'text-rose-600', text: 'Expired', badge: 'destructive' };
    } else if (daysUntilExpiry <= 30) {
      return { color: 'text-amber-600', text: `${daysUntilExpiry} days left`, badge: 'warning' };
    } else {
      return { color: 'text-emerald-600', text: 'Valid', badge: 'default' };
    }
  };

  const filteredEmployees = employees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.phone || '').includes(searchTerm)
  );

  const expiringLicenses = drivers.filter(d => {
    if (!d.license_expiry) return false;
    const daysUntilExpiry = Math.ceil((new Date(d.license_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Users className="size-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading HR Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">HR & Personnel</h1>
          <p className="text-muted-foreground text-sm">Driver management and employee records</p>
        </div>
        <Dialog open={showAddEmployeeDialog} onOpenChange={setShowAddEmployeeDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <UserPlus className="size-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={employeeForm.name} onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})} placeholder="John Mwakasege" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})} placeholder="john@calvary.co.tz" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})} placeholder="+255 7XX XXX XXX" />
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={employeeForm.role} onValueChange={(value) => setEmployeeForm({...employeeForm, role: value})}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    <SelectItem value="HR">HR Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {employeeForm.role === 'DRIVER' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>License Number</Label>
                      <Input value={employeeForm.license_number} onChange={(e) => setEmployeeForm({...employeeForm, license_number: e.target.value})} placeholder="DL-XXXXXX" />
                    </div>
                    <div>
                      <Label>License Expiry</Label>
                      <Input type="date" value={employeeForm.license_expiry} onChange={(e) => setEmployeeForm({...employeeForm, license_expiry: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Emergency Contact</Label>
                      <Input value={employeeForm.emergency_contact} onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact: e.target.value})} placeholder="Contact name" />
                    </div>
                    <div>
                      <Label>Emergency Phone</Label>
                      <Input value={employeeForm.emergency_phone} onChange={(e) => setEmployeeForm({...employeeForm, emergency_phone: e.target.value})} placeholder="+255 7XX XXX XXX" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label>Address</Label>
                <Input value={employeeForm.address} onChange={(e) => setEmployeeForm({...employeeForm, address: e.target.value})} placeholder="Dar es Salaam, Tanzania" />
              </div>
              <Button onClick={handleAddEmployee} className="w-full">Add Employee</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Employees</p>
                <p className="text-3xl font-bold">{employees.length}</p>
              </div>
              <Users className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Drivers</p>
                <p className="text-3xl font-bold">{drivers.filter(d => d.status === 'active').length}</p>
              </div>
              <Truck className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">License Expiring</p>
                <p className="text-3xl font-bold">{expiringLicenses.length}</p>
              </div>
              <Clock className="size-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Staff on Trip</p>
                <p className="text-3xl font-bold">{drivers.filter(d => d.is_online).length}</p>
              </div>
              <Globe className="size-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Alerts */}
      {expiringLicenses.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="size-6 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">License Renewal Required</p>
                <p className="text-sm text-amber-600">{expiringLicenses.length} driver(s) need license renewal soon</p>
              </div>
            </div>
            <div className="space-y-2">
              {expiringLicenses.map(d => {
                const status = getLicenseStatus(d.license_expiry);
                return (
                  <div key={d.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-sm text-muted-foreground">License: {d.license_number}</p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-700">{status.text}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Directory */}
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Employee Directory
            </CardTitle>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>License Status</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => {
                const licenseStatus = emp.role === 'DRIVER' ? getLicenseStatus(emp.license_expiry) : null;
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">{emp.name?.charAt(0) || '?'}</span>
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.address || 'No address'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(emp.role)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {emp.phone && (
                          <p className="text-sm flex items-center gap-1">
                            <Phone className="size-3" /> {emp.phone}
                          </p>
                        )}
                        {emp.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="size-3" /> {emp.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {emp.role === 'DRIVER' ? (
                        <div className="space-y-1">
                          <p className="text-sm">{emp.license_number || 'No license'}</p>
                          {licenseStatus && (
                            <Badge variant={licenseStatus.badge as any || 'outline'} className={licenseStatus.color}>
                              {licenseStatus.text}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>
                        {emp.status || 'active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Driver Training & Compliance */}
      <Card className="bg-gradient-to-r from-primary/5 to-amber-500/5 border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                Driver Compliance & Training
              </h3>
              <p className="text-sm text-muted-foreground">East Africa cross-border regulations compliance and safety training</p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-green-500/20 text-green-700">All certified for DRC transit</Badge>
              <Badge className="bg-blue-500/20 text-blue-700">GPS trained</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}