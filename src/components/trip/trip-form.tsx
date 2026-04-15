"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FleetService } from '@/services/fleet-service';
import { FleetVehicle } from '@/types/roles';
import { Truck, Package, Car, Wrench } from 'lucide-react';

interface TripFormProps {
  onSubmit: (tripData: any) => void;
  initialData?: any;
  isLoading?: boolean;
}

export function TripForm({ onSubmit, initialData, isLoading }: TripFormProps) {
  const [vehicles, setVehicles] = useState<{
    dumpTrucks: FleetVehicle[];
    truckHeads: FleetVehicle[];
    trailers: FleetVehicle[];
    escortCars: FleetVehicle[];
  }>({
    dumpTrucks: [],
    truckHeads: [],
    trailers: [],
    escortCars: []
  });

  const [formData, setFormData] = useState({
    tripNumber: '',
    origin: '',
    destination: '',
    driverId: '',
    truckId: '',
    trailerId: '',
    escortCarId: '',
    cargoType: '',
    cargoWeight: '',
    estimatedDistance: '',
    estimatedDuration: '',
    notes: '',
    tripType: 'local', // 'transit' or 'local'
    tripCategory: 'town', // 'town' or 'regional' (only for local trips)
    salesAmount: '',
    vatRate: 18, // 18% for local, 0% for transit
  });

  useEffect(() => {
    loadVehicles();
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const loadVehicles = async () => {
    try {
      const [dumpTrucks, truckHeads, trailers, escortCars] = await Promise.all([
        FleetService.getAvailableVehicles('DUMP_TRUCK'),
        FleetService.getAvailableVehicles('TRUCK_HEAD'),
        FleetService.getAvailableVehicles('TRAILER'),
        FleetService.getAvailableVehicles('ESCORT_CAR')
      ]);

      setVehicles({ dumpTrucks, truckHeads, trailers, escortCars });
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getFleetIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'DUMP_TRUCK':
      case 'TRUCK_HEAD':
        return <Truck className="size-5" />;
      case 'TRAILER':
        return <Package className="size-5" />;
      case 'ESCORT_CAR':
        return <Car className="size-5" />;
      default: return <Truck className="size-5" />;
    }
  };

  const getFleetColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'DUMP_TRUCK':
        return 'bg-orange-100 text-orange-800';
      case 'TRUCK_HEAD':
        return 'bg-blue-100 text-blue-800';
      case 'TRAILER':
        return 'bg-green-100 text-green-800';
      case 'ESCORT_CAR':
        return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Trip Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trip Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tripNumber">Trip Number</Label>
              <Input
                id="tripNumber"
                value={formData.tripNumber}
                onChange={(e) => setFormData({ ...formData, tripNumber: e.target.value })}
                placeholder="TRIP-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="Nairobi"
                required
              />
            </div>
            <div>
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Mombasa"
                required
              />
            </div>
            <div>
              <Label htmlFor="cargoType">Cargo Type</Label>
              <Input
                id="cargoType"
                value={formData.cargoType}
                onChange={(e) => setFormData({ ...formData, cargoType: e.target.value })}
                placeholder="General Cargo"
                required
              />
            </div>
            <div>
              <Label htmlFor="tripType">Trip Type</Label>
              <Select 
                value={formData.tripType} 
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  tripType: value,
                  vatRate: value === 'transit' ? 0 : 18 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trip type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transit">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50">0% VAT</Badge>
                      <span>Transit (International)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="local">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50">18% VAT</Badge>
                      <span>Local (Domestic)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tripType === 'local' && (
              <div>
                <Label htmlFor="tripCategory">Trip Category</Label>
                <Select 
                  value={formData.tripCategory} 
                  onValueChange={(value) => setFormData({ ...formData, tripCategory: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="town">Town Trip</SelectItem>
                    <SelectItem value="regional">Regional Trip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cargo Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cargo Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cargoWeight">Cargo Weight (tons)</Label>
              <Input
                id="cargoWeight"
                type="number"
                step="0.1"
                value={formData.cargoWeight}
                onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
                placeholder="25.5"
              />
            </div>
            <div>
              <Label htmlFor="estimatedDistance">Estimated Distance (km)</Label>
              <Input
                id="estimatedDistance"
                type="number"
                value={formData.estimatedDistance}
                onChange={(e) => setFormData({ ...formData, estimatedDistance: e.target.value })}
                placeholder="500"
              />
            </div>
            <div>
              <Label htmlFor="estimatedDuration">Estimated Duration (hours)</Label>
              <Input
                id="estimatedDuration"
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                placeholder="8"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sales & VAT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sales & VAT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="salesAmount">Sales Amount</Label>
              <Input
                id="salesAmount"
                type="number"
                step="0.01"
                value={formData.salesAmount}
                onChange={(e) => setFormData({ ...formData, salesAmount: e.target.value })}
                placeholder="1000.00"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm text-muted-foreground">Trip Type</p>
                <p className="font-medium capitalize">{formData.tripType}</p>
                {formData.tripType === 'local' && (
                  <p className="text-xs text-muted-foreground capitalize">({formData.tripCategory})</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">VAT Rate</p>
                <p className="font-medium">{formData.vatRate}%</p>
              </div>
            </div>
            {formData.salesAmount && (
              <div className="p-3 bg-blue-50 rounded-md space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{parseFloat(formData.salesAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT ({formData.vatRate}%):</span>
                  <span>{(parseFloat(formData.salesAmount) * (formData.vatRate / 100)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-blue-200">
                  <span>Total:</span>
                  <span>{(parseFloat(formData.salesAmount) * (1 + formData.vatRate / 100)).toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fleet Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dump Truck Selection */}
            <div>
              <Label>Dump Truck</Label>
              <Select value={formData.truckId} onValueChange={(value) => setFormData({...formData, truckId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dump truck" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.dumpTrucks.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon(v.type)}
                        <span>{v.plateNumber} - {v.make} {v.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Truck Head Selection - Alternative to Dump Truck */}
            <div>
              <Label>Truck Head (Hose)</Label>
              <Select value={formData.truckId} onValueChange={(value) => setFormData({...formData, truckId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck head" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.truckHeads.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon(v.type)}
                        <span>{v.plateNumber} - {v.make} {v.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trailer Selection */}
            <div>
              <Label>Trailer</Label>
              <Select value={formData.trailerId} onValueChange={(value) => setFormData({...formData, trailerId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trailer" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.trailers.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon(v.type)}
                        <span>{v.plateNumber} - {v.make} {v.model}</span>
                        {v.trailerSubType && <Badge variant="outline" className="ml-2">{v.trailerSubType}</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Escort Car Selection */}
            <div>
              <Label>Escort Car</Label>
              <Select value={formData.escortCarId} onValueChange={(value) => setFormData({...formData, escortCarId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select escort car" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.escortCars.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon(v.type)}
                        <span>{v.plateNumber} - {v.make} {v.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Fleet Summary */}
          {(formData.truckId || formData.trailerId || formData.escortCarId) && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Selected Fleet:</h4>
              <div className="flex flex-wrap gap-2">
                {formData.truckId && (
                  <Badge className={getFleetColor('DUMP_TRUCK')}>
                    <Truck className="size-3 mr-1" />
                    Truck: {[...vehicles.dumpTrucks, ...vehicles.truckHeads].find(t => t.id === formData.truckId)?.plateNumber}
                  </Badge>
                )}
                {formData.trailerId && (
                  <Badge className={getFleetColor('TRAILER')}>
                    <Package className="size-3 mr-1" />
                    Trailer: {vehicles.trailers.find(t => t.id === formData.trailerId)?.plateNumber}
                  </Badge>
                )}
                {formData.escortCarId && (
                  <Badge className={getFleetColor('ESCORT_CAR')}>
                    <Car className="size-3 mr-1" />
                    Escort: {vehicles.escortCars.find(c => c.id === formData.escortCarId)?.plateNumber}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this trip..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating Trip...' : 'Create Trip'}
        </Button>
      </div>
    </form>
  );
}
