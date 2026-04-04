
"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { SupabaseService } from '@/services/supabase-service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Package, Plus, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

export default function MechanicSparePartsPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();
  const { t } = useLanguage();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadParts = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load real spare parts requests from Supabase
        const { data: requests, error } = await supabase
          .from('parts_requests')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setParts(requests || []);
      } catch (error) {
        console.error('Error loading spare parts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadParts();
  }, [user]);

  const handleAddPart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const { error } = await supabase
        .from('spare_parts')
        .insert({
          name: formData.get('name'),
          category: formData.get('category'),
          quantity_available: parseInt(formData.get('quantity') as string),
          unit: formData.get('unit'),
          status: 'in_stock'
        });
      
      if (error) throw error;
      
      // Reload parts list
      const { data: updatedParts } = await supabase
        .from('spare_parts')
        .select('*')
        .order('created_at', { ascending: false });
      
      setParts(updatedParts || []);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Error adding part:', error);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    try {
      await SupabaseService.createPartsRequest({
        partNameText: formData.get('name') as string,
        quantityNeeded: Number(formData.get('quantity')),
        urgency: formData.get('urgency') as string,
        reasonNotes: formData.get('reason') as string,
        status: 'pending',
        mechanicId: user.id
      } as any);
      
      // Reload parts requests list
      const { data: updatedRequests } = await supabase
        .from('parts_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      setParts(updatedRequests || []);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Error requesting part:', error);
    }
  };

  if (role && role !== 'MECHANIC') return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">{t.my_requests}</h1>
            <p className="text-muted-foreground text-sm font-sans">Track your requested components and service approvals.</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2 shadow-lg">
                <Plus className="size-4" /> {t.request_parts}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.request_parts}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateRequest} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.part_name}</Label>
                  <Input id="name" name="name" placeholder="E.g. Full Trailer Repaint or Alternator" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">{t.quantity}</Label>
                    <Input id="quantity" name="quantity" type="number" defaultValue="1" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">{t.urgency}</Label>
                    <Select name="urgency" defaultValue="Medium" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High (Immediate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">{t.reason}</Label>
                  <Textarea id="reason" name="reason" placeholder="Explain why this is needed..." required />
                </div>
                <Button type="submit" className="w-full h-12 font-headline">{t.submit_request}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Item/Service</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Sent Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading requests...</TableCell></TableRow>
              ) : parts?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No requests made yet.</TableCell></TableRow>
              ) : parts?.map((r) => (
                <TableRow key={r.id}>
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <Package className="size-4 text-muted-foreground" />
                    {r.requestedPartName}
                  </td>
                  <td>{r.quantityNeeded}</td>
                  <td>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      r.urgency === 'High' ? 'border-rose-200 text-rose-600' : 'text-slate-500'
                    )}>
                      {r.urgency}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {r.status === 'approved' ? <CheckCircle2 className="size-3 text-emerald-500" /> :
                        r.status === 'rejected' ? <XCircle className="size-3 text-rose-500" /> :
                          <Clock className="size-3 text-amber-500" />}
                      <Badge className={cn(
                        "text-[10px]",
                        r.status === 'approved' ? 'bg-emerald-500' :
                          r.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                      )}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </div>
                  </td>
                  <td className="text-right px-6 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
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



