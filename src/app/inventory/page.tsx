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
import { Badge } from '@/components/ui/badge';
import { Package, Plus, AlertCircle } from 'lucide-react';

export default function InventoryPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInventory = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error loading inventory:', error);
        } else {
          setInventory(data || []);
        }
      } catch (error) {
        console.log('Inventory loading error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInventory();
  }, [user]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.currentTarget);
      const itemData = {
        item_name: formData.get('name') as string,
        quantity_available: parseInt(formData.get('quantity') as string),
        unit: formData.get('unit') as string,
        category: formData.get('category') as string,
        min_stock_level: 10, // Default minimum stock
        created_by: user?.id
      };
      
      const { error } = await supabase
        .from('inventory')
        .insert(itemData);
        
      if (error) {
        console.log('Add item error - skipping:', error);
        return;
      }
      
      // Refresh inventory
      const { data: refreshedData, error: refreshError } = await supabase
        .from('inventory')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      if (!refreshError && refreshedData) {
        setInventory(refreshedData);
      }
      
      e.currentTarget.reset();
      console.log('Inventory item added successfully');
    } catch (error) {
        console.log('Refresh inventory error - skipping:', error);
      }
  };

  if (!['CEO', 'OPERATOR', 'MECHANIC'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Warehouse Inventory</h1>
            <p className="text-muted-foreground text-sm">Manage spare parts and logistics consumables.</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Plus className="size-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Stock Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input id="name" name="name" placeholder="Heavy Duty Engine Oil" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Initial Quantity</Label>
                    <Input id="quantity" name="quantity" type="number" placeholder="50" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit (e.g., L, pcs)</Label>
                    <Input id="unit" name="unit" placeholder="Liters" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" placeholder="Consumables" required />
                </div>
                <Button type="submit" className="w-full">Update Inventory</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Reorder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading inventory...</TableCell></TableRow>
              ) : inventory?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Warehouse is empty.</TableCell></TableRow>
              ) : inventory?.map((item) => (
                <TableRow key={item.id}>
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <Package className="size-5 text-muted-foreground" />
                    {item.item_name}
                  </td>
                  <td>{item.category || 'Uncategorized'}</td>
                  <td>
                    <span className="font-bold">{item.quantity_available}</span> {item.unit}
                  </td>
                  <td>
                    <Badge className={item.quantity_available <= item.min_stock_level ? 'bg-rose-500' : 'bg-emerald-500'}>
                      {item.quantity_available <= item.min_stock_level ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  </td>
                  <td className="text-right px-6">
                    {item.quantity_available <= item.min_stock_level && <AlertCircle className="size-4 text-rose-500 inline" />}
                  </td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
