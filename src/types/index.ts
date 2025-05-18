
export interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

export type ResourceStatus = 'Available' | 'Booked' | 'Maintenance';

export interface RemoteAccessDetails {
  ipAddress?: string;
  hostname?: string;
  protocol?: 'RDP' | 'SSH' | 'VNC' | 'Other';
  username?: string;
  port?: number;
  notes?: string;
}

export interface Resource {
  id: string;
  name: string;
  resourceTypeId: string;
  resourceTypeName: string;
  lab: 'Electronics Lab 1' | 'RF Lab' | 'Prototyping Lab' | 'General Test Area';
  status: ResourceStatus;
  description: string;
  imageUrl: string;
  features?: string[];
  availability?: { date: string; slots: string[] }[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string; // ISO string
  notes?: string;
  remoteAccess?: RemoteAccessDetails;
}

export interface Booking {
  id:string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  startTime: Date;
  endTime: Date;
  status: 'Confirmed' | 'Pending' | 'Cancelled'; // 'Pending' will mean pending approval
  notes?: string;
}

export type RoleName = 'Admin' | 'Lab Manager' | 'Technician' | 'Researcher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string;
}

// Lab type removed as feature was skipped
// export interface Lab {
//   id: string;
//   name: string;
//   location: string;
//   description?: string;
//   timezone: string;
// }
