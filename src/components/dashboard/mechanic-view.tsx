
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Package, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function MechanicView() {
  const firestore = useFirestore();
  const { user } = useUser();

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'maintenance_requests'), orderBy('reportedAt', 'desc'));
  }, [firestore, user]);

  const { data: requests } = useCollection(requestsQuery);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-headline tracking-tighter">Maintenance Hub</h1>
        <p className="text-muted-foreground text-sm">Monitor fleet health and manage service logs.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-primary-foreground/70">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline">{requests?.filter(r => r.status === 'pending').length || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Critical Fleet</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-3xl font-headline text-rose-500">2</div>
            <AlertCircle className="size-5 text-rose-500" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Parts in Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline text-primary">124</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-xl font-headline tracking-tighter flex items-center gap-2">
            <Wrench className="size-5 text-primary" /> Active Service Queue
          </h2>
          <div className="space-y-3">
            {requests?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No active requests found.</p>
            ) : requests?.map(request => (
              <Card key={request.id} className="rounded-xl shadow-sm border overflow-hidden">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-headline text-sm">{request.issueDescription}</p>
                    <p className="text-[10px] text-muted-foreground">Reported: {new Date(request.reportedAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={request.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'}>
                    {request.severity}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-headline tracking-tighter flex items-center gap-2">
            <History className="size-5 text-primary" /> Recent Fixes
          </h2>
          <div className="bg-card rounded-2xl shadow-sm border p-6">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 border-b pb-3 last:border-0">
                  <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Brake Pad Replacement</p>
                    <p className="text-xs text-muted-foreground">Truck #G-2883-24 • 2 days ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
