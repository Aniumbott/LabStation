
import type { Resource, ResourceType, ResourceStatus, RoleName, User, Booking, MaintenanceRequest, MaintenanceRequestStatus, Notification, NotificationType, UnavailabilityPeriod, AvailabilitySlot, BookingUsageDetails } from '@/types';
import { format, addDays, set, subDays, parseISO } from 'date-fns';

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


export const initialMockResourceTypes: ResourceType[] = [
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
  { id: 'rt12', name: 'FPGA Dev Node', description: 'Field-Programmable Gate Array development node for hardware acceleration tasks.'},
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
      { date: todayStr, slots: ['14:00-16:00', '16:00-18:00'] },
      { date: tomorrowStr, slots: ['10:00-12:00', '09:00-17:00'] }
    ],
    unavailabilityPeriods: [
      { id: 'unavail1-1', startDate: format(addDays(today, 15), 'yyyy-MM-dd'), endDate: format(addDays(today, 20), 'yyyy-MM-dd'), reason: 'Annual Calibration' }
    ],
    notes: 'Standard probe set included. High-voltage differential probe in cabinet 3.',
    remoteAccess: {
      hostname: 'scope-01.lab.internal',
      protocol: 'VNC',
      notes: 'Access via internal network. Web interface also available at IP.'
    }
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
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-17:00'] }
    ],
    unavailabilityPeriods: [],
    notes: 'Ensure load is disconnected before changing voltage settings.'
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
    notes: 'Output amplifier stage under repair. Expected back online next week.'
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
    notes: 'Variety of tips available in the labeled drawer. Please clean tip after use.'
  },
  {
    id: 'res6',
    name: 'Fluke 87V Industrial Multimeter',
    resourceTypeId: 'rt5',
    resourceTypeName: 'Digital Multimeter (DMM)',
    lab: 'General Test Area',
    status: 'Booked',
    manufacturer: 'Fluke Corporation',
    model: '87V',
    serialNumber: 'FLUKE-87V-011',
    purchaseDate: '2023-03-10T00:00:00.000Z',
    description: 'True-RMS industrial digital multimeter for accurate measurements on non-linear signals. Measures AC/DC voltage and current, resistance, capacitance, frequency.',
    imageUrl: 'https://placehold.co/600x400.png',
    features: ['True-RMS AC Voltage/Current', 'Temperature Measurement (with probe)', 'CAT III 1000V, CAT IV 600V Safety Rating'],
    availability: [
      { date: dayAfterTomorrowStr, slots: ['09:00-17:00'] }
    ],
    unavailabilityPeriods: [],
    notes: 'Includes standard test leads and thermocouple probe.'
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
    }
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
    notes: 'OceanView software installed on connected PC. Fiber optic cables in drawer.'
  }
];

export const initialMockUsers: User[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u2', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u3', name: 'Technician Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u4', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u5', name: 'Lead Technician Fifth', email: 'lead.tech@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png' },
];

export const mockCurrentUser: User = initialMockUsers[3]; // Researcher Fourth

export let initialBookings: Booking[] = [
  {
    id: 'b1',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: mockCurrentUser.id,
    userName: mockCurrentUser.name,
    startTime: set(addDays(today, 2), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 2), { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Confirmed',
    notes: 'Debugging SPI communication on custom MCU board for Project Alpha.',
    usageDetails: { // Example for a future completed booking
        actualStartTime: set(addDays(today, 2), { hours: 10, minutes: 5, seconds: 0, milliseconds: 0 }).toISOString(),
        actualEndTime: set(addDays(today, 2), { hours: 11, minutes: 55, seconds: 0, milliseconds: 0 }).toISOString(),
        outcome: 'Success',
        dataStorageLocation: '/project_alpha/spi_debug_run1/',
        usageComments: 'Successfully captured SPI traces. Issue identified in CS line timing.'
    }
  },
  {
    id: 'b2',
    resourceId: 'res2',
    resourceName: 'Rigol DP832 Programmable Power Supply',
    userId: 'u2', // Dr. Manager Second
    userName: initialMockUsers[1].name,
    startTime: set(addDays(today, 3), { hours: 14, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 3), { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Powering up prototype device for thermal testing with new heatsink design.'
  },
  {
    id: 'b3',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: mockCurrentUser.id,
    userName: mockCurrentUser.name,
    startTime: set(addDays(today, 1), { hours: 14, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 1), { hours: 15, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Quick check of clock signal jitter for new RF module. High priority.'
  },
  {
    id: 'b4',
    resourceId: 'res4',
    resourceName: 'Rohde & Schwarz FPC1500 Spectrum Analyzer',
    userId: mockCurrentUser.id,
    userName: mockCurrentUser.name,
    startTime: set(today, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(today, { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Confirmed',
    notes: 'Antenna matching and S11 parameter measurement for Project Beta.'
  },
  {
    id: 'b5',
    resourceId: 'res5',
    resourceName: 'Weller WE1010NA Digital Soldering Station',
    userId: 'u2', // Dr. Manager Second
    userName: initialMockUsers[1].name,
    startTime: set(addDays(today, 5), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 5), { hours: 13, minutes: 0, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Reworking BGA component on development board Gamma-03.'
  },
  {
    id: 'b6',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    userId: mockCurrentUser.id,
    userName: mockCurrentUser.name,
    startTime: set(subDays(today, 1), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(subDays(today, 1), { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }),
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
    userId: mockCurrentUser.id,
    userName: mockCurrentUser.name,
    startTime: set(addDays(today, 4), { hours: 11, minutes: 0, seconds: 0, milliseconds: 0 }),
    endTime: set(addDays(today, 4), { hours: 15, minutes: 30, seconds: 0, milliseconds: 0 }),
    status: 'Pending',
    notes: 'Need to test new HDL core for signal processing acceleration. Synthesis complete.'
  },
];

export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export let initialMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'mr1',
    resourceId: 'res3',
    resourceName: 'Siglent SDG2042X Function Generator',
    reportedByUserId: 'u4',
    reportedByUserName: initialMockUsers[3].name,
    issueDescription: 'Channel 2 output is unstable and showing significant noise above 20 MHz. Amplitude is also inconsistent. Suspect faulty output amplifier.',
    status: 'In Progress',
    assignedTechnicianId: 'u3',
    assignedTechnicianName: initialMockUsers[2].name,
    dateReported: subDays(today, 5).toISOString(),
    resolutionNotes: 'Replaced output amplifier IC (Part# XYZ123) for Channel 2. Currently undergoing post-repair calibration and testing.'
  },
  {
    id: 'mr2',
    resourceId: 'res1',
    resourceName: 'Keysight MSOX3054T Oscilloscope',
    reportedByUserId: 'u2',
    reportedByUserName: initialMockUsers[1].name,
    issueDescription: 'The touchscreen is unresponsive in the lower-left quadrant. Makes it difficult to access some menus. Restart did not fix.',
    status: 'Open',
    dateReported: subDays(today, 2).toISOString(),
  },
  {
    id: 'mr3',
    resourceId: 'res5',
    resourceName: 'Weller WE1010NA Digital Soldering Station',
    reportedByUserId: 'u3',
    reportedByUserName: initialMockUsers[2].name,
    issueDescription: 'Heating element failed. Station does not heat up to set temperature. Error E1 on display.',
    status: 'Resolved',
    assignedTechnicianId: 'u5',
    assignedTechnicianName: initialMockUsers[4].name,
    dateReported: subDays(today, 10).toISOString(),
    dateResolved: subDays(today, 8).toISOString(),
    resolutionNotes: 'Replaced heating element and thermocouple sensor. Tested temperature accuracy across range. Confirmed working correctly.'
  },
];

export let initialNotifications: Notification[] = [
  {
    id: 'n1',
    userId: mockCurrentUser.id,
    title: 'Booking Confirmed: Keysight Scope',
    message: 'Your booking for Keysight MSOX3054T Oscilloscope on ' + format(set(addDays(today, 2), { hours: 10, minutes: 0 }), 'MMM dd, HH:mm') + ' has been confirmed.',
    type: 'booking_confirmed',
    isRead: false,
    createdAt: subDays(today, 0).toISOString(),
    linkTo: `/bookings?bookingId=b1&date=${format(set(addDays(today, 2), { hours: 10, minutes: 0 }), 'yyyy-MM-dd')}`,
  },
  {
    id: 'n2',
    userId: mockCurrentUser.id,
    title: 'Maintenance Update: Siglent SDG2042X',
    message: 'Maintenance request for Siglent SDG2042X Function Generator (Channel 2 output unstable) is now "In Progress". Technician Third assigned.',
    type: 'maintenance_assigned',
    isRead: true,
    createdAt: subDays(today, 1).toISOString(),
    linkTo: '/maintenance',
  },
  {
    id: 'n3',
    userId: mockCurrentUser.id,
    title: 'Booking Request: Spectrum Analyzer',
    message: 'Your booking request for Rohde & Schwarz FPC1500 Spectrum Analyzer on ' + format(set(today, { hours: 9, minutes: 0 }), 'MMM dd, HH:mm') + ' is awaiting approval.',
    type: 'booking_pending_approval',
    isRead: false,
    createdAt: subDays(today, 2).toISOString(),
    linkTo: `/bookings?bookingId=b4&date=${format(set(today, { hours: 9, minutes: 0 }), 'yyyy-MM-dd')}`,
  },
  {
    id: 'n4',
    userId: 'u1', // For Admin User
    title: 'New Maintenance Request Logged',
    message: 'A new maintenance request for Keysight MSOX3054T Oscilloscope (touchscreen unresponsive) has been logged by Dr. Manager Second.',
    type: 'maintenance_new',
    isRead: true,
    createdAt: subDays(today, 3).toISOString(),
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
