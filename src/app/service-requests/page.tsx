
"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Clock, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { createNotification } from '@/services/notification-service';

type Req = Record<string, unknown>;

function reqIssue(r: Req) {
  return String(r.issue_description || r.description || r.part_name || 'Maintenance request');
}
function reqStatus(r: Req) {
  return String(r.status || 'pending').toLowerCase();
}
function reqUrgency(r: Req) {
  return String(r.priority || r.urgency || r.severity || 'medium');
}
function reqDate(r: Req) {
  const d = r.reported_at || r.created_at || r.requested_date;
  return d ? new Date(String(d)).toLocaleString() : '—';
}
function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    in_review: 'In Review',
    in_progress: 'In Review',
    approved: 'Approved',
    completed: 'Completed',
  };
  return map[s] || s;
}

import { WorkflowService } from '@/services/workflow-service';

export default function ServiceRequestsPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  const { user } = useSupabase();
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load real maintenance requests from Supabase
        const { data: maintenanceRequests, error } = await supabase
          .from('maintenance_requests')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setRequests(maintenanceRequests || []);
      } catch (error) {
        console.error('Error loading service requests:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [user]);

  const notifyDriver = async (request: Req, message: string) => {
    const driverId = String(request.driver_id || request.user_id || '');
    if (!driverId) return;
    await createNotification({
      userId: driverId,
      category: 'maintenance_update',
      title: 'Maintenance update',
      message,
      severity: 'info',
    });
  };

  const updateRequest = async (
    requestId: string,
    status: string,
    extra: Record<string, unknown> = {},
    request?: Req,
  ) => {
    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ status, updated_at: new Date().toISOString(), ...extra })
        .eq('id', requestId);
      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status, ...extra } : r)),
      );
      if (request) {
        await notifyDriver(request, `Request status: ${statusLabel(status)}`);
      }
      toast({ title: 'Updated', description: `Status set to ${statusLabel(status)}` });
    } catch (error) {
      console.error('Error updating request:', error);
      toast({ title: 'Error', description: 'Could not update request', variant: 'destructive' });
    }
  };

  const handleMechanicNotes = async (
    e: React.FormEvent<HTMLFormElement>,
    requestId: string,
    request: Req,
    nextStatus: string,
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const notes = String(formData.get('notes') || '');
    const cost = parseFloat(String(formData.get('cost') || '0'));

    if (nextStatus === 'completed') {
      await WorkflowService.completeMaintenance(requestId, cost);
    } else {
      await updateRequest(
        requestId,
        nextStatus,
        { mechanic_notes: notes, notes },
        request,
      );
    }
    e.currentTarget.reset();
  };

  if (!isAdmin && !['CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'].includes(role || '')) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role!} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center bg-card p-8 rounded-2xl border shadow-sm max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-muted-foreground text-sm">You do not have permission to view service requests.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Service Queue</h1>
          <p className="text-muted-foreground text-sm font-sans">Manage active repairs and submit service logs.</p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-12 text-center">Loading requests...</div>
          ) : requests?.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-dashed">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-muted-foreground">No pending maintenance requests.</p>
            </div>
          ) : (
            requests?.map((r) => {
              const status = reqStatus(r);
              const id = String(r.id);
              return (
              <Card key={id} className="rounded-2xl shadow-sm border-none overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-[10px] font-bold",
                          reqUrgency(r).includes('crit') || reqUrgency(r).includes('urgent') ? 'bg-rose-500' : 'bg-amber-500'
                        )}>
                          {reqUrgency(r).toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          Request #{id.slice(0, 8)}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-headline text-lg">{reqIssue(r)}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Truck className="size-3" /> Vehicle: {String(r.vehicle_id || '—')}
                        </p>
                        {r.mechanic_notes && (
                          <p className="text-xs text-muted-foreground">Notes: {String(r.mechanic_notes)}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> Reported: {reqDate(r)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2 md:w-52">
                      {status === 'pending' && (
                        <Button onClick={() => updateRequest(id, 'in_review', {}, r)} className="w-full rounded-xl gap-2">
                          <Wrench className="size-4" /> Mark In Review
                        </Button>
                      )}
                      {(status === 'in_review' || status === 'in_progress') && (
                        <>
                          <Button onClick={() => updateRequest(id, 'approved', {}, r)} className="w-full rounded-xl">
                            Approve repair
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700">
                                <CheckCircle2 className="size-4" /> Complete
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Mechanic notes</DialogTitle>
                              </DialogHeader>
                              <form onSubmit={(e) => handleMechanicNotes(e, id, r, 'completed')} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                  <Label>Actual Cost (TZS)</Label>
                                  <Input name="cost" type="number" placeholder="0" required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Service Log / Notes</Label>
                                  <Textarea name="notes" placeholder="Work performed, parts replaced…" required className="min-h-[120px]" />
                                </div>
                                <Button type="submit" className="w-full">Mark completed</Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                      {status === 'approved' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle2 className="size-4" /> Complete
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Mechanic notes</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={(e) => handleMechanicNotes(e, id, r, 'completed')} className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Actual Cost (TZS)</Label>
                              <Input name="cost" type="number" placeholder="0" required />
                            </div>
                            <div className="space-y-2">
                              <Label>Service Log / Notes</Label>
                              <Textarea name="notes" placeholder="Final service log…" required className="min-h-[120px]" />
                            </div>
                            <Button type="submit" className="w-full">Mark completed</Button>
                          </form>
                          </DialogContent>
                        </Dialog>
                      )}

                      <Badge className={cn(
                        "w-full justify-center py-1 mt-auto",
                        status === 'completed' ? 'bg-emerald-500' :
                          status === 'approved' ? 'bg-blue-500' :
                          status === 'in_review' || status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-400'
                      )}>
                        {statusLabel(status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );})
          )}
        </div>
      </main>
    </div>
  );
}




