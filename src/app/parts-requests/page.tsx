"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Wrench, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function PartsRequestsPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'spare_parts_requests'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const { data: requests, isLoading } = useCollection(requestsQuery);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected', item: any) => {
    if (!firestore || !user) return;

    const requestRef = doc(firestore, 'spare_parts_requests', requestId);
    
    // 1. Update Request Status
    updateDocumentNonBlocking(requestRef, {
      status,
      processedByUserId: user.uid,
      processedAt: new Date().toISOString()
    });

    if (status === 'approved' && item.inventoryItemId) {
      // 2. Update Inventory
      const invRef = doc(firestore, 'inventory_items', item.inventoryItemId);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists()) {
        const currentQty = invSnap.data().quantityAvailable || 0;
        const currentUsed = invSnap.data().quantityUsed || 0;
        updateDocumentNonBlocking(invRef, {
          quantityAvailable: Math.max(0, currentQty - (item.quantityNeeded || 1)),
          quantityUsed: currentUsed + (item.quantityNeeded || 1)
        });
      }
    }

    // 3. Notify Mechanic
    const notificationRef = collection(firestore, 'users', item.mechanicId, 'notifications');
    addDocumentNonBlocking(notificationRef, {
      title: `Parts Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your request for ${item.requestedPartName} has been ${status}.`,
      type: 'parts_request_status',
      severity: status === 'approved' ? 'success' : 'critical',
      isRead: false,
      createdAt: new Date().toISOString()
    });

    toast({
      title: `Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      description: `Notification sent to the mechanic.`,
    });
  };

  if (!['CEO', 'OPERATIONS'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Maintenance & Parts Approvals</h1>
          <p className="text-muted-foreground text-sm font-sans">Review and authorize mechanic resource requests.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Pending Requests</CardTitle>
              <Clock className="size-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">{requests?.filter(r => r.status === 'pending').length || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Approved Today</CardTitle>
              <CheckCircle className="size-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">{requests?.filter(r => r.status === 'approved').length || 0}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-widest text-muted-foreground">Inventory Alerts</CardTitle>
              <Package className="size-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-headline">2</div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Requested Part</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading requests...</TableCell></TableRow>
              ) : requests?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">No maintenance requests found.</TableCell></TableRow>
              ) : requests?.map((r) => (
                <TableRow key={r.id}>
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <Wrench className="size-4 text-primary" />
                    {r.requestedPartName}
                  </td>
                  <td>{r.quantityNeeded}</td>
                  <td>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-bold",
                      r.urgency === 'High' ? 'text-rose-600 border-rose-200' : 'text-slate-500'
                    )}>
                      {r.urgency}
                    </Badge>
                  </td>
                  <td className="text-xs text-muted-foreground max-w-xs truncate">{r.reason}</td>
                  <td>
                    <Badge className={cn(
                      "text-[10px]",
                      r.status === 'approved' ? 'bg-emerald-500' : 
                      r.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                    )}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="text-right px-6">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleAction(r.id, 'approved', r)}
                        >
                          <CheckCircle className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => handleAction(r.id, 'rejected', r)}
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    )}
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
