"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, AlertCircle } from 'lucide-react';

export default function InventoryPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'inventory_items');
  }, [firestore]);

  const { data: inventory, isLoading } = useCollection(inventoryQuery);

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemData = {
      itemName: formData.get('name') as string,
      category: formData.get('category') as string,
      quantityAvailable: Number(formData.get('quantity')),
      quantityUsed: 0,
      unit: formData.get('unit') as string,
      reorderLevel: 5,
      status: 'In Stock',
      createdAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(collection(firestore, 'inventory_items'), itemData);
    e.currentTarget.reset();
  };

  if (!['CEO', 'OPERATIONS', 'MECHANIC'].includes(role || '')) return <div className="p-8">Access Denied</div>;

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
                    {item.itemName}
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <span className="font-bold">{item.quantityAvailable}</span> {item.unit}
                  </td>
                  <td>
                    <Badge className={item.quantityAvailable < 10 ? 'bg-rose-500' : 'bg-emerald-500'}>
                      {item.quantityAvailable < 10 ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  </td>
                  <td className="text-right px-6">
                    {item.quantityAvailable < 10 && <AlertCircle className="size-4 text-rose-500 inline" />}
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
