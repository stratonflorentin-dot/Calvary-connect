"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, Calculator, Truck, Globe, Thermometer, Package, Plus, RefreshCw } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from '@/hooks/use-toast';
import { calculateDriverAllowance, generateAllowanceReason, getAllowanceBreakdown } from '@/lib/driver-allowance';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { WorkflowService } from '@/services/workflow-service';

interface Allowance {
  id: string;
  driver_id: string;
  trip_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  reason: string;
  created_at: string;
  driver_name?: string;
  trip_details?: {
    origin: string;
    destination: string;
    is_cross_border: boolean;
  };
}

export default function AllowancesPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAllowances();
  }, [user]);

  const loadAllowances = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // For admin/accountant: show all, for driver: show only theirs
      const isAdminOrAccountant = role === 'ADMIN' || role === 'ACCOUNTANT' || role === 'CEO' || role === 'HR';
      
      let query = supabase
        .from('driver_allowances')
        .select(`
          *,
          user_profiles!driver_id(full_name),
          trips!trip_id(origin, destination, is_cross_border)
        `)
        .order('created_at', { ascending: false });

      if (!isAdminOrAccountant) {
        query = query.eq('driver_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted = data?.map((item: any) => ({
        ...item,
        driver_name: item.user_profiles?.full_name || 'Unknown',
        trip_details: item.trips || {}
      })) || [];

      setAllowances(formatted);
    } catch (error) {
      console.error('Error loading allowances:', error);
      toast({ title: 'Error', description: 'Failed to load allowances', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      await WorkflowService.processAllowance(id, user.id);
      toast({ title: 'Success', description: 'Allowance approved and synced to Finance' });
      loadAllowances();
    } catch (error) {
      console.error('Error approving allowance:', error);
      toast({ title: 'Error', description: 'Failed to approve allowance', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate allowances for trips without one
  const generateAutoAllowances = async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      // Get trips without allowances
      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .in('status', ['completed', 'delivered'])
        .not('id', 'in', supabase.from('driver_allowances').select('trip_id'));

      if (tripsError) throw tripsError;

      let created = 0;
      for (const trip of trips || []) {
        const amount = calculateDriverAllowance(trip);
        const reason = generateAllowanceReason(trip);

        const { error } = await supabase.from('driver_allowances').insert({
          driver_id: trip.driver_id,
          trip_id: trip.id,
          amount,
          status: 'pending',
          reason,
          created_at: new Date().toISOString()
        });

        if (!error) created++;
      }

      toast({
        title: 'Allowances Generated',
        description: `Created ${created} new allowance records`,
      });

      loadAllowances();
    } catch (error) {
      console.error('Error generating allowances:', error);
      toast({ title: 'Error', description: 'Failed to generate allowances', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Calculate totals
  const totalPending = allowances.filter(a => a.status === 'pending').reduce((sum, a) => sum + a.amount, 0);
  const totalApproved = allowances.filter(a => a.status === 'approved').reduce((sum, a) => sum + a.amount, 0);
  const totalPaid = allowances.filter(a => a.status === 'paid').reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || 'DRIVER'} />
      
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Driver Allowances</h1>
              <p className="text-muted-foreground mt-1">
                Auto-calculated based on distance, time, and trip type (cross-border, cold chain, heavy cargo)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadAllowances}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={generateAutoAllowances}
                disabled={generating}
              >
                <Plus className="w-4 h-4 mr-2" />
                {generating ? 'Generating...' : 'Auto-Generate'}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">{format(totalPending)}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Calculator className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-blue-600">{format(totalApproved)}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Coins className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="text-2xl font-bold text-green-600">{format(totalPaid)}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">{allowances.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Allowance Rules */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Calvary Allowance Calculation Formula</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calculator className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Base + Distance + Time</p>
                    <p className="text-sm text-muted-foreground">
                      500 TZS base + 0.5 TZS/km + 100 TZS/hour
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Cross-Border Bonus</p>
                    <p className="text-sm text-muted-foreground">
                      +1,500 TZS for DRC, Zambia, Kenya, Rwanda, Uganda, Burundi trips
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Thermometer className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">Service Bonuses</p>
                    <p className="text-sm text-muted-foreground">
                      Cold Chain +300 TZS, Heavy Cargo +500 TZS
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Allowances Table */}
          <Card>
            <CardHeader>
              <CardTitle>Allowance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="text-muted-foreground mt-2">Loading allowances...</p>
                </div>
              ) : allowances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No allowances found. Click "Auto-Generate" to create from completed trips.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      {(role === 'ADMIN' || role === 'ACCOUNTANT' || role === 'CEO' || role === 'HR') && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowances.map((allowance) => (
                      <TableRow key={allowance.id}>
                        <TableCell className="font-medium">{allowance.driver_name}</TableCell>
                        <TableCell>
                          {allowance.trip_details?.origin && allowance.trip_details?.destination ? (
                            <span className="text-sm">
                              {allowance.trip_details.origin} → {allowance.trip_details.destination}
                              {allowance.trip_details.is_cross_border && (
                                <Globe className="inline w-3 h-3 ml-1 text-purple-500" />
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{allowance.reason}</TableCell>
                        <TableCell className="font-bold">{format(allowance.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            allowance.status === 'paid' ? 'default' :
                            allowance.status === 'approved' ? 'secondary' :
                            'outline'
                          }>
                            {allowance.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(allowance.created_at).toLocaleDateString()}
                        </TableCell>
                        {(role === 'ADMIN' || role === 'ACCOUNTANT' || role === 'CEO' || role === 'HR') && (
                          <TableCell className="text-right">
                            {allowance.status === 'pending' && (
                              <Button 
                                size="sm" 
                                onClick={() => handleApprove(allowance.id)}
                                disabled={loading}
                              >
                                Approve
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}





