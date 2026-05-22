"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Fuel, Clock, CheckCircle2, XCircle, User, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { WorkflowService } from '@/services/workflow-service';

export default function FuelApprovalsPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fuel_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading fuel requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadRequests();
  }, [user]);

  const handleApprove = async (requestId: string) => {
    try {
      await WorkflowService.approveFuelRequest(requestId, user?.id || 'system');
      toast({ title: 'Approved', description: 'Fuel request approved and expense recorded.' });
      loadRequests();
    } catch (error) {
      console.error('Approval error:', error);
      toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('fuel_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      toast({ title: 'Rejected', description: 'Fuel request rejected.' });
      loadRequests();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject request', variant: 'destructive' });
    }
  };

  if (roleLoading) return null;

  return (
    <div className="flex min-h-screen bg-[#F0F1F5]">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter text-[#2952A3] uppercase font-extrabold">Fuel Approvals</h1>
          <p className="text-slate-500 text-sm">Review and approve fuel requests from drivers.</p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-12 text-center">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <Fuel className="size-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No pending fuel requests</p>
            </div>
          ) : (
            requests.map((r) => (
              <Card key={r.id} className="rounded-2xl border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "size-12 rounded-xl flex items-center justify-center",
                        r.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                        r.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      )}>
                        <Fuel className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900">TZS {Number(r.amount).toLocaleString()}</h3>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">{r.id.slice(0, 8)}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Truck className="size-3" /> {r.vehicle_id}</span>
                          <span className="flex items-center gap-1"><User className="size-3" /> Driver ID: {r.driver_id}</span>
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(r.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.status === 'pending' ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl border-red-100 text-red-600 hover:bg-red-50"
                            onClick={() => handleReject(r.id)}
                          >
                            <XCircle className="size-4 mr-2" /> Reject
                          </Button>
                          <Button 
                            size="sm" 
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApprove(r.id)}
                          >
                            <CheckCircle2 className="size-4 mr-2" /> Approve
                          </Button>
                        </>
                      ) : (
                        <Badge className={cn(
                          "rounded-lg px-3 py-1 text-[10px] uppercase font-bold",
                          r.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                        )}>
                          {r.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
