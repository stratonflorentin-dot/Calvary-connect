"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { TransitionButtons } from '@/components/workflow/transition-buttons';
import { AuditTrailService } from '@/services/audit-trail-service';
import { formatCurrency } from '@/components/ui/currency-badge';
import { ShoppingCart, Plus, Search, Trash2, PackageCheck, FileClock, Send, PackageOpen, XCircle } from 'lucide-react';

interface Supplier {
  id: string;
  company_name: string;
  status: string;
}

interface SparePart {
  id: string;
  name: string;
}

type POStatus = 'draft' | 'sent_to_supplier' | 'partially_received' | 'fully_received' | 'cancelled';

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: POStatus;
  vat_type: 'STANDARD_18' | 'ZERO_RATED';
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  expected_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: { company_name: string } | null;
}

interface POItem {
  id: string;
  purchase_order_id: string;
  spare_part_id: string | null;
  item_description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
}

interface DraftLine {
  key: string;
  spare_part_id: string;
  item_description: string;
  quantity_ordered: string;
  unit_cost: string;
}

const STATUS_META: Record<POStatus, { label: string; icon: React.ElementType; chip: string }> = {
  draft: { label: 'Draft', icon: FileClock, chip: 'bg-muted text-muted-foreground' },
  sent_to_supplier: { label: 'Sent to Supplier', icon: Send, chip: 'bg-info/10 text-info' },
  partially_received: { label: 'Partially Received', icon: PackageOpen, chip: 'bg-warning/10 text-warning' },
  fully_received: { label: 'Fully Received', icon: PackageCheck, chip: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', icon: XCircle, chip: 'bg-destructive/10 text-destructive' },
};

function emptyLine(): DraftLine {
  return { key: crypto.randomUUID(), spare_part_id: '', item_description: '', quantity_ordered: '1', unit_cost: '' };
}

function PurchaseOrdersInner() {
  const { role } = useRole();
  const { user } = useSupabase();
  const searchParams = useSearchParams();
  const presetSupplierId = searchParams.get('supplier');

  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<Record<string, POItem[]>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all');
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [vatType, setVatType] = useState<'STANDARD_18' | 'ZERO_RATED'>('STANDARD_18');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (presetSupplierId) {
      setSupplierId(presetSupplierId);
      setShowCreate(true);
    }
  }, [presetSupplierId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [poRes, supplierRes, partsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, suppliers(company_name)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, company_name, status').eq('status', 'active').order('company_name'),
        supabase.from('spare_parts').select('id, name').order('name'),
      ]);
      if (poRes.error) throw poRes.error;
      setPOs(poRes.data || []);
      setSuppliers(supplierRes.data || []);
      setSpareParts(partsRes.data || []);

      const poIds = (poRes.data || []).map((p: PurchaseOrder) => p.id);
      if (poIds.length > 0) {
        const { data: itemRows } = await supabase.from('purchase_order_items').select('*').in('purchase_order_id', poIds);
        const grouped: Record<string, POItem[]> = {};
        for (const it of itemRows || []) {
          (grouped[it.purchase_order_id] ||= []).push(it);
        }
        setItems(grouped);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key: string) => setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const draftSubtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity_ordered) || 0) * (Number(l.unit_cost) || 0), 0),
    [lines],
  );
  const draftVat = vatType === 'ZERO_RATED' ? 0 : Math.round(draftSubtotal * 0.18);

  const resetCreateForm = () => {
    setSupplierId('');
    setVatType('STANDARD_18');
    setExpectedDelivery('');
    setNotes('');
    setLines([emptyLine()]);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.item_description.trim() && Number(l.quantity_ordered) > 0 && Number(l.unit_cost) >= 0);
    if (!supplierId || validLines.length === 0) {
      toast({ title: 'Missing fields', description: 'Pick a supplier and at least one item with a quantity and cost.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
        supplier_id: supplierId,
        vat_type: vatType,
        expected_delivery_date: expectedDelivery || null,
        notes: notes || null,
        created_by: user?.id,
      }).select().single();
      if (poError) throw poError;

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(
        validLines.map((l) => ({
          purchase_order_id: po.id,
          spare_part_id: l.spare_part_id || null,
          item_description: l.item_description,
          quantity_ordered: Number(l.quantity_ordered),
          unit_cost: Number(l.unit_cost),
        })),
      );
      if (itemsError) throw itemsError;

      await AuditTrailService.logCreate('procurement', 'purchase_order', po.id, po, user?.id, `PO ${po.po_number} created`);

      toast({ title: 'Success', description: `Purchase order ${po.po_number} created` });
      setShowCreate(false);
      resetCreateForm();
      loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openReceive = (po: PurchaseOrder) => {
    const poItems = items[po.id] || [];
    const initial: Record<string, string> = {};
    for (const it of poItems) {
      const remaining = it.quantity_ordered - it.quantity_received;
      initial[it.id] = remaining > 0 ? String(remaining) : '0';
    }
    setReceiveQty(initial);
    setReceiving(po);
  };

  const handleReceive = async () => {
    if (!receiving) return;
    const receipts = Object.entries(receiveQty)
      .map(([po_item_id, qty]) => ({ po_item_id, quantity_received: Number(qty) || 0 }))
      .filter((r) => r.quantity_received > 0);
    if (receipts.length === 0) {
      toast({ title: 'Nothing to receive', description: 'Enter a quantity for at least one item.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.rpc('receive_purchase_order_items', {
        p_po_id: receiving.id,
        p_receipts: receipts,
      });
      if (error) throw error;

      await AuditTrailService.logUpdate('procurement', 'purchase_order', receiving.id, null, { receipts }, user?.id, `Received items against ${receiving.po_number}`);

      toast({ title: 'Received', description: `Stock updated for ${receiving.po_number}.` });
      setReceiving(null);
      loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filtered = pos.filter((po) => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return po.po_number?.toLowerCase().includes(q) || po.suppliers?.company_name?.toLowerCase().includes(q);
  });

  const counts = pos.reduce(
    (acc, po) => {
      acc[po.status] = (acc[po.status] || 0) + 1;
      return acc;
    },
    {} as Record<POStatus, number>,
  );

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">Order, send, and receive stock from suppliers</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(STATUS_META) as POStatus[]).map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.icon;
              return (
                <Card key={s} className="cursor-pointer" onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{meta.label}</p>
                        <p className="text-xl font-bold">{counts[s] || 0}</p>
                      </div>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <CardTitle>Orders</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search PO # or supplier..."
                    className="pl-10 w-full sm:w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetCreateForm(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> New Purchase Order</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New Purchase Order</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreatePO} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Supplier *</Label>
                        <Select value={supplierId} onValueChange={setSupplierId}>
                          <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Delivery</Label>
                        <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>VAT Treatment</Label>
                      <Select value={vatType} onValueChange={(v) => setVatType(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD_18">Standard 18%</SelectItem>
                          <SelectItem value="ZERO_RATED">Zero Rated 0%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Items</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addLine}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {lines.map((line) => (
                          <div key={line.key} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-2">
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">Stock item (optional)</Label>
                              <Select
                                value={line.spare_part_id || '__none'}
                                onValueChange={(v) => {
                                  const part = spareParts.find((p) => p.id === v);
                                  updateLine(line.key, {
                                    spare_part_id: v === '__none' ? '' : v,
                                    item_description: part ? part.name : line.item_description,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Not stocked" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">Not in inventory</SelectItem>
                                  {spareParts.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">Description</Label>
                              <Input
                                className="h-8 text-sm"
                                value={line.item_description}
                                onChange={(e) => updateLine(line.key, { item_description: e.target.value })}
                                placeholder="What's being ordered"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Qty</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                min="0"
                                value={line.quantity_ordered}
                                onChange={(e) => updateLine(line.key, { quantity_ordered: e.target.value })}
                              />
                            </div>
                            <div className="col-span-1 space-y-1">
                              <Label className="text-xs">Unit Cost</Label>
                              <Input
                                className="h-8 text-sm"
                                type="number"
                                min="0"
                                value={line.unit_cost}
                                onChange={(e) => updateLine(line.key, { unit_cost: e.target.value })}
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => removeLine(line.key)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end text-sm space-y-1 flex-col items-end border-t border-border pt-3">
                      <div className="flex gap-4"><span className="text-muted-foreground">Subtotal</span><span className="font-medium tabular-nums">{formatCurrency(draftSubtotal, 'TZS')}</span></div>
                      <div className="flex gap-4"><span className="text-muted-foreground">VAT</span><span className="font-medium tabular-nums">{formatCurrency(draftVat, 'TZS')}</span></div>
                      <div className="flex gap-4 font-semibold"><span>Total</span><span className="tabular-nums">{formatCurrency(draftSubtotal + draftVat, 'TZS')}</span></div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Create Purchase Order'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No purchase orders match.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((po) => {
                    const poItems = items[po.id] || [];
                    const meta = STATUS_META[po.status];
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>{po.suppliers?.company_name || '—'}</TableCell>
                        <TableCell><Badge className={meta.chip}>{meta.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {poItems.length} item{poItems.length !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(po.total_amount, po.currency)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 items-center">
                            {(po.status === 'sent_to_supplier' || po.status === 'partially_received') && (
                              <Button variant="ghost" size="sm" onClick={() => openReceive(po)}>
                                <PackageOpen className="size-3 mr-1" />
                                Receive
                              </Button>
                            )}
                            {user?.id && (
                              <TransitionButtons
                                kind="purchase_order"
                                entity={po}
                                actorId={user.id}
                                actorRole={role}
                                size="sm"
                                onDone={loadAll}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!receiving} onOpenChange={(open) => !open && setReceiving(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive — {receiving?.po_number}</DialogTitle>
          </DialogHeader>
          {receiving && (
            <div className="space-y-3 pt-2">
              {(items[receiving.id] || []).map((it) => {
                const remaining = it.quantity_ordered - it.quantity_received;
                return (
                  <div key={it.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{it.item_description}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.quantity_received} of {it.quantity_ordered} received
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={remaining}
                      className="w-24 h-8"
                      value={receiveQty[it.id] ?? ''}
                      disabled={remaining <= 0}
                      onChange={(e) => setReceiveQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setReceiving(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleReceive}>Confirm Receipt</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersInner />
    </Suspense>
  );
}
