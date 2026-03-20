
"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Clock, CheckCircle2, AlertTriangle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function ServiceRequestsPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'maintenance_requests'), orderBy('reportedAt', 'desc'));
  }, [firestore, user]);

  const { data: requests, isLoading } = useCollection(requestsQuery);

  const handleStartWork = (requestId: string) => {
    if (!firestore) return;
    updateDocumentNonBlocking(doc(firestore, 'maintenance_requests', requestId), {
      status: 'in_progress',
      startedAt: new Date().toISOString()
    });
    toast({ title: "Work Started", description: "Truck status updated to 'In Progress'" });
  };

  const handleCompleteRepair = (e: React.FormEvent<HTMLFormElement>, requestId: string, vehicleId: string) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const log = formData.get('log') as string;
    const condition = formData.get('condition') as string;

    // 1. Update Maintenance Request
    updateDocumentNonBlocking(doc(firestore, 'maintenance_requests', requestId), {
      status: 'completed',
      completedAt: new Date().toISOString(),
      serviceLog: log,
      truckConditionAfterService: condition
    });

    // 2. Update Vehicle Status & Condition
    updateDocumentNonBlocking(doc(firestore, 'fleet_vehicles', vehicleId), {
      status: 'Available',
      condition: condition,
      lastMaintenanceDate: new Date().toISOString()
    });

    toast({ title: "Repair Completed", description: "Service report saved and truck is now Available." });
  };

  if (!['CEO', 'OPERATIONS', 'MECHANIC'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Service Queue</h1>
          <p className="text-muted-foreground text-sm font-sans">Manage active repairs and submit service logs.</p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="py-12 text-center">Loading requests...</div>
          ) : requests?.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-dashed">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-muted-foreground">No pending maintenance requests.</p>
            </div>
          ) : (
            requests?.map((r) => (
              <Card key={r.id} className="rounded-2xl shadow-sm border-none overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-[10px] font-bold",
                          r.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'
                        )}>
                          {r.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          Request #{r.id.slice(0, 8)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="font-headline text-lg">{r.issueDescription}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Truck className="size-3" /> Vehicle ID: {r.fleetVehicleId}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> Reported: {new Date(r.reportedAt).toLocaleString()}</span>
                        {r.status === 'completed' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3" /> Fixed: {new Date(r.completedAt).toLocaleString()}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2 md:w-48">
                      {r.status === 'pending' && (
                        <Button onClick={() => handleStartWork(r.id)} className="w-full rounded-xl gap-2">
                          <Wrench className="size-4" /> Start Work
                        </Button>
                      )}
                      
                      {r.status === 'in_progress' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle2 className="size-4" /> Complete & Report
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Finalize Service Report</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={(e) => handleCompleteRepair(e, r.id, r.fleetVehicleId)} className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label htmlFor="log">Work Performed (Service Log)</Label>
                                <Textarea 
                                  id="log" 
                                  name="log" 
                                  placeholder="Describe what was fixed, parts replaced, etc." 
                                  required 
                                  className="min-h-[120px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Truck Condition After Service</Label>
                                <Select name="condition" defaultValue="Good" required>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select condition" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Excellent">Excellent</SelectItem>
                                    <SelectItem value="Good">Good</SelectItem>
                                    <SelectItem value="Fair">Fair (Needs more work soon)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button type="submit" className="w-full h-12">Submit Report & Release Truck</Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}

                      {r.status === 'completed' && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Service Log</p>
                          <p className="text-xs italic text-emerald-900 line-clamp-3">"{r.serviceLog}"</p>
                        </div>
                      )}

                      <Badge className={cn(
                        "w-full justify-center py-1 mt-auto",
                        r.status === 'completed' ? 'bg-emerald-500' :
                        r.status === 'in_progress' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
                      )}>
                        {r.status.toUpperCase()}
                      </Badge>
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
