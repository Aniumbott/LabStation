
import type { Resource, ResourceType, ResourceStatus, RoleName, User, Booking } from '@/types';
import { format, addDays, set } from 'date-fns';

// For Resource Availability
const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

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

export const allAdminMockResources: Resource[] = [
  {
    id: '1',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['500 MHz Bandwidth', '4 Analog Channels', '16 Digital Channels', 'WaveGen', 'Serial Decode'],
    availability: [
      { date: todayStr, slots: ['14:00-16:00', '16:00-18:00'] },
      { date: tomorrowStr, slots: ['10:00-12:00'] }
    ],
    notes: 'Standard probe set included. High-voltage differential probe in cabinet 3.',
    remoteAccess: {
      hostname: 'scope-01.lab.internal',
      protocol: 'VNC',
      notes: 'Access via internal network. Web interface also available at IP.'
    }
  },
  {
    id: '2',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['3 Channels', 'Programmable', 'Overvoltage Protection', 'LAN Interface'],
    availability: [
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-17:00'] }
    ],
    notes: 'Ensure load is disconnected before changing voltage settings.'
  },
   {
    id: '3',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['40 MHz Bandwidth', 'Dual Channel', 'Arbitrary Waveforms', 'IQ Modulation'],
    availability: [],
    notes: 'Output amplifier stage under repair. Expected back online next week.'
  },
  {
    id: '4',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['1 GHz Base Frequency', 'Tracking Generator', 'One-Port Vector Network Analyzer'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-12:00', '14:00-16:00'] }
    ]
  },
  {
    id: 'rt6-instance',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['70 Watt Power', 'Digital Temperature Control', 'ESD Safe', 'Interchangeable Tips'],
    availability: [
        { date: todayStr, slots: ['10:00-17:00'] },
        { date: tomorrowStr, slots: ['10:00-17:00'] },
    ],
    notes: 'Variety of tips available in the labeled drawer. Please clean tip after use.'
  },
  {
    id: 'rt5-instance',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['True-RMS AC Voltage/Current', 'Temperature Measurement (with probe)', 'CAT III 1000V, CAT IV 600V Safety Rating'],
    availability: [
      { date: dayAfterTomorrowStr, slots: ['Full Day Booked'] }
    ],
    notes: 'Includes standard test leads and thermocouple probe.'
  },
  {
    id: 'rt12-instance',
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
    imageUrl: 'https://placehold.co/300x200.png',
    features: ['High-Speed Transceivers', 'Large Logic Capacity', 'PCIe Gen3 x16'],
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: tomorrowStr, slots: ['09:00-13:00', '14:00-17:00'] }
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
];


// Mock Current User (used across Bookings, Resource Details, Dashboard)
export const mockCurrentUser: User = {
  id: 'u4', // Matched to an existing user in mockUsers for consistency
  name: 'Researcher Fourth', // This name will be used in BookingForm
  email: 'researcher.fourth@labstation.com',
  role: 'Researcher' as RoleName,
};

// Initial Bookings (used across Bookings, Resource Details, Dashboard)
export const initialBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Keysight MSOX3054T Oscilloscope', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 12, 0), status: 'Confirmed', notes: 'Debugging SPI communication on custom MCU board.' },
  { id: 'b2', resourceId: '2', resourceName: 'Rigol DP832 Programmable Power Supply', userId: 'u2', userName: 'Dr. Manager Second', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 16, 0), status: 'Pending', notes: 'Powering up prototype device for thermal testing.' },
  { id: 'b3', resourceId: '1', resourceName: 'Keysight MSOX3054T Oscilloscope', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 15, 0), status: 'Confirmed', notes: 'Quick check of clock signal jitter. High priority for RF module.' },
  { id: 'b4', resourceId: '4', resourceName: 'Rohde & Schwarz FPC1500 Spectrum Analyzer', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 9, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 11, 0), status: 'Confirmed', notes: 'Antenna matching and S11 parameter measurement for new design.' },
  { id: 'b5', resourceId: 'rt6-instance', resourceName: 'Weller WE1010NA Digital Soldering Station', userId: 'u2', userName: 'Dr. Manager Second', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 5, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 5, 13, 0), status: 'Pending', notes: 'Reworking BGA component on development board.' },
  { id: 'b6', resourceId: '1', resourceName: 'Keysight MSOX3054T Oscilloscope', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1, 12, 0), status: 'Confirmed', notes: 'Past booking: Verifying I2C signals between sensor and MCU.' },
];
