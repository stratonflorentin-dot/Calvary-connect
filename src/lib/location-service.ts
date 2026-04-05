import { supabase } from '@/lib/supabase';

export interface VehicleLocationData {
  vehicle_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  status?: 'active' | 'inactive' | 'idle' | 'maintenance' | 'breakdown';
  is_online?: boolean;
  alert_status?: 'none' | 'breakdown' | 'emergency' | 'off_route' | 'low_fuel';
  location_accuracy?: number;
  battery_level?: number;
  fuel_level?: number;
  odometer?: number;
  engine_status?: string;
}

export class LocationService {
  // Add or update vehicle location
  static async updateLocation(data: VehicleLocationData) {
    try {
      // Check if location already exists for this vehicle
      const { data: existingLocation, error: fetchError } = await supabase
        .from('vehicle_locations')
        .select('id')
        .eq('vehicle_id', data.vehicle_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing location:', fetchError);
        return false;
      }

      if (existingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('vehicle_locations')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLocation.id);

        if (error) {
          console.error('Error updating location:', error);
          return false;
        }
      } else {
        // Insert new location
        const { error } = await supabase
          .from('vehicle_locations')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error inserting location:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      return false;
    }
  }

  // Get all current vehicle locations
  static async getAllLocations() {
    try {
      const { data, error } = await supabase
        .from('vehicle_locations')
        .select(`
          *,
          user_profiles!inner (
            name,
            role
          ),
          vehicles!inner (
            plate_number,
            make,
            model
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching locations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  }

  // Get location for specific vehicle
  static async getVehicleLocation(vehicleId: string) {
    try {
      const { data, error } = await supabase
        .from('vehicle_locations')
        .select(`
          *,
          user_profiles!inner (
            name,
            role
          ),
          vehicles!inner (
            plate_number,
            make,
            model
          )
        `)
        .eq('vehicle_id', vehicleId)
        .single();

      if (error) {
        console.error('Error fetching vehicle location:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching vehicle location:', error);
      return null;
    }
  }

  // Simulate vehicle movement (for testing)
  static async simulateMovement(vehicleId: string, driverId: string, centerLat: number, centerLng: number) {
    try {
      // Generate random position around center point
      const radius = 0.01; // ~1km radius
      const angle = Math.random() * 2 * Math.PI;
      const latitude = centerLat + (Math.cos(angle) * radius);
      const longitude = centerLng + (Math.sin(angle) * radius);
      
      // Random heading (0-360 degrees)
      const heading = Math.random() * 360;
      
      // Random speed (0-80 km/h)
      const speed = Math.random() * 80;
      
      // Random status
      const statuses: Array<'active' | 'inactive' | 'idle' | 'maintenance' | 'breakdown'> = ['active', 'inactive', 'idle', 'maintenance', 'breakdown'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Random alert status
      const alertStatuses: Array<'none' | 'breakdown' | 'emergency' | 'off_route' | 'low_fuel'> = ['none', 'none', 'none', 'breakdown', 'emergency', 'off_route', 'low_fuel'];
      const alertStatus = alertStatuses[Math.floor(Math.random() * alertStatuses.length)];

      return await this.updateLocation({
        vehicle_id: vehicleId,
        driver_id: driverId,
        latitude,
        longitude,
        heading,
        speed,
        status,
        is_online: status !== 'inactive',
        alert_status: alertStatus,
        location_accuracy: Math.random() * 10 + 1, // 1-10 meters
        battery_level: Math.floor(Math.random() * 40 + 60), // 60-100%
        fuel_level: Math.random() * 100, // 0-100%
        odometer: Math.random() * 100000, // Random odometer
        engine_status: status === 'active' ? 'running' : 'off'
      });
    } catch (error) {
      console.error('Error simulating movement:', error);
      return false;
    }
  }

  // Create sample data for testing
  static async createSampleData() {
    try {
      // Get vehicles and drivers
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, plate_number');

      const { data: drivers, error: driverError } = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('role', 'DRIVER');

      if (vehicleError || driverError || !vehicles || !drivers) {
        console.error('Error fetching vehicles or drivers:', vehicleError || driverError);
        return false;
      }

      // Nairobi coordinates for sample data
      const nairobiLat = -1.2921;
      const nairobiLng = 36.8219;

      // Create sample locations for each vehicle
      const results = await Promise.all(
        vehicles.map(async (vehicle, index) => {
          const driver = drivers[index % drivers.length]; // Assign driver cyclically
          return await this.simulateMovement(vehicle.id, driver.id, nairobiLat, nairobiLng);
        })
      );

      return results.every(r => r === true);
    } catch (error) {
      console.error('Error creating sample data:', error);
      return false;
    }
  }

  // Start real-time simulation (for testing)
  static startRealTimeSimulation(intervalMs: number = 5000) {
    const interval = setInterval(async () => {
      await this.createSampleData();
    }, intervalMs);

    return () => clearInterval(interval);
  }
}
