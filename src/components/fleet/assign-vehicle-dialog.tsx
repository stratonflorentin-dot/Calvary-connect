"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface AssignVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  onAssigned?: () => void;
}

export function AssignVehicleDialog({
  open,
  onOpenChange,
  driverId,
  driverName,
  onAssigned
}: AssignVehicleDialogProps) {
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'active')
      .is('driver_id', null);
    setVehicles(data || []);
  };

  const handleAssign = async () => {
    if (!vehicleId) {
      toast({ title: 'Error', description: 'Please select a vehicle', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ driver_id: driverId, updated_at: new Date().toISOString() })
        .eq('id', vehicleId);

      if (error) throw error;

      toast({ title: 'Success', description: `Vehicle assigned to ${driverName}` });
      onOpenChange(false);
      onAssigned?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Vehicle to {driverName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose available vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate_number} - {v.make} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={isLoading} className="w-full">
            {isLoading ? 'Assigning...' : 'Assign Vehicle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
