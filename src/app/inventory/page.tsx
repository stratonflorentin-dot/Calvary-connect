"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Package, Plus, AlertCircle, Clock, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { IndustryRoleShell } from '@/components/role-shell/industry-role-shell';
import { IndustryCard, IndustryCardKicker } from '@/components/industry/card';
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from '@/components/industry/table';
import { IndustryTag } from '@/components/industry/tag';
import { IndustryButton } from '@/components/industry/button';
import { IndustryShell } from '@/components/industry/shell';
import {
  IndustryDialog,
  IndustryDialogTrigger,
  IndustryDialogContent,
  IndustryDialogTitle,
} from '@/components/industry/dialog';

const OPERATOR_PAGES = [
  { label: "Dispatch", href: "/dispatch" },
  { label: "Trips register", href: "/trips" },
  { label: "Inventory & parts", href: "/inventory" },
  { label: "Live fleet map", href: "/map" },
];

const fieldClass = "w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]";

type InventoryItem = {
  id?: string;
  item_name?: string;
  category?: string;
  quantity_available?: number;
  unit?: string;
  min_stock_level?: number;
};

interface PartsRequest {
  id: string;
  requested_by: string | null;
  part_name: string;
  quantity_requested: number;
  urgency: string;
  status: string;
  created_at: string;
  vehicle_id: string | null;
  reason: string;
  requester?: { name: string } | null;
}

function InventoryView() {
  const { user } = useSupabase();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [open, setOpen] = useState(false);

  const isLowStock = (item: InventoryItem) => (item.quantity_available ?? 0) <= (item.min_stock_level ?? 0);
  const lowStockCount = inventory.filter(isLowStock).length;
  const filteredInventory = inventory.filter((item) => {
    if (lowStockOnly && !isLowStock(item)) return false;
    if (search && !(item.item_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase.from('inventory').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (error) console.error('Error loading inventory:', error);
    else setInventory(data || []);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemData = {
      item_name: formData.get('name') as string,
      quantity_available: parseInt(formData.get('quantity') as string),
      unit: formData.get('unit') as string,
      category: formData.get('category') as string,
      min_stock_level: 10,
      created_by: user?.id,
    };
    const { error } = await supabase.from('inventory').insert(itemData);
    if (error) {
      console.log('Add item error - skipping:', error);
      return;
    }
    await load();
    e.currentTarget.reset();
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">Manage spare parts and logistics consumables.</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--ci-text-secondary)] cursor-pointer select-none">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="accent-[var(--ci-accent)]" />
            Low stock only
          </label>
          <IndustryDialog open={open} onOpenChange={setOpen}>
            <IndustryDialogTrigger asChild>
              <IndustryButton variant="primary" className="gap-1.5"><Plus className="size-4" /> Add item</IndustryButton>
            </IndustryDialogTrigger>
            <IndustryDialogContent open={open}>
              <IndustryDialogTitle>Register new stock item</IndustryDialogTitle>
              <form onSubmit={handleAddItem} className="flex flex-col gap-3 mt-2">
                <div>
                  <label className="ci-lbl block mb-1">Item name</label>
                  <input name="name" placeholder="Heavy Duty Engine Oil" required className={fieldClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ci-lbl block mb-1">Initial quantity</label>
                    <input name="quantity" type="number" placeholder="50" required className={fieldClass} />
                  </div>
                  <div>
                    <label className="ci-lbl block mb-1">Unit (e.g., L, pcs)</label>
                    <input name="unit" placeholder="Liters" required className={fieldClass} />
                  </div>
                </div>
                <div>
                  <label className="ci-lbl block mb-1">Category</label>
                  <input name="category" placeholder="Consumables" required className={fieldClass} />
                </div>
                <IndustryButton type="submit" variant="primary" className="w-full">Update inventory</IndustryButton>
              </form>
            </IndustryDialogContent>
          </IndustryDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <IndustryCard className="gap-1"><IndustryCardKicker>Total items</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{inventory.length}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker>Low stock items</IndustryCardKicker><p className={"ci-mono text-[20px] font-bold leading-none " + (lowStockCount > 0 ? "text-[#8c1d18]" : "")}>{lowStockCount}</p></IndustryCard>
      </div>

      <IndustryCard>
        <input placeholder="Search item name…" value={search} onChange={(e) => setSearch(e.target.value)} className={fieldClass + " max-w-xs"} />
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Item</IndustryTh>
              <IndustryTh>Category</IndustryTh>
              <IndustryTh>Stock level</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Reorder</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><IndustryTd colSpan={5} className="text-center text-[var(--ci-text-tertiary)]">Loading inventory…</IndustryTd></tr>
            ) : filteredInventory.length === 0 ? (
              <tr><IndustryTd colSpan={5} className="text-center text-[var(--ci-text-tertiary)]">{inventory.length === 0 ? 'Warehouse is empty.' : 'No items match your filters.'}</IndustryTd></tr>
            ) : (
              filteredInventory.map((item) => (
                <IndustryTr key={item.id}>
                  <IndustryTd><span className="flex items-center gap-2"><Package className="size-3.5 text-[var(--ci-text-tertiary)]" />{item.item_name}</span></IndustryTd>
                  <IndustryTd>{item.category || 'Uncategorized'}</IndustryTd>
                  <IndustryTd mono>{item.quantity_available ?? 0} {item.unit}</IndustryTd>
                  <IndustryTd><IndustryTag variant={isLowStock(item) ? "danger" : "accent"}>{isLowStock(item) ? 'Low stock' : 'In stock'}</IndustryTag></IndustryTd>
                  <IndustryTd align="right">{isLowStock(item) && <AlertCircle className="size-4 text-[#8c1d18] inline" />}</IndustryTd>
                </IndustryTr>
              ))
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </>
  );
}

function PartsRequestsView() {
  const { user } = useSupabase();
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const filteredRequests = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: requestsData, error: requestsError } = await supabase.from('parts_requests').select('*, requester:user_profiles(name)').order('created_at', { ascending: false });
    if (requestsError) { console.log('Parts requests error:', requestsError); setRequests([]); }
    else setRequests(requestsData || []);

    const { data: inventoryData, error: inventoryError } = await supabase.from('inventory').select('*').eq('status', 'active');
    if (inventoryError) { console.log('Inventory error - skipping:', inventoryError); setInventory([]); }
    else setInventory(inventoryData || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('parts_requests').update({ status }).eq('id', requestId);
    if (error) { console.error('Error updating request status:', error); return; }
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
  };

  return (
    <>
      <p className="text-[12px] text-[var(--ci-text-secondary)] mb-3">Review and authorize mechanic resource requests.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <IndustryCard className="gap-1"><IndustryCardKicker><Clock className="size-3 inline mr-1" />Pending requests</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{requests.filter((r) => r.status === 'pending').length}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker><CheckCircle className="size-3 inline mr-1" />Approved</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{requests.filter((r) => r.status === 'approved').length}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker><Package className="size-3 inline mr-1" />Inventory alerts</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{inventory.filter((item) => (item.quantity_available ?? 0) <= (item.min_stock_level ?? 0)).length}</p></IndustryCard>
      </div>

      <div className="flex gap-1 mb-3">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={
              "px-3 py-[6px] text-[12px] border capitalize transition-colors duration-150 " +
              (statusFilter === tab ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]" : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
            }
          >
            {tab === 'all' ? 'All requests' : tab}
          </button>
        ))}
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Requested part</IndustryTh>
              <IndustryTh>Requested by</IndustryTh>
              <IndustryTh align="right">Quantity</IndustryTh>
              <IndustryTh>Urgency</IndustryTh>
              <IndustryTh>Reason</IndustryTh>
              <IndustryTh>Requested</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Actions</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={8} className="text-center text-[var(--ci-text-tertiary)]">Loading requests…</IndustryTd></tr>
            ) : filteredRequests.length === 0 ? (
              <tr><IndustryTd colSpan={8} className="text-center text-[var(--ci-text-tertiary)]">No maintenance requests found.</IndustryTd></tr>
            ) : (
              filteredRequests.map((r) => (
                <IndustryTr key={r.id}>
                  <IndustryTd><span className="flex items-center gap-2"><Wrench className="size-3.5 text-[var(--ci-accent)]" />{r.part_name}</span></IndustryTd>
                  <IndustryTd>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium">{r.requester?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-[var(--ci-text-tertiary)] ci-mono">{r.requested_by?.slice(0, 8)}</span>
                    </div>
                  </IndustryTd>
                  <IndustryTd align="right" mono>{r.quantity_requested}</IndustryTd>
                  <IndustryTd><IndustryTag variant={r.urgency === 'High' ? "danger" : "neutral"}>{r.urgency}</IndustryTag></IndustryTd>
                  <IndustryTd className="text-[11px] text-[var(--ci-text-tertiary)] max-w-xs truncate">{r.reason}</IndustryTd>
                  <IndustryTd mono className="text-[11px]">{r.created_at ? formatDate(r.created_at) : '—'}</IndustryTd>
                  <IndustryTd><IndustryTag variant={r.status === 'approved' ? "accent" : r.status === 'rejected' ? "danger" : "warning"}>{r.status.toUpperCase()}</IndustryTag></IndustryTd>
                  <IndustryTd align="right">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <IndustryButton variant="ghost" onClick={() => handleAction(r.id, 'approved')} className="text-[#2f7d4f]"><CheckCircle className="size-3.5" /></IndustryButton>
                        <IndustryButton variant="ghost" onClick={() => handleAction(r.id, 'rejected')} className="text-[#8c1d18]"><XCircle className="size-3.5" /></IndustryButton>
                      </div>
                    )}
                  </IndustryTd>
                </IndustryTr>
              ))
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </>
  );
}

export default function InventoryAndPartsPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const [view, setView] = useState<'inventory' | 'parts'>('inventory');

  if (roleLoading) return null;

  const canView = isAdmin || ['CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'].includes(role || '');
  if (!canView) {
    return (
      <IndustryShell className="min-h-screen flex items-center justify-center">
        <IndustryCard className="max-w-md text-center">
          <h1 className="text-[22px]" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600, color: "#8c1d18" }}>Access denied</h1>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">You do not have permission to access the warehouse inventory.</p>
        </IndustryCard>
      </IndustryShell>
    );
  }

  return (
    <IndustryRoleShell roleLabel="Operator" pages={OPERATOR_PAGES}>
      <div className="flex gap-1 border-b border-[var(--ci-divider)] mb-4">
        <button
          onClick={() => setView('inventory')}
          className={
            "px-3 py-[8px] text-[13px] border-b-2 transition-colors duration-150 " +
            (view === 'inventory' ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
          }
        >
          Inventory
        </button>
        <button
          onClick={() => setView('parts')}
          className={
            "px-3 py-[8px] text-[13px] border-b-2 transition-colors duration-150 " +
            (view === 'parts' ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
          }
        >
          Parts requests
        </button>
      </div>

      {view === 'inventory' ? <InventoryView /> : <PartsRequestsView />}
    </IndustryRoleShell>
  );
}
