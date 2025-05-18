
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { format, addDays } from 'date-fns';

// For Resource Availability
const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

// For ResourceTypeFormDialog and Resource Search Filters
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
];

// For ResourceFormDialog
export const labsList: Resource['lab'][] = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

// For Manage Resources Page, Resource Detail Page, and Dashboard
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
    purchaseDate: '2022-08-15',
    description: 'Mixed Signal Oscilloscope with 500 MHz bandwidth, 4 analog channels, and 16 digital channels. Includes built-in waveform generator and serial protocol analysis capabilities. Ideal for debugging embedded systems and mixed-signal designs.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'oscilloscope electronics',
    features: ['500 MHz Bandwidth', '4 Analog Channels', '16 Digital Channels', 'WaveGen', 'Serial Decode'],
    lastCalibration: '2023-12-01',
    nextCalibration: '2024-12-01',
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
    purchaseDate: '2023-01-20',
    description: 'Triple output programmable DC power supply. CH1: 0-30V/0-3A, CH2: 0-30V/0-3A, CH3: 0-5V/0-3A. High resolution and remote sense capabilities.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'power supply lab',
    features: ['3 Channels', 'Programmable', 'Overvoltage Protection', 'LAN Interface'],
    lastCalibration: '2024-01-15',
    nextCalibration: '2025-01-15',
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
    purchaseDate: '2021-05-10',
    description: 'Dual-channel Arbitrary Waveform Generator, 40 MHz bandwidth, 1.2 GSa/s sampling rate. Generates sine, square, ramp, pulse, noise, and arbitrary waveforms.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'function generator electronics',
    features: ['40 MHz Bandwidth', 'Dual Channel', 'Arbitrary Waveforms', 'IQ Modulation'],
    lastCalibration: '2023-11-10',
    nextCalibration: '2024-11-10', // Extended maintenance
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
    purchaseDate: '2023-06-05',
    description: 'Spectrum analyzer with frequency range from 5 kHz to 1 GHz (upgradable to 3 GHz). Includes tracking generator and internal VSWR bridge.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'spectrum analyzer rf',
    features: ['1 GHz Base Frequency', 'Tracking Generator', 'One-Port Vector Network Analyzer'],
    lastCalibration: '2024-02-20',
    nextCalibration: '2025-02-20',
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
    purchaseDate: '2022-11-01',
    description: '70W digital soldering station with temperature control and standby mode. Suitable for general purpose and fine pitch soldering work.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'soldering station circuit',
    features: ['70 Watt Power', 'Digital Temperature Control', 'ESD Safe', 'Interchangeable Tips'],
    lastCalibration: 'N/A',
    nextCalibration: 'N/A',
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
    purchaseDate: '2023-03-10',
    description: 'True-RMS industrial digital multimeter for accurate measurements on non-linear signals. Measures AC/DC voltage and current, resistance, capacitance, frequency.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'multimeter electronics',
    features: ['True-RMS AC Voltage/Current', 'Temperature Measurement (with probe)', 'CAT III 1000V, CAT IV 600V Safety Rating'],
    lastCalibration: '2024-03-01',
    nextCalibration: '2025-03-01',
    availability: [
      { date: dayAfterTomorrowStr, slots: ['Full Day Booked'] }
    ],
    notes: 'Includes standard test leads and thermocouple probe.'
  }
];
