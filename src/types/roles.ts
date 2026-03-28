export type UserRole = 'CEO' | 'OPERATOR' | 'DRIVER' | 'MECHANIC' | 'ACCOUNTANT' | 'HR';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  created_at: any;
  updated_at: any;
}

// Fleet Management Types
export type FleetType = 'TRUCK' | 'TRAILER' | 'HOSE' | 'ESCORT_CAR';

export interface FleetVehicle {
  id: string;
  type: FleetType;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  currentDriverId?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  fuelCapacity?: number;
  currentFuelLevel?: number;
  mileage?: number;
  lastMaintenanceDate?: any;
  nextMaintenanceDue?: any;
  insuranceExpiry?: any;
  registrationExpiry?: any;
  created_at: any;
  updated_at: any;
}

export type TripStatus = 'created' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

export interface Trip {
  id: string;
  tripNumber: string;
  origin: string;
  destination: string;
  driverId: string;
  truckId: string;
  trailerId?: string;
  escortCarId?: string;
  hoseId?: string;
  status: TripStatus;
  cargoType: string;
  cargoWeight?: number;
  estimatedDistance?: number;
  actualDistance?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  fuelExpense?: number;
  otherExpenses?: number;
  revenue?: number;
  startTime?: any;
  endTime?: any;
  created_at: any;
  updated_at: any;
  createdBy: string;
  notes?: string;
}

// Expense Management
export interface Expense {
  id: string;
  type: 'fuel' | 'maintenance' | 'repair' | 'insurance' | 'registration' | 'other';
  amount: number;
  description: string;
  vehicleId: string;
  driverId?: string;
  tripId?: string;
  category: string;
  receiptUrl?: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: any;
  updated_at: any;
}

// Maintenance Management
export interface MaintenanceRequest {
  id: string;
  vehicleId: string;
  driverId: string;
  type: 'routine' | 'emergency' | 'repair';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'diagnosed' | 'in_progress' | 'completed' | 'cancelled';
  estimatedCost?: number;
  actualCost?: number;
  assignedMechanicId?: string;
  reportedAt: any;
  completedAt?: any;
  notes?: string;
}

// Parts Management
export interface SparePart {
  id: string;
  name: string;
  partNumber: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier?: string;
  location?: string;
  compatibleVehicles: string[];
  created_at: any;
  updated_at: any;
}

export interface PartsRequest {
  id: string;
  partId: string;
  quantity: number;
  requestedBy: string;
  purpose: string;
  vehicleId?: string;
  maintenanceRequestId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'issued';
  approvedBy?: string;
  issuedBy?: string;
  created_at: any;
  updated_at: any;
}

// Allowances Management
export interface Allowance {
  id: string;
  employeeId: string;
  type: 'fuel' | 'meal' | 'accommodation' | 'travel' | 'bonus' | 'other';
  amount: number;
  description: string;
  period: string;
  status: 'pending' | 'approved' | 'paid';
  approvedBy?: string;
  paidAt?: any;
  created_at: any;
  updated_at: any;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  actionUrl?: string;
  createdAt: any;
}
