"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Clock, CheckCircle, XCircle, AlertTriangle, Wrench } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// Type definitions
interface MaintenanceRequest {
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

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity_available: number;
  unit: string;
  min_stock_level: number;
  status: string;
}

export default function PartsRequestsPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  const { user } = useSupabase();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Load real parts requests from database
        const { data: requestsData, error: requestsError } = await supabase
          .from('parts_requests')
          .select('*, requester:user_profiles(name)')
          .order('created_at', { ascending: false });

        if (requestsError) {
          console.log('Parts requests error:', requestsError);
          setRequests([]);
        } else {
          setRequests(requestsData || []);
        }

        // Load inventory data for alerts
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('*')
          .eq('status', 'active');

        if (inventoryError) {
          console.log('Inventory error - skipping:', inventoryError);
          setInventory([]);
        } else {
          setInventory(inventoryData || []);
        }
      } catch (error) {
        console.log('Data loading error - skipping:', error);
        setRequests([]);
        setInventory([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected', item: any) => {
    try {
      // Update the parts request status in Supabase
      const { error } = await supabase
        .from('parts_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating request status:', error);
        return;
      }

      // Update local state to reflect the change
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status } : r
      ));

      console.log(`Request ${requestId} ${status} successfully`);
    } catch (error) {
      console.error('Handle action error:', error);
    }
  };

  if (!isAdmin && !['CEO', 'ADMIN', 'OPERATOR'].includes(role || '')) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role!} />
        <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center bg-card p-8 rounded-2xl border shadow-sm max-w-md w-full">
            <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
            <p className="text-muted-foreground text-sm">You do not have permission to review parts requests.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Maintenance & Parts Approvals</h1>
          <p className="text-muted-foreground text-sm font-sans">Review and authorize mechanic resource requests.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Pending Requests</CardTitle>
              <Clock className="size-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">{requests?.filter(r => r.status === 'pending').length || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Approved</CardTitle>
              <CheckCircle className="size-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">{requests?.filter(r => r.status === 'approved').length || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Inventory Alerts</CardTitle>
              <Package className="size-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">{inventory?.filter(item => item.quantity_available <= item.min_stock_level).length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto no-scrollbar">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                statusFilter === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'all' ? 'All Requests' : tab}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Requested Part</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading requests...</TableCell></TableRow>
              ) : filteredRequests?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">No maintenance requests found.</TableCell></TableRow>
              ) : filteredRequests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="px-6 py-4 font-medium flex items-center gap-3">
                    <Wrench className="size-4 text-primary" />
                    {r.part_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{r.requester?.name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{r.requested_by?.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{r.quantity_requested}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-bold",
                      r.urgency === 'High' ? 'text-destructive border-destructive/30' : 'text-muted-foreground'
                    )}>
                      {r.urgency}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.created_at ? formatDate(r.created_at) : '—'}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[10px]",
                      r.status === 'approved' ? 'bg-success' :
                        r.status === 'rejected' ? 'bg-destructive' : 'bg-warning'
                    )}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-success hover:bg-success/10"
                          onClick={() => handleAction(r.id, 'approved', r)}
                        >
                          <CheckCircle className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleAction(r.id, 'rejected', r)}
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}




