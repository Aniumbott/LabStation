
import type { Resource, ResourceType, ResourceStatus, RoleName, User, Booking, MaintenanceRequest, MaintenanceRequestStatus, Notification, NotificationType, BlackoutDate, RecurringBlackoutRule, DayOfWeek, AuditLogEntry, AuditActionType } from '@/types';
import { format, addDays, set, subDays, parseISO, startOfDay, isValid as isValidDate, getDay, isBefore } from 'date-fns';

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');
const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
const twoDaysAgoStr = format(subDays(today, 2), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(today, 2), 'yyyy-MM-dd');
const threeDaysLaterStr = format(addDays(today, 3), 'yyyy-MM-dd');
const fourDaysLaterStr = format(addDays(today, 4), 'yyyy-MM-dd');
const nextWeekStr = format(addDays(today, 7), 'yyyy-MM-dd');
const tenDaysLaterStr = format(addDays(today, 10), 'yyyy-MM-dd');


export let initialMockResourceTypes: ResourceType[] = [
  { id: 'rt1', name: 'Oscilloscope', description: 'For visualizing voltage signals over time.' },
  { id: 'rt2', name: 'Power Supply', description: 'Provides DC or AC power to test circuits.' },
  { id: 'rt3', name: 'Function Generator', description: 'Generates various types of electrical waveforms.' },
  { id: 'rt4', name: 'Spectrum Analyzer', description: 'Measures the magnitude of an input signal versus frequency.' },
  { id: 'rt5', name: 'Digital Multimeter (DMM)', description: 'Measures voltage, current, and resistance.' },
  { id: 'rt6', name: 'Soldering Station', description: 'For assembling or repairing electronics.' },
  { id: 'rt7', name: 'Logic Analyzer', description: 'Captures and displays signals from a digital system.' },
  { id: 'rt8', name: 'Test Probe Set', description: 'Various probes for connecting to circuits.' },
  { id: 'rt9', name: 'ESD Workstation Mat', description: 'Anti-static mat for protecting sensitive components.' },
  { id: 'rt10', name: 'Fume Hood', description: 'Ventilated enclosure for safe handling of hazardous materials.' },
  { id: 'rt11', name: 'Spectrometer', description: 'Measures properties of light over a specific portion of the electromagnetic spectrum.' },
  { id: 'rt12', name: 'FPGA Dev Node', description: 'Field-Programmable Gate Array development node for hardware acceleration tasks.' },
];

export const labsList: Array<Resource['lab']> = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

export let allAdminMockResources: Resource[] = [
  {
    id: 'res1',
    name: 'Keysight MSOX3054T Oscilloscope',
    resourceTypeId: 'rt1',
    resourceTypeName: 'Oscilloscope',
    lab: 'Electronics Lab 1',
    status: 'Available',
    manufacturer: 'Keysight Technologies',
    model: 'MSOX3054T',
    serialNumber: 'MY58012345',
    purchaseDate: '2022-08-15T00:00:00.000Z',
    description: 'Mixed Signal Oscilloscope with 500 MHz bandwidth, 4 analog channels, and 16 digital channels. Includes built-in waveform generator and serial protocol analysis capabilities. Ideal for debugging embedded systems and mixed-signal designs.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['500 MHz Bandwidth', '4 Analog Channels', '16 Digital Channels', 'WaveGen', 'Serial Decode'],
    availability: [
      { date: todayStr, slots: ['09:00-12:00', '13:00-17:00'] },
      { date: tomorrowStr, slots: ['09:00-12:00', '13:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['09:00-17:00'] },
    ],
    unavailabilityPeriods: [
      { id: 'unavail1-1', startDate: format(addDays(today, 15), 'yyyy-MM-dd'), endDate: format(addDays(today, 20), 'yyyy-MM-dd'), reason: 'Annual Calibration' }
    ],
    notes: 'Standard probe set included. High-voltage differential probe in cabinet 3.',
    remoteAccess: {
      hostname: 'scope-01.lab.internal',
      protocol: 'VNC',
      notes: 'Access via internal network. Web interface also available at IP.'
    },
    allowQueueing: true,
  },
  {
    id: 'res2',
    name: 'Rigol DP832 Programmable Power Supply',
    resourceTypeId: 'rt2',
    resourceTypeName: 'Power Supply',
    lab: 'Electronics Lab 1',
    status: 'Available',
    manufacturer: 'Rigol Technologies',
    model: 'DP832',
    serialNumber: 'DP8C198765',
    purchaseDate: '2023-01-20T00:00:00.000Z',
    description: 'Triple output programmable DC power supply. CH1: 0-30V/0-3A, CH2: 0-30V/0-3A, CH3: 0-5V/0-3A. High resolution and remote sense capabilities.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['3 Channels', 'Programmable', 'Overvoltage Protection', 'LAN Interface'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-17:00'] }
    ],
    unavailabilityPeriods: [],
    notes: 'Ensure load is disconnected before changing voltage settings.',
    allowQueueing: false,
  },
   {
    id: 'res3',
    name: 'Siglent SDG2042X Function Generator',
    resourceTypeId: 'rt3',
    resourceTypeName: 'Function Generator',
    lab: 'RF Lab',
    status: 'Maintenance',
    manufacturer: 'Siglent Technologies',
    model: 'SDG2042X',
    serialNumber: 'SDG2XABC001',
    purchaseDate: '2021-05-10T00:00:00.000Z',
    description: 'Dual-channel Arbitrary Waveform Generator, 40 MHz bandwidth, 1.2 GSa/s sampling rate. Generates sine, square, ramp, pulse, noise, and arbitrary waveforms.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['40 MHz Bandwidth', 'Dual Channel', 'Arbitrary Waveforms', 'IQ Modulation'],
    availability: [],
    unavailabilityPeriods: [
       { id: 'unavail3-1', startDate: todayStr, endDate: nextWeekStr, reason: 'Output Amplifier Repair' }
    ],
    notes: 'Output amplifier stage under repair. Expected back online next week.',
    allowQueueing: true,
  },
  {
    id: 'res4',
    name: 'Rohde & Schwarz FPC1500 Spectrum Analyzer',
    resourceTypeId: 'rt4',
    resourceTypeName: 'Spectrum Analyzer',
    lab: 'RF Lab',
    status: 'Available',
    manufacturer: 'Rohde & Schwarz',
    model: 'FPC1500',
    serialNumber: 'RS-FPC-987',
    purchaseDate: '2023-06-05T00:00:00.000Z',
    description: 'Spectrum analyzer with frequency range from 5 kHz to 1 GHz (upgradable to 3 GHz). Includes tracking generator and internal VSWR bridge.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['1 GHz Base Frequency', 'Tracking Generator', 'One-Port Vector Network Analyzer'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-12:00', '14:00-16:00'] }
    ],
    unavailabilityPeriods: [],
    allowQueueing: false,
  },
  {
    id: 'res5',
    name: 'Weller WE1010NA Digital Soldering Station',
    resourceTypeId: 'rt6',
    resourceTypeName: 'Soldering Station',
    lab: 'Prototyping Lab',
    status: 'Available',
    manufacturer: 'Weller',
    model: 'WE1010NA',
    serialNumber: 'WEL-WE-007A',
    purchaseDate: '2022-11-01T00:00:00.000Z',
    description: '70W digital soldering station with temperature control and standby mode. Suitable for general purpose and fine pitch soldering work.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['70 Watt Power', 'Digital Temperature Control', 'ESD Safe', 'Interchangeable Tips'],
    availability: [
        { date: todayStr, slots: ['10:00-17:00'] },
        { date: tomorrowStr, slots: ['10:00-17:00'] },
    ],
    unavailabilityPeriods: [],
    notes: 'Variety of tips available in the labeled drawer. Please clean tip after use.',
    allowQueueing: true,
  },
  {
    id: 'res6',
    name: 'Fluke 87V Industrial Multimeter',
    resourceTypeId: 'rt5',
    resourceTypeName: 'Digital Multimeter (DMM)',
    lab: 'General Test Area',
    status: 'Available',
    manufacturer: 'Fluke Corporation',
    model: '87V',
    serialNumber: 'FLUKE-87V-011',
    purchaseDate: '2023-03-10T00:00:00.000Z',
    description: 'True-RMS industrial digital multimeter for accurate measurements on non-linear signals. Measures AC/DC voltage and current, resistance, capacitance, frequency.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['True-RMS AC Voltage/Current', 'Temperature Measurement (with probe)', 'CAT III 1000V, CAT IV 600V Safety Rating'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['09:00-17:00'] }
    ],
    unavailabilityPeriods: [],
    allowQueueing: true,
  },
  {
    id: 'res7',
    name: 'FPGA Dev Node Alpha',
    resourceTypeId: 'rt12',
    resourceTypeName: 'FPGA Dev Node',
    lab: 'Electronics Lab 1',
    status: 'Available',
    manufacturer: 'Xilinx',
    model: 'Alveo U250',
    serialNumber: 'XALV-U250-001',
    purchaseDate: '2023-09-01T00:00:00.000Z',
    description: 'High-performance FPGA development node for hardware acceleration and prototyping complex digital systems.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['High-Speed Transceivers', 'Large Logic Capacity', 'PCIe Gen3 x16'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: tomorrowStr, slots: ['09:00-13:00', '14:00-17:00'] }
    ],
    unavailabilityPeriods: [
      { id: 'unavail7-1', startDate: tenDaysLaterStr, endDate: format(addDays(today, 12), 'yyyy-MM-dd'), reason: 'Firmware Upgrade Window' }
    ],
    notes: 'Requires Vivado Design Suite. Remote access configured.',
    remoteAccess: {
      ipAddress: '192.168.1.105',
      hostname: 'fpga-node-alpha.lab.internal',
      protocol: 'SSH',
      username: 'devuser',
      port: 22,
      notes: 'SSH key authentication required. Contact admin for access.'
    },
    allowQueueing: true,
  },
  {
    id: 'res8',
    name: 'Ocean Optics Flame Spectrometer',
    resourceTypeId: 'rt11',
    resourceTypeName: 'Spectrometer',
    lab: 'RF Lab',
    status: 'Available',
    manufacturer: 'Ocean Optics',
    model: 'Flame-S-VIS-NIR',
    serialNumber: 'FLMS12345',
    purchaseDate: '2022-07-20T00:00:00.000Z',
    description: 'Compact spectrometer for VIS-NIR measurements (350-1000 nm). Ideal for absorbance, transmittance, and irradiance.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['350-1000 nm Range', 'High Resolution', 'USB Interface', 'Compact Size'],
    availability: [
      { date: threeDaysLaterStr, slots: ['10:00-12:00', '13:00-16:00'] },
      { date: fourDaysLaterStr, slots: ['09:00-17:00'] }
    ],
    unavailabilityPeriods: [],
    allowQueueing: false,
  }
];

export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];

// initialMockUsers is now primarily for seeding Firestore upon first app run or for local dev without persistence.
// The AuthContext will handle actual user state.
export let initialMockUsers: User[] = [
  // This user will be created by Firebase Auth and Firestore on first signup
  // { id: 'firebase-admin-uid', name: 'Admin User', email: 'admin@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
  // { id: 'firebase-manager-uid', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
  // { id: 'firebase-tech-uid', name: 'Technician Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
  // { id: 'firebase-researcher-uid', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
  // { id: 'firebase-leadtech-uid', name: 'Lead Technician Fifth', email: 'lead.tech@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
  // { id: 'firebase-penny-uid', name: 'Penny Pending', email: 'penny@example.com', role: 'Researcher', status: 'pending_approval', avatarUrl: 'https://placehold.co/100x100.png', createdAt: new Date().toISOString() },
  // { id: 'firebase-walter-uid', name: 'Walter Waitlist', email: 'walter@example.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png', status: 'active', createdAt: new Date().toISOString() },
];


export let initialBookings: Booking[] = [
  {
    id: 'b1',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: 'firebase-researcher-uid', // Example UID
    userName: 'Researcher Fourth',
    startTime: set(parseISO(tomorrowStr), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(parseISO(tomorrowStr), { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(parseISO(yesterdayStr), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Confirmed',
    notes: 'Debugging SPI communication on custom MCU board for Project Alpha.',
  },
  {
    id: 'b1_wait1',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: 'firebase-walter-uid', // Example UID
    userName: 'Walter Waitlist',
    startTime: set(parseISO(tomorrowStr), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(parseISO(tomorrowStr), { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(parseISO(yesterdayStr), { hours: 10, minutes: 5, seconds: 0, milliseconds: 0 }),
    status: 'Waitlisted',
    notes: 'Hoping to get on the scope if b1 cancels for Project Gamma.',
  },
  {
    id: 'b1_wait2',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: 'firebase-manager-uid', // Example UID
    userName: 'Dr. Manager Second',
    startTime: set(parseISO(tomorrowStr), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(parseISO(tomorrowStr), { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(parseISO(yesterdayStr), { hours: 10, minutes: 10, seconds: 0, milliseconds: 0 }),
    status: 'Waitlisted',
    notes: 'Follow-up measurements for Project Alpha.',
  },
  {
    id: 'b2',
    resourceId: 'res2',
    resourceName: 'Rigol DP832 Programmable Power Supply',
    userId: 'firebase-manager-uid', // Example UID
    userName: 'Dr. Manager Second',
    startTime: set(addDays(today, 3), { hours: 14, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 3), { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(addDays(today,1), {hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Powering up prototype device for thermal testing with new heatsink design.'
  },
  {
    id: 'b4',
    resourceId: 'res4',
    resourceName: 'Rohde & Schwarz FPC1500 Spectrum Analyzer',
    userId: 'firebase-researcher-uid', // Example UID
    userName: 'Researcher Fourth',
    startTime: set(today, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(today, { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(subDays(today, 1), { hours: 14, minutes: 30, seconds: 0, milliseconds: 0 }),
    status: 'Confirmed',
    notes: 'Antenna matching and S11 parameter measurement for Project Beta.'
  },
  {
    id: 'b5',
    resourceId: 'res5',
    resourceName: 'Weller WE1010NA Digital Soldering Station',
    userId: 'firebase-manager-uid', // Example UID
    userName: 'Dr. Manager Second',
    startTime: set(addDays(today, 5), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 5), { hours: 13, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(addDays(today, 2), { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Reworking BGA component on development board Gamma-03.'
  },
  {
    id: 'b6',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: 'firebase-researcher-uid', // Example UID
    userName: 'Researcher Fourth',
    startTime: set(subDays(today, 1), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(subDays(today, 1), { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }),
    createdAt: set(subDays(today, 3), { hours: 9, minutes: 15, seconds: 0, milliseconds: 0 }),
    status: 'Confirmed',
    notes: 'Past booking: Verifying I2C signals between sensor and MCU on Project Delta.',
    usageDetails: {
        actualStartTime: set(subDays(today, 1), { hours: 10, minutes: 2, seconds: 0, milliseconds: 0 }).toISOString(),
        actualEndTime: set(subDays(today, 1), { hours: 11, minutes: 45, seconds: 0, milliseconds: 0 }).toISOString(),
        outcome: 'Success',
        dataStorageLocation: 'N/A - visual inspection only',
        usageComments: 'I2C communication verified. ACK signal present. All good.'
    }
  },
  {
    id: 'b7',
    resourceId: 'res7',
    resourceName: 'FPGA Dev Node Alpha',
    userId: 'firebase-researcher-uid', // Example UID
    userName: 'Researcher Fourth',
    startTime: set(addDays(today, 4), { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 4), { hours: 15, minutes: 30, seconds: 0, milliseconds: 0 }),
    createdAt: set(addDays(today, 1), { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Need to test new HDL core for signal processing acceleration. Synthesis complete.'
  },
];

export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];


export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export let initialMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'mr1',
    resourceId: 'res3',
    resourceName: 'Siglent SDG2042X Function Generator',
    reportedByUserId: 'firebase-researcher-uid', // Example UID
    reportedByUserName: 'Researcher Fourth',
    issueDescription: 'Channel 2 output is unstable and showing significant noise above 20 MHz. Amplitude is also inconsistent. Suspect faulty output amplifier.',
    status: 'In Progress',
    assignedTechnicianId: 'firebase-tech-uid', // Example UID
    assignedTechnicianName: 'Technician Third',
    dateReported: subDays(today, 5).toISOString(),
    resolutionNotes: 'Replaced output amplifier IC (Part# XYZ123) for Channel 2. Currently undergoing post-repair calibration and testing.'
  },
  {
    id: 'mr2',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    reportedByUserId: 'firebase-manager-uid', // Example UID
    reportedByUserName: 'Dr. Manager Second',
    issueDescription: 'The touchscreen is unresponsive in the lower-left quadrant. Makes it difficult to access some menus. Restart did not fix.',
    status: 'Open',
    dateReported: subDays(today, 2).toISOString(),
  },
  {
    id: 'mr3',
    resourceId: 'res5',
    resourceName: 'Weller WE1010NA Digital Soldering Station',
    reportedByUserId: 'firebase-tech-uid', // Example UID
    reportedByUserName: 'Technician Third',
    issueDescription: 'Heating element failed. Station does not heat up to set temperature. Error E1 on display.',
    status: 'Resolved',
    assignedTechnicianId: 'firebase-leadtech-uid', // Example UID
    assignedTechnicianName: 'Lead Technician Fifth',
    dateReported: subDays(today, 10).toISOString(),
    dateResolved: subDays(today, 8).toISOString(),
    resolutionNotes: 'Replaced heating element and thermocouple sensor. Tested temperature accuracy across range. Confirmed working correctly.'
  },
];

export let initialNotifications: Notification[] = [
  {
    id: 'n1',
    userId: 'firebase-researcher-uid', // Researcher Fourth
    title: 'Booking Confirmed: Keysight Scope',
    message: 'Your booking for Keysight MSOX3054T Oscilloscope on ' + format(set(parseISO(tomorrowStr), { hours: 9, minutes: 0 }), 'MMM dd, HH:mm') + ' has been confirmed.',
    type: 'booking_confirmed',
    isRead: false,
    createdAt: new Date().toISOString(),
    linkTo: `/bookings?bookingId=b1`,
  },
  // Note: Admin 'signup_pending_admin' notifications will be generated dynamically by AuthContext on signup
  {
    id: 'n3',
    userId: 'firebase-tech-uid', // Technician Third
    title: 'Maintenance Assigned: Siglent SDG2042X',
    message: 'You have been assigned the maintenance task for Siglent SDG2042X (Channel 2 output unstable).',
    type: 'maintenance_assigned',
    isRead: true,
    createdAt: subDays(new Date(), 2).toISOString(),
    linkTo: '/maintenance',
  },
];

export function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
) {
  const newNotification: Notification = {
    id: `n${initialNotifications.length + 1 + Date.now()}`,
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    linkTo,
  };
  initialNotifications.unshift(newNotification);
}

export let initialAuditLogs: AuditLogEntry[] = [
    {
        id: `log-${Date.now() - 100000}`,
        timestamp: subDays(today, 1).toISOString(),
        userId: 'firebase-admin-uid', // Example UID
        userName: 'Admin User',
        action: 'RESOURCE_CREATED',
        entityType: 'Resource',
        entityId: 'res1',
        details: "Admin User created resource 'Keysight MSOX3054T Oscilloscope'."
    },
    {
        id: `log-${Date.now() - 90000}`,
        timestamp: new Date().toISOString(),
        userId: 'firebase-researcher-uid', // Example UID
        userName: 'Researcher Fourth',
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: 'b1',
        details: "Researcher Fourth created booking for 'Keysight MSOX3054T Oscilloscope'."
    }
];

export function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
) {
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  initialAuditLogs.unshift(newLog);
}

export function getWaitlistPosition(booking: Booking, allBookings: Booking[]): number | null {
  if (booking.status !== 'Waitlisted' || !booking.createdAt) {
    return null;
  }

  const conflictingWaitlistedBookings = allBookings.filter(b =>
    b.resourceId === booking.resourceId &&
    b.status === 'Waitlisted' &&
    b.createdAt && 
    (b.startTime < booking.endTime && b.endTime > booking.startTime) 
  );
  
  const sortedWaitlist = conflictingWaitlistedBookings
    .filter(b => b.createdAt) 
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const positionIndex = sortedWaitlist.findIndex(b => b.id === booking.id);
  
  return positionIndex !== -1 ? positionIndex + 1 : null;
}


export function processQueueForResource(resourceId: string): void {
  const resource = allAdminMockResources.find(r => r.id === resourceId);
  if (!resource || !resource.allowQueueing) {
    return;
  }

  const waitlistedBookingsForResource = initialBookings
    .filter(b => b.resourceId === resourceId && b.status === 'Waitlisted' && b.createdAt)
    .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

  if (waitlistedBookingsForResource.length > 0) {
    const bookingToPromote = waitlistedBookingsForResource[0];
    const bookingIndexInGlobal = initialBookings.findIndex(b => b.id === bookingToPromote.id);

    if (bookingIndexInGlobal !== -1) {
      const promoteStartTime = new Date(bookingToPromote.startTime);
      const promoteEndTime = new Date(bookingToPromote.endTime);

      const conflictingActiveBooking = initialBookings.find(existingBooking => {
        if (existingBooking.id === bookingToPromote.id) return false;
        if (existingBooking.resourceId !== resourceId) return false;
        if (existingBooking.status === 'Cancelled' || existingBooking.status === 'Waitlisted') return false;
        
        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        return (promoteStartTime < existingEndTime && promoteEndTime > existingStartTime);
      });

      if (conflictingActiveBooking) {
        console.log(`QUEUE_PROCESS: Cannot promote booking ${bookingToPromote.id}. Slot still blocked by active booking ${conflictingActiveBooking.id}.`);
        return; 
      }

      initialBookings[bookingIndexInGlobal].status = 'Pending';
      addAuditLog(
        'SYSTEM_QUEUE',
        'System',
        'BOOKING_PROMOTED',
        { entityType: 'Booking', entityId: bookingToPromote.id, details: `Booking for '${bookingToPromote.resourceName}' by ${bookingToPromote.userName} promoted from waitlist to Pending.` }
      );
      addNotification(
        bookingToPromote.userId,
        'Promoted from Waitlist!',
        `Your waitlisted booking for ${bookingToPromote.resourceName} on ${format(promoteStartTime, 'MMM dd, HH:mm')} has been promoted and is now pending approval. Please check your bookings.`,
        'booking_promoted_user',
        `/bookings?bookingId=${bookingToPromote.id}`
      );

      // For now, assuming 'u1' is an admin/manager. In a real app, find appropriate roles.
      const adminUserId = 'firebase-admin-uid'; // Example Admin UID
      addNotification(
        adminUserId,
        'Booking Promoted from Waitlist',
        `Waitlisted booking for ${bookingToPromote.resourceName} by ${bookingToPromote.userName} on ${format(promoteStartTime, 'MMM dd, HH:mm')} has been promoted to Pending and requires your approval.`,
        'booking_promoted_admin',
        '/admin/booking-requests'
      );
    }
  }
}

export let initialBlackoutDates: BlackoutDate[] = [
  { id: 'bo1', date: format(addDays(today, 25), 'yyyy-MM-dd'), reason: 'Lab Deep Cleaning Day' },
  { id: 'bo2', date: format(addDays(today, 60), 'yyyy-MM-dd'), reason: 'Public Holiday - Lab Closed' },
];

export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [
  { id: 'rb1', name: 'Weekend Closure', daysOfWeek: ['Saturday', 'Sunday'], reason: 'Lab closed on weekends' },
  { id: 'rb2', name: 'Weekly Maintenance Window (Fridays PM)', daysOfWeek: ['Friday'], reason: 'Scheduled maintenance from 13:00-17:00' },
];
