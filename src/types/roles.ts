export type UserRole =
  | "CEO"
  | "ADMIN"
  | "OPERATOR"
  | "DRIVER"
  | "MECHANIC"
  | "ACCOUNTANT"
  | "HR"
  | "SALESMAN"
  | "WAREHOUSE_STAFF";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: "active" | "inactive";
  avatar?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  created_at: any;
  updated_at: any;
}

// Fleet Management Types
export type FleetType = "DUMP_TRUCK" | "TRUCK_HEAD" | "TRAILER" | "ESCORT_CAR";

export interface FleetVehicle {
  id: string;
  type: FleetType;
  trailerSubType?: "LOWBED" | "FLATBED"; // Only for TRAILER type
  plateNumber: string;
  plate_number?: string;
  make: string;
  model: string;
  year: number;
  status: "available" | "in_use" | "maintenance" | "out_of_service";
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
  name?: string;
  created_at: any;
  updated_at: any;
}

export type TripStatus =
  | "created"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "completed"
  | "COMPLETED"
  | "DELIVERED"
  | "pending"
  | "loading"
  | "LOADED"
  | "IN_TRANSIT";

export interface Trip {
  id: string;
  tripNumber: string;
  trip_number?: string;
  origin: string;
  destination: string;
  driverId: string;
  truckId: string;
  trailerId?: string;
  escortCarId?: string;
  hoseId?: string;
  status: TripStatus;
  cargoType: string;
  cargo_type?: string;
  cargoWeight?: number;
  estimatedDistance?: number;
  actualDistance?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  fuelExpense?: number;
  otherExpenses?: number;
  revenue?: number;
  // Trip Type & VAT
  tripType?: "transit" | "local";
  tripCategory?: "town" | "regional";
  salesAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  totalAmount?: number;
  startTime?: any;
  endTime?: any;
  created_at: any;
  updated_at: any;
  createdBy: string;
  notes?: string;
  client_name?: string;
  price?: number;
  vehicle_id?: string;
  driver_id?: string;
  client?: any;
  client_id?: string;
  date?: string;
  driver_name?: string;
  driver?: any;
  truck_plate?: string;
  truck?: any;
}

// Expense Management
export interface Expense {
  id: string;
  type:
    | "fuel"
    | "maintenance"
    | "repair"
    | "insurance"
    | "registration"
    | "allowance"
    | "payroll"
    | "other";
  amount: number;
  description: string;
  vehicleId?: string;
  vehicle_id?: string;
  driverId?: string;
  driver_id?: string;
  tripId?: string;
  clientReference?: string;
  category: string;
  receiptUrl?: string;
  approvedBy?: string;
  status: "pending" | "approved" | "rejected";
  employee_id?: string;
  employeeId?: string;
  vendor?: string;
  currency?: string;
  date?: string;
  trip_id?: string;
  created_at?: any;
  updated_at?: any;
  trip?: any;
  expense_date?: string;
}

// Maintenance Management
export interface MaintenanceRequest {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  type?: "routine" | "emergency" | "repair";
  description: string;
  issue_description?: string;
  issue_type?: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "reported" | "diagnosed" | "in_progress" | "completed" | "cancelled";
  estimated_cost?: number;
  actual_cost?: number;
  assigned_mechanic_id?: string;
  created_at: any;
  updated_at: any;
  completed_at?: any;
  notes?: string;
}

// Parts Management
export interface SparePart {
  id: string;
  name: string;
  part_number?: string;
  category: string;
  quantity: number;
  min_quantity?: number;
  unit_price?: number;
  supplier?: string;
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
  status: "pending" | "approved" | "rejected" | "issued";
  approvedBy?: string;
  issuedBy?: string;
  part_id?: string;
  quantity_requested?: number;
  created_at: any;
  updated_at: any;
}

// Allowances Management
export interface Allowance {
  id: string;
  employeeId: string;
  type: "fuel" | "meal" | "accommodation" | "travel" | "bonus" | "other";
  amount: number;
  description: string;
  period: string;
  status: "pending" | "approved" | "paid";
  approvedBy?: string;
  paidAt?: any;
  workerName?: string;
  trip_id?: string;
  created_at: any;
  updated_at: any;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  actionUrl?: string;
  createdAt: any;
}

// Truck Insurance Management
export type InsurancePolicyType =
  | "third_party"
  | "third_party_cargo"
  | "comprehensive"
  | "cross_border";

export type InsuranceStatus = "active" | "expiring_soon" | "expired" | "cancelled";

export interface TruckInsurance {
  id: string;
  vehicle_id: string;
  insurer_name: string;
  policy_number?: string;
  policy_type: InsurancePolicyType;
  tira_reference_number: string;
  start_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  annual_premium: number; // TZS
  currency?: string;
  assigned_driver_id?: string;
  route_coverage_area?: string;
  covered_countries?: string[];
  status: InsuranceStatus;
  is_cross_border?: boolean;
  has_comesa_yellow_card?: boolean;
  comesa_yellow_card_number?: string;
  comesa_expiry_date?: string;
  policy_document_url?: string;
  policy_document_name?: string;
  policy_document_uploaded_at?: string;
  reminder_sent_at?: string;
  last_verified_at?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceClaim {
  id: string;
  truck_insurance_id: string;
  vehicle_id: string;
  claim_date: string;
  claim_type: string; // "accident", "theft", "damage", "third_party", "cargo"
  claim_amount: number; // TZS
  description: string;
  status: "pending" | "approved" | "rejected" | "resolved";
  resolution_notes?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceSummary {
  total_vehicles: number;
  total_active_policies: number;
  expiring_within_30_days: number;
  expired_policies: number;
  mandatory_tira_compliance: {
    compliant: number;
    non_compliant: number;
  };
  cross_border_coverage: {
    with_yellow_card: number;
    without_yellow_card: number;
  };
  total_annual_premium: number; // TZS
}
