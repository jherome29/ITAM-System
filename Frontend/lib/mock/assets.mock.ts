export type MockAssetScope = 'ICT' | 'PROPERTY' | 'SUPPLY';
export type MockAssetStatus =
  | 'Registered'
  | 'Available'
  | 'Reserved'
  | 'Issued'
  | 'Returned'
  | 'Transferred'
  | 'For Inspection'
  | 'Under Repair'
  | 'For Disposal Review'
  | 'Disposed'
  | 'Lost'
  | 'Stolen'
  | 'Damaged';

export interface MockAsset {
  id: string;
  name: string;
  scope: MockAssetScope;
  category: string;
  type: string;
  serialNumber: string;
  location: string;
  assignedTo?: string;
  assignedEmployeeId?: string;
  issuedDate?: string;
  returnDate?: string;
  condition: 'Serviceable' | 'For Repair' | 'For Return' | 'Reported Damaged' | 'Low Stock';
  status: MockAssetStatus;
  acknowledgmentStatus: 'Pending' | 'Acknowledged' | 'Not Required';
  stockOnHand?: number;
  reorderLevel?: number;
  unit?: string;
  warrantyExpiry?: string;
  brand?: string;
  model?: string;
  propertyNumber?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  supplier?: string;
  purchaseOrderNumber?: string;
  fundCluster?: string;
  usefulLifeYears?: number;
  warrantyStart?: string;
  division?: string;
  officeOrSection?: string;
  nextMaintenanceDate?: string;
  lotNumber?: string;
  expirationDate?: string;
  photoUrl?: string;
  photoName?: string;
  documentNames?: string[];
  notes: string;
}

export const assetMockRows: MockAsset[] = [
  {
    id: 'ICT-00091',
    name: 'Dell Latitude 5440',
    scope: 'ICT',
    category: 'ICT Equipment',
    type: 'Laptop',
    serialNumber: 'DL-5440-A91',
    location: 'Digital Forensics',
    assignedTo: 'Ana Reyes',
    assignedEmployeeId: 'EMP-001',
    issuedDate: '2025-03-12',
    returnDate: '2025-07-10',
    condition: 'Serviceable',
    status: 'Issued',
    acknowledgmentStatus: 'Pending',
    warrantyExpiry: '2027-03-12',
    notes: 'Return due for refresh and evidence-tool reimaging.',
  },
  {
    id: 'ICT-00073',
    name: 'Forensic Imaging Workstation',
    scope: 'ICT',
    category: 'Forensic Tools',
    type: 'Workstation',
    serialNumber: 'FX-WKS-073',
    location: 'ICT Storage',
    condition: 'For Repair',
    status: 'Under Repair',
    acknowledgmentStatus: 'Not Required',
    warrantyExpiry: '2026-02-18',
    notes: 'GPU diagnostics pending vendor assessment.',
  },
  {
    id: 'ICT-00110',
    name: 'Encrypted Mobile Kit',
    scope: 'ICT',
    category: 'Communication Devices',
    type: 'Mobile Kit',
    serialNumber: 'EMK-110',
    location: 'ICT Storage',
    condition: 'Serviceable',
    status: 'Available',
    acknowledgmentStatus: 'Not Required',
    warrantyExpiry: '2026-11-02',
    notes: 'Available for approved issuance.',
  },
  {
    id: 'PPE-00120',
    name: 'Toyota Hiace',
    scope: 'PROPERTY',
    category: 'Motor Vehicles',
    type: 'Vehicle',
    serialNumber: 'VH-HIACE-120',
    location: 'Operations',
    assignedTo: 'Operations Division',
    condition: 'Serviceable',
    status: 'Issued',
    acknowledgmentStatus: 'Acknowledged',
    notes: 'Non-ICT fixed asset managed by Property Custodian.',
  },
  {
    id: 'PPE-00145',
    name: 'Evidence Storage Cabinet',
    scope: 'PROPERTY',
    category: 'Office Equipment',
    type: 'Cabinet',
    serialNumber: 'CAB-145',
    location: 'Evidence Room',
    assignedTo: 'Ana Reyes',
    assignedEmployeeId: 'EMP-001',
    issuedDate: '2025-01-20',
    condition: 'Serviceable',
    status: 'Issued',
    acknowledgmentStatus: 'Acknowledged',
    notes: 'Assigned fixed property.',
  },
  {
    id: 'SUP-00451',
    name: 'Evidence Barcode Labels',
    scope: 'SUPPLY',
    category: 'Supplies',
    type: 'Consumable',
    serialNumber: 'N/A',
    location: 'Property Supply',
    condition: 'Low Stock',
    status: 'Available',
    acknowledgmentStatus: 'Not Required',
    stockOnHand: 24,
    reorderLevel: 50,
    unit: 'rolls',
    notes: 'Low-stock alert active.',
  },
  {
    id: 'ICT-00121', name: 'HP LaserJet Pro 4003dw', scope: 'ICT', category: 'ICT Equipment', type: 'Printer', serialNumber: 'HPLJ-4003-121', location: 'ICT Storage', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', warrantyExpiry: '2028-02-18', notes: 'Network printer available for approved issuance.',
  },
  {
    id: 'ICT-00122', name: 'Cisco Catalyst 9200L', scope: 'ICT', category: 'Network Equipment', type: 'Network Switch', serialNumber: 'CAT92L-00122', location: 'Network Operations', assignedTo: 'ICT Unit', condition: 'Serviceable', status: 'Issued', acknowledgmentStatus: 'Acknowledged', warrantyExpiry: '2027-11-30', notes: 'Managed access switch assigned to Network Operations.',
  },
  {
    id: 'ICT-00123', name: 'Synology RackStation RS822+', scope: 'ICT', category: 'ICT Equipment', type: 'Server Storage', serialNumber: 'SYN-RS822-123', location: 'Data Center', condition: 'For Repair', status: 'Under Repair', acknowledgmentStatus: 'Not Required', warrantyExpiry: '2026-10-05', notes: 'Drive bay diagnostics scheduled with the service provider.',
  },
  {
    id: 'PPE-00146', name: 'Epson EB-L260F Projector', scope: 'PROPERTY', category: 'Office Equipment', type: 'Projector', serialNumber: 'EPS-L260-146', location: 'Training Room', assignedTo: 'Administrative Service', condition: 'Serviceable', status: 'Issued', acknowledgmentStatus: 'Acknowledged', notes: 'Installed in the main training room.',
  },
  {
    id: 'PPE-00147', name: 'Steel Filing Cabinet', scope: 'PROPERTY', category: 'Furniture', type: 'Cabinet', serialNumber: 'SFC-147', location: 'Records Section', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', notes: 'Four-drawer lockable records cabinet.',
  },
  {
    id: 'PPE-00148', name: 'Executive Office Desk', scope: 'PROPERTY', category: 'Furniture', type: 'Desk', serialNumber: 'EOD-148', location: 'Property Storage', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', notes: 'Available for office assignment.',
  },
  {
    id: 'PPE-00149', name: 'Split-Type Air Conditioner', scope: 'PROPERTY', category: 'Building Equipment', type: 'Air Conditioner', serialNumber: 'ACU-149', location: 'Digital Forensics', assignedTo: 'Digital Forensics', condition: 'For Repair', status: 'Under Repair', acknowledgmentStatus: 'Not Required', notes: 'Cooling performance inspection in progress.',
  },
  {
    id: 'SUP-00452', name: 'Laser Printer Toner', scope: 'SUPPLY', category: 'Printing Supplies', type: 'Consumable', serialNumber: 'N/A', location: 'Property Supply', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', stockOnHand: 18, reorderLevel: 12, unit: 'cartridges', notes: 'Compatible black toner for office laser printers.',
  },
  {
    id: 'SUP-00453', name: 'Tamper-Evident Evidence Bags', scope: 'SUPPLY', category: 'Evidence Supplies', type: 'Consumable', serialNumber: 'N/A', location: 'Evidence Supply', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', stockOnHand: 240, reorderLevel: 100, unit: 'pieces', notes: 'Serialized medium evidence bags.',
  },
  {
    id: 'SUP-00454', name: 'A4 Bond Paper', scope: 'SUPPLY', category: 'Office Supplies', type: 'Consumable', serialNumber: 'N/A', location: 'Property Supply', condition: 'Low Stock', status: 'Available', acknowledgmentStatus: 'Not Required', stockOnHand: 14, reorderLevel: 25, unit: 'reams', notes: 'General office printing stock.',
  },
  {
    id: 'SUP-00455', name: 'AA Alkaline Batteries', scope: 'SUPPLY', category: 'Technical Supplies', type: 'Consumable', serialNumber: 'N/A', location: 'ICT Supply', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', stockOnHand: 72, reorderLevel: 30, unit: 'pieces', notes: 'For approved field and technical equipment.',
  },
  {
    id: 'SUP-00456', name: 'Cable Identification Tags', scope: 'SUPPLY', category: 'Technical Supplies', type: 'Consumable', serialNumber: 'N/A', location: 'ICT Supply', condition: 'Serviceable', status: 'Available', acknowledgmentStatus: 'Not Required', stockOnHand: 36, reorderLevel: 20, unit: 'packs', notes: 'Writable tags for rack and workstation cabling.',
  },
];
