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
    trucks: FleetVehicle[];
    trailers: FleetVehicle[];
    escortCars: FleetVehicle[];
    hoses: FleetVehicle[];
  }>({
    trucks: [],
    trailers: [],
    escortCars: [],
    hoses: []
  });

  const [formData, setFormData] = useState({
    tripNumber: '',
    origin: '',
    destination: '',
    driverId: '',
    truckId: '',
    trailerId: '',
    escortCarId: '',
    hoseId: '',
    cargoType: '',
    cargoWeight: '',
    estimatedDistance: '',
    estimatedDuration: '',
    notes: ''
  });

  useEffect(() => {
    loadVehicles();
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const loadVehicles = async () => {
    try {
      const [trucks, trailers, escortCars, hoses] = await Promise.all([
        FleetService.getAvailableVehicles('TRUCK'),
        FleetService.getAvailableVehicles('TRAILER'),
        FleetService.getAvailableVehicles('ESCORT_CAR'),
        FleetService.getAvailableVehicles('HOSE')
      ]);

      setVehicles({ trucks, trailers, escortCars, hoses });
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getFleetIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'truck': return <Truck className="size-5" />;
      case 'trailer': return <Package className="size-5" />;
      case 'car': return <Car className="size-5" />;
      case 'motorcycle': return <Wrench className="size-5" />;
      case 'van': return <Package className="size-5" />;
      case 'bus': return <Truck className="size-5" />;
      default: return <Truck className="size-5" />;
    }
  };

  const getFleetColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'truck': return 'bg-blue-100 text-blue-800';
      case 'trailer': return 'bg-green-100 text-green-800';
      case 'car': return 'bg-yellow-100 text-yellow-800';
      case 'motorcycle': return 'bg-purple-100 text-purple-800';
      case 'van': return 'bg-green-100 text-green-800';
      case 'bus': return 'bg-blue-100 text-blue-800';
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
      </div>

      {/* Fleet Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fleet Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Truck Selection */}
            <div>
              <Label htmlFor="truckId">Truck *</Label>
              <Select value={formData.truckId} onValueChange={(value) => setFormData({ ...formData, truckId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon('truck')}
                        <span>{truck.plateNumber} - {truck.make} {truck.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trailer Selection */}
            <div>
              <Label htmlFor="trailerId">Trailer</Label>
              <Select value={formData.trailerId} onValueChange={(value) => setFormData({ ...formData, trailerId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trailer" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.trailers.map((trailer) => (
                    <SelectItem key={trailer.id} value={trailer.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon('trailer')}
                        <span>{trailer.plateNumber} - {trailer.make} {trailer.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Escort Car Selection */}
            <div>
              <Label htmlFor="escortCarId">Escort Car</Label>
              <Select value={formData.escortCarId} onValueChange={(value) => setFormData({ ...formData, escortCarId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select escort car" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.escortCars.map((car) => (
                    <SelectItem key={car.id} value={car.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon('car')}
                        <span>{car.plateNumber} - {car.make} {car.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hose Selection */}
            <div>
              <Label htmlFor="hoseId">Hose Equipment</Label>
              <Select value={formData.hoseId} onValueChange={(value) => setFormData({ ...formData, hoseId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hose" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.hoses.map((hose) => (
                    <SelectItem key={hose.id} value={hose.id}>
                      <div className="flex items-center gap-2">
                        {getFleetIcon('motorcycle')}
                        <span>{hose.plateNumber} - {hose.make} {hose.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Fleet Summary */}
          {(formData.truckId || formData.trailerId || formData.escortCarId || formData.hoseId) && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Selected Fleet:</h4>
              <div className="flex flex-wrap gap-2">
                {formData.truckId && (
                  <Badge className={getFleetColor('TRUCK')}>
                    <Truck className="size-3 mr-1" />
                    Truck: {vehicles.trucks.find(t => t.id === formData.truckId)?.plateNumber}
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
                {formData.hoseId && (
                  <Badge className={getFleetColor('HOSE')}>
                    <Wrench className="size-3 mr-1" />
                    Hose: {vehicles.hoses.find(h => h.id === formData.hoseId)?.plateNumber}
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
