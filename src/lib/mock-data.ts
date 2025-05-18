
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { format, addDays } from 'date-fns';

// For Resource Availability
const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

// For ResourceTypeFormDialog and Resource Search Filters
export const initialMockResourceTypes: ResourceType[] = [
  { id: 'rt1', name: 'Microscope', description: 'Optical and electron microscopes for various imaging needs.' },
  { id: 'rt2', name: 'Centrifuge', description: 'For separating substances of different densities.' },
  { id: 'rt3', name: 'HPLC System', description: 'High-Performance Liquid Chromatography systems.' },
  { id: 'rt4', name: 'Incubator', description: 'Controlled environment for biological cultures.' },
  { id: 'rt5', name: 'Fume Hood', description: 'Ventilated enclosure for safe handling of hazardous materials.' },
  { id: 'rt6', name: 'Spectrometer', description: 'Measures properties of light over a specific portion of the electromagnetic spectrum.' },
  { id: 'rt7', name: '3D Printer', description: 'For additive manufacturing and rapid prototyping.' },
  { id: 'rt8', name: 'FPGA Node', description: 'Field-Programmable Gate Array development boards/nodes.' },
];

// For ResourceFormDialog
export const labsList: Resource['lab'][] = ['Lab A', 'Lab B', 'Lab C', 'General Lab'];
export const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

// For Manage Resources Page, Resource Detail Page, and Dashboard
export const allAdminMockResources: Resource[] = [
  {
    id: '1',
    name: 'Electron Microscope Alpha',
    resourceTypeId: 'rt1',
    resourceTypeName: 'Microscope',
    lab: 'Lab A',
    status: 'Available',
    manufacturer: 'Thermo Fisher Scientific',
    model: 'Quanta SEM',
    serialNumber: 'SN-EMA-001',
    purchaseDate: '2022-08-15',
    description: 'High-resolution scanning electron microscope (SEM) designed for advanced material analysis, biological sample imaging, and nanoparticle characterization. Features multiple detectors for secondary electron, backscattered electron, and X-ray microanalysis (EDX). User-friendly software interface with automated functions for ease of use. Ideal for both novice and experienced users requiring detailed surface morphology and elemental composition data.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'microscope electronics',
    features: ['High Vacuum Mode', 'Low Vacuum Mode', 'EDX Spectroscopy', 'Automated Stage Control', 'Image Stitching'],
    lastCalibration: '2023-12-01',
    nextCalibration: '2024-06-01',
    availability: [
      { date: todayStr, slots: ['14:00-16:00', '16:00-18:00'] },
      { date: tomorrowStr, slots: ['10:00-12:00'] }
    ],
    notes: 'Handle with care. Requires 30 min warm-up time before use.',
    remoteAccess: {
      ipAddress: '192.168.1.101',
      protocol: 'RDP',
      username: 'sem_user',
      notes: 'Access via internal VPN only. Default password: "password123" (change on first login).'
    }
  },
  {
    id: '2',
    name: 'BioSafety Cabinet Omega',
    resourceTypeId: 'rt4',
    resourceTypeName: 'Incubator',
    lab: 'Lab B',
    status: 'Booked',
    manufacturer: 'Baker Company',
    model: 'SterilGARD e3',
    serialNumber: 'SN-BSC-002',
    purchaseDate: '2023-01-20',
    description: 'Class II Type A2 biosafety cabinet providing personnel, product, and environmental protection for work with biological agents up to BSL-3. Features HEPA filtration, ergonomic design, and intuitive controls for safe and efficient sterile work. Equipped with UV light for decontamination cycles. Suitable for cell culture, microbiology, and other sensitive applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'lab cabinet',
    features: ['HEPA Filtered Airflow', 'UV Decontamination Cycle', 'Adjustable Sash Height', 'Airflow Alarm System', 'Quiet Operation'],
    lastCalibration: '2024-01-15',
    nextCalibration: '2024-07-15',
    availability: [
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['Full Day Booked'] }
    ],
    notes: 'UV light cycle runs automatically after each use. Ensure sash is fully closed.'
  },
   {
    id: '3',
    name: 'HPLC System Zeta',
    resourceTypeId: 'rt3', 
    resourceTypeName: 'HPLC System',
    lab: 'Lab C',
    status: 'Maintenance',
    manufacturer: 'Agilent Technologies',
    model: '1260 Infinity II',
    serialNumber: 'SN-HPLC-003',
    purchaseDate: '2021-05-10',
    description: 'Versatile high-performance liquid chromatography (HPLC) system for analytical and semi-preparative applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'hplc chemistry',
    features: ['Quaternary Solvent Delivery', 'Autosampler', 'DAD Detector'],
    lastCalibration: '2023-11-10',
    nextCalibration: '2024-05-10',
    availability: [],
  },
  {
    id: '4',
    name: 'High-Speed Centrifuge Pro',
    resourceTypeId: 'rt2',
    resourceTypeName: 'Centrifuge',
    lab: 'Lab A',
    status: 'Available',
    manufacturer: 'Eppendorf',
    model: '5810R',
    serialNumber: 'SN-CENT-004',
    purchaseDate: '2023-06-05',
    description: 'Refrigerated high-speed centrifuge for various applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'centrifuge science',
    features: ['Refrigerated', 'Max 20,000 RPM'],
    lastCalibration: '2024-02-20',
    nextCalibration: '2024-08-20',
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-12:00', '14:00-16:00'] }
    ]
  },
  {
    id: 'rt8-instance',
    name: 'FPGA Dev Node Alpha',
    resourceTypeId: 'rt8',
    resourceTypeName: 'FPGA Node',
    lab: 'Lab C',
    status: 'Available',
    manufacturer: 'Xilinx',
    model: 'Alveo U250',
    serialNumber: 'XFL-FPGA-01A',
    purchaseDate: '2023-09-01',
    description: 'High-performance FPGA node for compute acceleration and custom hardware development. Suitable for machine learning, video processing, and financial computing.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'fpga circuit board',
    features: ['PCIe Gen3 x16', '28GB HBM2', 'On-board DDR4'],
    lastCalibration: 'N/A',
    nextCalibration: 'N/A',
    availability: [
        { date: todayStr, slots: ['09:00-12:00', '13:00-17:00'] },
        { date: tomorrowStr, slots: ['09:00-17:00'] },
    ],
    notes: 'Requires Vivado Design Suite for development.',
    remoteAccess: {
        hostname: 'fpga-node-alpha.lab.internal',
        protocol: 'SSH',
        username: 'dev_user',
        port: 22,
        notes: 'Access restricted to lab network. Key-based authentication required.'
    }
  },
  {
    id: 'rt6-instance',
    name: 'Benchtop Spectrometer',
    resourceTypeId: 'rt6',
    resourceTypeName: 'Spectrometer',
    lab: 'General Lab',
    status: 'Available',
    manufacturer: 'Ocean Optics',
    model: 'Flame-S-VIS-NIR',
    serialNumber: 'SPEC-FLM-007',
    purchaseDate: '2022-11-01',
    description: 'Compact spectrometer for visible to near-infrared spectral analysis. USB controlled, suitable for absorbance, transmittance, and reflectance measurements.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'spectrometer lab',
    features: ['VIS-NIR Range (350-1000nm)', 'USB Interface', 'Compact Size'],
    lastCalibration: '2023-10-15',
    nextCalibration: '2024-10-15',
    availability: [
        { date: todayStr, slots: ['10:00-17:00'] },
        { date: tomorrowStr, slots: ['10:00-17:00'] },
    ],
    notes: 'SpectraSuite software installed on adjacent workstation.'
  }
];
