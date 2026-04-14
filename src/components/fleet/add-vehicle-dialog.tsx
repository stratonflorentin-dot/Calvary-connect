'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SupabaseService } from '@/services/supabase-service';
import { FleetType } from '@/types/roles';
import { Plus } from 'lucide-react';

interface AddVehicleDialogProps {
  onVehicleAdded?: () => void;
}

export function AddVehicleDialog({ onVehicleAdded }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'DUMP_TRUCK' as FleetType,
    trailerSubType: '' as 'LOWBED' | 'FLATBED' | '',
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    status: 'active' as const,
    mileage: 0,
    fuelCapacity: 0,
    fuelType: 'diesel' as const,
    nextServiceDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Map camelCase form fields to snake_case for Supabase
      const vehicleData = {
        type: formData.type,
        trailer_sub_type: formData.type === 'TRAILER' ? formData.trailerSubType : null,
        plate_number: formData.plateNumber,
        make: formData.make,
        model: formData.model,
        year: formData.year,
        status: formData.status,
        mileage: formData.mileage,
        fuel_capacity: formData.fuelCapacity,
      };
      
      console.log('Submitting vehicle data:', vehicleData);
      await SupabaseService.createVehicle(vehicleData);
      
      setOpen(false);
      setFormData({
        plateNumber: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        type: 'DUMP_TRUCK',
        trailerSubType: '',
        status: 'active',
        mileage: 0,
        fuelCapacity: 0,
        fuelType: 'diesel',
        nextServiceDate: '',
      });
      
      onVehicleAdded?.();
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      const errorMessage = error?.message || error?.error_description || 'Unknown error';
      alert(`❌ Error adding vehicle: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plateNumber">Plate Number</Label>
              <Input
                id="plateNumber"
                value={formData.plateNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, plateNumber: e.target.value }))}
                placeholder="ABC-123"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                min="2000"
                max={new Date().getFullYear() + 1}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="make">Make</Label>
            <Input
              id="make"
              value={formData.make}
              onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
              placeholder="Volvo"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              placeholder="FH16"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: string) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DUMP_TRUCK">Dump Truck</SelectItem>
                  <SelectItem value="TRUCK_HEAD">Truck Head (Hose)</SelectItem>
                  <SelectItem value="TRAILER">Trailer</SelectItem>
                  <SelectItem value="ESCORT_CAR">Escort Car</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trailer Sub-type - only shown when TRAILER is selected */}
            {formData.type === 'TRAILER' && (
              <div className="space-y-2">
                <Label htmlFor="trailerSubType">Trailer Type *</Label>
                <Select
                  value={formData.trailerSubType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, trailerSubType: value as 'LOWBED' | 'FLATBED' }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trailer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWBED">Lowbed</SelectItem>
                    <SelectItem value="FLATBED">Flatbed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: string) => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="decommissioned">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mileage">Mileage</Label>
              <Input
                id="mileage"
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData(prev => ({ ...prev, mileage: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fuelCapacity">Fuel Capacity (L)</Label>
              <Input
                id="fuelCapacity"
                type="number"
                value={formData.fuelCapacity}
                onChange={(e) => setFormData(prev => ({ ...prev, fuelCapacity: parseInt(e.target.value) || 0 }))}
                placeholder="300"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
