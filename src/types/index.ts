
export interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

export interface Resource {
  id: string;
  name: string;
  // type: 'Microscope' | 'Centrifuge' | 'Spectrometer' | 'Incubator' | 'HPLC System' | 'Fume Hood'; // Replaced
  resourceTypeId: string;
  resourceTypeName: string;
  lab: 'Lab A' | 'Lab B' | 'Lab C' | 'General Lab';
  status: 'Available' | 'Booked' | 'Maintenance';
  description: string;
  imageUrl: string;
  dataAiHint?: string;
  features?: string[];
  lastCalibration?: string; // Date string
  nextCalibration?: string; // Date string
  availability?: { date: string; slots: string[] }[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string; // ISO date string
  notes?: string;
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  startTime: Date;
  endTime: Date;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  notes?: string;
}

// User Management Types
export type RoleName = 'Admin' | 'Lab Manager' | 'Technician' | 'Researcher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string;
  avatarDataAiHint?: string;
}

// Add other types as needed
