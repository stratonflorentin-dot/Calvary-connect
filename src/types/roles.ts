export type UserRole = 'CEO' | 'OPERATIONS' | 'DRIVER' | 'MECHANIC' | 'ACCOUNTANT';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar?: string;
}

export type TripStatus = 'created' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  driverId: string;
  truckId: string;
  status: TripStatus;
  createdAt: any;
  completedAt?: any;
}
