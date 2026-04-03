"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Trash2, Fuel, Check, X } from 'lucide-react';

interface FuelApproval {
  id: string;
  vehicle_id: string;
  driver_name: string;
  amount: number;
  liters: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_by?: string;
  station_name?: string;
}

interface Vehicle {
  id: string;
  name: string;
  plate_number: string;
}

export default function FuelApprovalsPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [approvals, setApprovals] = useState<FuelApproval[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_name: '',
    amount: '',
    liters: '',
    station_name: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data: approvalsData } = await supabase
        .from('fuel_approvals')
        .select('*')
        .order('created_at', { ascending: false });
      
      setApprovals(approvalsData || []);

      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, name, plate_number')
        .eq('status', 'active');
      
      setVehicles(vehiclesData || []);
    } catch (error) {
      console.error('Error loading fuel approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newApproval = {
        vehicle_id: formData.vehicle_id,
        driver_name: formData.driver_name,
        amount: parseFloat(formData.amount),
        liters: parseFloat(formData.liters),
        station_name: formData.station_name,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('fuel_approvals')
        .insert([newApproval]);

      if (error) throw error;

      setFormData({ vehicle_id: '', driver_name: '', amount: '', liters: '', station_name: '' });
      setIsAddDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error adding fuel approval:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('fuel_approvals')
        .update({ 
          status, 
          approved_by: user?.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating fuel approval:', error);
    }
  };

  const handleDeleteApproval = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fuel approval?')) return;
    
    try {
      const { error } = await supabase
        .from('fuel_approvals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting fuel approval:', error);
    }
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.name} (${vehicle.plate_number})` : vehicleId;
  };

  const filteredApprovals = approvals.filter(a =>
    a.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getVehicleName(a.vehicle_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageApprovals = role === 'ADMIN' || role === 'ACCOUNTANT';
  const canApprove = role === 'ADMIN' || role === 'ACCOUNTANT';

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Fuel Approvals</h1>
            <p className="text-muted-foreground text-sm">Manage fuel requests and approvals.</p>
          </div>

          {canManageApprovals && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2">
                  <Plus className="size-4" /> Request Fuel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Fuel Request</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddApproval} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Vehicle</Label>
                    <Select 
                      value={formData.vehicle_id} 
                      onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} ({vehicle.plate_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver">Driver Name</Label>
                    <Input 
                      id="driver" 
                      placeholder="Driver name"
                      value={formData.driver_name}
                      onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="station">Station Name</Label>
                    <Input 
                      id="station" 
                      placeholder="Fuel station name"
                      value={formData.station_name}
                      onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="liters">Liters</Label>
                      <Input 
                        id="liters" 
                        type="number" 
                        step="0.1"
                        placeholder="0.0"
                        value={formData.liters}
                        onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input 
                        id="amount" 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required 
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Submit Request</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search fuel approvals..." 
                className="pl-9 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Liters</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {canManageApprovals && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManageApprovals ? 8 : 7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageApprovals ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No fuel approvals found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredApprovals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell className="font-medium">{getVehicleName(approval.vehicle_id)}</TableCell>
                    <TableCell>{approval.driver_name}</TableCell>
                    <TableCell>{approval.station_name || '-'}</TableCell>
                    <TableCell>{approval.liters} L</TableCell>
                    <TableCell>${approval.amount?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={approval.status === 'approved' ? 'default' : 
                                approval.status === 'rejected' ? 'destructive' : 'secondary'}
                      >
                        {approval.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManageApprovals && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApprove && approval.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(approval.id, 'approved')}
                                className="text-green-500 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(approval.id, 'rejected')}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteApproval(approval.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

