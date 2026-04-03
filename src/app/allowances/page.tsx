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
import { Plus, Search, Trash2 } from 'lucide-react';

interface Allowance {
  id: string;
  employee_name: string;
  employee_role: string;
  amount: number;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_by?: string;
}

export default function AllowancesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    employee_name: '',
    employee_role: '',
    amount: '',
    type: 'transport',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data: allowancesData } = await supabase
        .from('allowances')
        .select('*')
        .order('created_at', { ascending: false });
      
      setAllowances(allowancesData || []);

      const { data: employeesData } = await supabase
        .from('user_profiles')
        .select('id, name, role')
        .eq('status', 'active');
      
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error loading allowances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newAllowance = {
        employee_name: formData.employee_name,
        employee_role: formData.employee_role,
        amount: parseFloat(formData.amount),
        type: formData.type,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('allowances')
        .insert([newAllowance]);

      if (error) throw error;

      setFormData({ employee_name: '', employee_role: '', amount: '', type: 'transport' });
      setIsAddDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error adding allowance:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('allowances')
        .update({ 
          status, 
          approved_by: user?.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating allowance:', error);
    }
  };

  const handleDeleteAllowance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allowance?')) return;
    
    try {
      const { error } = await supabase
        .from('allowances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting allowance:', error);
    }
  };

  const filteredAllowances = allowances.filter(a =>
    a.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageAllowances = role === 'ADMIN' || role === 'HR';
  const canApprove = role === 'ADMIN' || role === 'HR';

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Allowances</h1>
            <p className="text-muted-foreground text-sm">Manage employee allowances and benefits.</p>
          </div>

          {canManageAllowances && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2">
                  <Plus className="size-4" /> Add Allowance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Allowance</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddAllowance} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee">Employee Name</Label>
                    <Select 
                      value={formData.employee_name} 
                      onValueChange={(value) => {
                        const emp = employees.find(e => e.name === value);
                        setFormData({ 
                          ...formData, 
                          employee_name: value,
                          employee_role: emp?.role || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.name}>
                            {emp.name} ({emp.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Allowance Type</Label>
                    <Select 
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="meal">Meal</SelectItem>
                        <SelectItem value="overtime">Overtime</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Button type="submit" className="w-full">Submit Allowance</Button>
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
                placeholder="Search allowances..." 
                className="pl-9 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {canManageAllowances && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManageAllowances ? 6 : 5} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAllowances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageAllowances ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No allowances found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAllowances.map((allowance) => (
                  <TableRow key={allowance.id}>
                    <TableCell>
                      <div className="font-medium">{allowance.employee_name}</div>
                      <div className="text-xs text-muted-foreground">{allowance.employee_role}</div>
                    </TableCell>
                    <TableCell className="capitalize">{allowance.type}</TableCell>
                    <TableCell>${allowance.amount?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={allowance.status === 'approved' ? 'default' : 
                                allowance.status === 'rejected' ? 'destructive' : 'secondary'}
                      >
                        {allowance.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(allowance.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManageAllowances && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApprove && allowance.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(allowance.id, 'approved')}
                                className="text-green-500 hover:text-green-700 hover:bg-green-50"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(allowance.id, 'rejected')}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAllowance(allowance.id)}
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

