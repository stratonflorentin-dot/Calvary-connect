"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign, User, Calendar, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface VehicleDeletionDialogProps {
  vehicle: {
    id: string;
    plate_number: string;
    make: string;
    model: string;
    year: number;
    mileage: number;
    status: string;
  };
  onSuccess?: () => void;
  children: React.ReactNode;
}

export function VehicleDeletionDialog({ vehicle, onSuccess, children }: VehicleDeletionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletionReason, setDeletionReason] = useState<'sold' | 'decommissioned' | 'scrapped'>('sold');
  const [soldTo, setSoldTo] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [notes, setNotes] = useState('');

  const handleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vehicle.id) {
      toast({
        title: "Error",
        description: "Invalid vehicle ID",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('handle_vehicle_deletion', {
        p_vehicle_id: vehicle.id,
        p_deletion_reason: deletionReason,
        p_sold_to: soldTo || null,
        p_sale_price: salePrice ? parseFloat(salePrice) : null,
        p_notes: notes || null
      });

      if (error) {
        console.error('Error deleting vehicle:', error);
        toast({
          title: "Error",
          description: "Failed to process vehicle deletion",
          variant: "destructive"
        });
        return;
      }

      const result = data;
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "Vehicle processed successfully"
        });
        setOpen(false);
        onSuccess?.();
        
        // Reset form
        setDeletionReason('sold');
        setSoldTo('');
        setSalePrice('');
        setNotes('');
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process vehicle deletion",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Process Vehicle: {vehicle.plate_number}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleDeletion} className="space-y-6">
          {/* Vehicle Information */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Vehicle Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Plate Number</Label>
                <p className="font-medium">{vehicle.plate_number}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Make/Model</Label>
                <p className="font-medium">{vehicle.make} {vehicle.model}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Year</Label>
                <p className="font-medium">{vehicle.year}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Current Mileage</Label>
                <p className="font-medium">{vehicle.mileage.toLocaleString()} km</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Current Status</Label>
                <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'}>
                  {vehicle.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Deletion Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Deletion Reason *</Label>
            <Select value={deletionReason} onValueChange={(value: any) => setDeletionReason(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sold">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4" />
                    Sold
                  </div>
                </SelectItem>
                <SelectItem value="decommissioned">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4" />
                    Decommissioned
                  </div>
                </SelectItem>
                <SelectItem value="scrapped">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4" />
                    Scrapped
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sale Information (only for sold vehicles) */}
          {deletionReason === 'sold' && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="size-4" />
                Sale Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="soldTo">Sold To *</Label>
                  <Input
                    id="soldTo"
                    value={soldTo}
                    onChange={(e) => setSoldTo(e.target.value)}
                    placeholder="Buyer name or company"
                    required={deletionReason === 'sold'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this vehicle disposition..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800">Important Notice</h4>
                <p className="text-sm text-amber-700 mt-1">
                  This action will mark the vehicle as {deletionReason} and create a permanent audit record. 
                  The vehicle will no longer appear in active fleet lists but will be preserved in the audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={deletionReason === 'sold' ? 'default' : 'destructive'}
              disabled={loading || (deletionReason === 'sold' && !soldTo)}
            >
              {loading ? 'Processing...' : `Mark as ${deletionReason}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
