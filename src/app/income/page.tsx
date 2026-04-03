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
import { Plus, Search, Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface Income {
  id: string;
  source: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  created_at: string;
}

export default function IncomePage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [income, setIncome] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    category: 'trip',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data: incomeData } = await supabase
        .from('income')
        .select('*')
        .order('date', { ascending: false });
      
      setIncome(incomeData || []);
    } catch (error) {
      console.error('Error loading income:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newIncome = {
        source: formData.source,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        description: formData.description,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('income')
        .insert([newIncome]);

      if (error) throw error;

      setFormData({ 
        source: '', 
        amount: '', 
        category: 'trip', 
        date: new Date().toISOString().split('T')[0], 
        description: '' 
      });
      setIsAddDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error adding income:', error);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income record?')) return;
    
    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting income:', error);
    }
  };

  const filteredIncome = income.filter(i =>
    i.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalIncome = income.reduce((sum, i) => sum + (i.amount || 0), 0);
  const monthlyIncome = income
    .filter(i => new Date(i.date).getMonth() === new Date().getMonth())
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  const canManageIncome = role === 'ADMIN' || role === 'ACCOUNTANT';

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Income</h1>
            <p className="text-muted-foreground text-sm">Track revenue and income sources.</p>
          </div>

          {canManageIncome && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2">
                  <Plus className="size-4" /> Add Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Income</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddIncome} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input 
                      id="source" 
                      placeholder="e.g., Trip Payment, Client Name"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trip">Trip Payment</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
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
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      id="date" 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input 
                      id="description" 
                      placeholder="Additional details"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full">Add Income</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-muted-foreground text-sm">Total Income</span>
            </div>
            <div className="text-2xl font-bold">${totalIncome.toFixed(2)}</div>
          </div>
          <div className="bg-card rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-muted-foreground text-sm">This Month</span>
            </div>
            <div className="text-2xl font-bold">${monthlyIncome.toFixed(2)}</div>
          </div>
          <div className="bg-card rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-muted-foreground text-sm">Records</span>
            </div>
            <div className="text-2xl font-bold">{income.length}</div>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search income records..." 
                className="pl-9 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                {canManageIncome && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManageIncome ? 6 : 5} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredIncome.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageIncome ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No income records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncome.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.source}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      +${item.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(item.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {item.description || '-'}
                    </TableCell>
                    {canManageIncome && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIncome(item.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

