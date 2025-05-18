export interface Resource {
  id: string;
  name: string;
  type: 'Microscope' | 'Centrifuge' | 'Spectrometer' | 'Incubator' | 'HPLC System' | 'Fume Hood';
  lab: 'Lab A' | 'Lab B' | 'Lab C' | 'General Lab';
  status: 'Available' | 'Booked' | 'Maintenance';
  description: string;
  imageUrl: string;
  features?: string[];
  lastCalibration?: string; // Date string
  nextCalibration?: string; // Date string
  availability?: { date: string; slots: string[] }[];
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  userId: string; // For simplicity, using string. In a real app, this would be a user object or ID.
  userName: string;
  startTime: Date;
  endTime: Date;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  notes?: string;
}

// Add other types as needed
