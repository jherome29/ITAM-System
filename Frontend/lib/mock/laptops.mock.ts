export type LaptopAssetStatus =
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

export type LaptopAssetCondition = 'Serviceable' | 'For Repair' | 'Unserviceable' | 'For Disposal';

export interface AssetAccessory {
  id: string;
  name: string;
  serialNumber?: string;
  quantity: number;
  condition: 'Serviceable' | 'Damaged' | 'Missing';
  includedOnIssuance: boolean;
}

export interface AssetAttachment {
  id: string;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: number;
  mockUrl?: string;
}

export interface LaptopAssetRecord {
  assetId: string;
  propertyNumber: string;
  assetCategory: 'ICT Equipment';
  assetType: 'Laptop';
  assetClassification: 'PPE' | 'SEP';
  itemDescription: string;
  brand: string;
  productLine?: string;
  commercialModel: string;
  manufacturerModelNumber?: string;
  serialNumber: string;
  serviceTag?: string;
  productReleaseYear?: number;
  manufactureYear?: number;
  manufactureDate?: string;
  qrCode?: string;
  barcodeValue?: string;
  processorBrand: 'Intel' | 'AMD' | 'Apple' | 'Other';
  processorModel: string;
  processorGeneration?: string;
  ramCapacityGb: number;
  ramType?: string;
  ramUpgradeable?: boolean;
  maximumRamGb?: number;
  storageCapacityGb: number;
  storageType: 'HDD' | 'SATA SSD' | 'NVMe SSD' | 'eMMC' | 'Other';
  graphicsType: 'Integrated' | 'Dedicated';
  graphicsModel?: string;
  screenSizeInches?: number;
  screenResolution?: string;
  displayType?: string;
  operatingSystem: string;
  osEdition?: string;
  osLicenseType?: string;
  hostname?: string;
  macAddress?: string;
  ipAssignment?: 'DHCP' | 'Static' | 'Not Assigned';
  deviceEncryption?: 'Enabled' | 'Disabled' | 'Not Applicable';
  endpointProtection?: string;
  batteryHealthPercent?: number;
  technicalRemarks?: string;
  accessories: AssetAccessory[];
  acquisitionDate: string;
  deliveryDate?: string;
  acceptanceDate?: string;
  acquisitionCost: number;
  supplier: string;
  purchaseOrderNumber?: string;
  deliveryReceiptNumber?: string;
  inspectionAcceptanceReportNumber?: string;
  fundingSource?: string;
  procurementReference?: string;
  usefulLifeYears: number;
  expectedReplacementDate?: string;
  warrantyStartDate?: string;
  warrantyExpiryDate?: string;
  warrantyProvider?: string;
  warrantyType?: string;
  accountableEmployeeId?: string;
  accountableEmployeeName?: string;
  division?: string;
  officeOrSection?: string;
  physicalLocation?: string;
  dateIssued?: string;
  issuedBy?: string;
  accountabilityFormType?: 'PAR' | 'ICS' | 'None';
  accountabilityFormNumber?: string;
  acknowledgmentStatus: 'Not Required' | 'Pending' | 'Acknowledged';
  expectedReturnDate?: string;
  status: LaptopAssetStatus;
  condition: LaptopAssetCondition;
  lastPhysicalVerificationDate?: string;
  lastVerifiedBy?: string;
  lastKnownLocation?: string;
  lastMaintenanceDate?: string;
  maintenanceStatus?: string;
  repairHistoryCount?: number;
  replacementEligibility:
    | 'Not Eligible'
    | 'Eligible by Age'
    | 'Eligible by Condition'
    | 'Eligible by Damage'
    | 'For Technical Assessment';
  disposalStatus?: 'Not Recommended' | 'Recommended' | 'Under Review' | 'Approved' | 'Disposed';
  dataSanitizationStatus?: 'Not Required' | 'Pending' | 'Completed';
  remarks?: string;
  attachments: AssetAttachment[];
  assignmentHistory: string[];
  lifecycleHistory: string[];
}

export const defaultLaptopAccessories: AssetAccessory[] = [
  { id: 'ACC-CHG', name: 'Charger', quantity: 1, condition: 'Serviceable', includedOnIssuance: true },
  { id: 'ACC-BAG', name: 'Laptop bag', quantity: 1, condition: 'Serviceable', includedOnIssuance: true },
  { id: 'ACC-MSE', name: 'Mouse', quantity: 1, condition: 'Serviceable', includedOnIssuance: false },
  { id: 'ACC-DCK', name: 'Docking station', quantity: 1, condition: 'Serviceable', includedOnIssuance: false },
  { id: 'ACC-KBD', name: 'External keyboard', quantity: 1, condition: 'Serviceable', includedOnIssuance: false },
  { id: 'ACC-HST', name: 'Headset', quantity: 1, condition: 'Serviceable', includedOnIssuance: false },
  { id: 'ACC-CBL', name: 'Security cable', quantity: 1, condition: 'Serviceable', includedOnIssuance: false },
];

export const laptopMockRows: LaptopAssetRecord[] = [
  {
    assetId: 'ICT-LT-0145',
    propertyNumber: 'CICC-ICT-2026-0145',
    assetCategory: 'ICT Equipment',
    assetType: 'Laptop',
    assetClassification: 'PPE',
    itemDescription: 'Dell Latitude 5440 laptop for digital forensics field work',
    brand: 'Dell',
    productLine: 'Latitude',
    commercialModel: 'Latitude 5440',
    manufacturerModelNumber: 'P137G',
    serialNumber: 'ABCD123',
    serviceTag: 'ABCD123',
    productReleaseYear: 2023,
    manufactureYear: 2024,
    manufactureDate: '2024-10-10',
    qrCode: 'AIMRS:ICT-LT-0145',
    barcodeValue: 'ICT-LT-0145',
    processorBrand: 'Intel',
    processorModel: 'Intel Core i7-1365U',
    processorGeneration: '13th Generation',
    ramCapacityGb: 16,
    ramType: 'DDR5',
    ramUpgradeable: true,
    maximumRamGb: 64,
    storageCapacityGb: 512,
    storageType: 'NVMe SSD',
    graphicsType: 'Integrated',
    graphicsModel: 'Intel Iris Xe',
    screenSizeInches: 14,
    screenResolution: '1920 x 1080',
    displayType: 'IPS',
    operatingSystem: 'Windows 11 Pro',
    osEdition: 'Pro',
    osLicenseType: 'OEM',
    hostname: 'CICC-LT-0145',
    macAddress: '00:1A:2B:3C:4D:5E',
    ipAssignment: 'DHCP',
    deviceEncryption: 'Enabled',
    endpointProtection: 'Microsoft Defender for Endpoint',
    batteryHealthPercent: 96,
    accessories: defaultLaptopAccessories.slice(0, 3),
    acquisitionDate: '2026-02-14',
    acquisitionCost: 78500,
    supplier: 'ABC Technology Solutions, Inc.',
    purchaseOrderNumber: 'PO-2026-ICT-0045',
    inspectionAcceptanceReportNumber: 'IAR-2026-0038',
    usefulLifeYears: 5,
    expectedReplacementDate: '2031-02-14',
    warrantyStartDate: '2026-02-14',
    warrantyExpiryDate: '2029-02-14',
    warrantyProvider: 'Dell Technologies',
    warrantyType: '3-Year Onsite Support',
    accountableEmployeeId: 'EMP-001',
    accountableEmployeeName: 'Ana Reyes',
    division: 'Digital Forensics',
    officeOrSection: 'Evidence Processing',
    physicalLocation: 'CICC Main Office - DF Lab',
    dateIssued: '2026-02-20',
    issuedBy: 'Paolo Cruz',
    accountabilityFormType: 'PAR',
    accountabilityFormNumber: 'PAR-2026-0145',
    acknowledgmentStatus: 'Pending',
    expectedReturnDate: '2029-02-14',
    status: 'Issued',
    condition: 'Serviceable',
    lastPhysicalVerificationDate: '2026-06-12',
    lastVerifiedBy: 'Paolo Cruz',
    lastKnownLocation: 'DF Lab',
    replacementEligibility: 'Not Eligible',
    disposalStatus: 'Not Recommended',
    dataSanitizationStatus: 'Not Required',
    attachments: [],
    assignmentHistory: ['2026-02-20 - Issued to Ana Reyes by Paolo Cruz'],
    lifecycleHistory: ['2026-02-14 - Registered', '2026-02-20 - Issued'],
  },
  {
    assetId: 'ICT-LT-0112',
    propertyNumber: 'CICC-ICT-2025-0112',
    assetCategory: 'ICT Equipment',
    assetType: 'Laptop',
    assetClassification: 'PPE',
    itemDescription: 'Lenovo ThinkPad T14 Gen 4 laptop',
    brand: 'Lenovo',
    productLine: 'ThinkPad',
    commercialModel: 'ThinkPad T14 Gen 4',
    serialNumber: 'LNV-T14-7840U',
    manufactureYear: 2024,
    processorBrand: 'AMD',
    processorModel: 'AMD Ryzen 7 PRO 7840U',
    ramCapacityGb: 32,
    ramType: 'DDR5',
    storageCapacityGb: 1024,
    storageType: 'NVMe SSD',
    graphicsType: 'Integrated',
    operatingSystem: 'Windows 11 Pro',
    batteryHealthPercent: 71,
    accessories: defaultLaptopAccessories.slice(0, 2),
    acquisitionDate: '2025-05-06',
    acquisitionCost: 92000,
    supplier: 'Lenovo Partner PH',
    usefulLifeYears: 5,
    expectedReplacementDate: '2030-05-06',
    status: 'Under Repair',
    condition: 'For Repair',
    acknowledgmentStatus: 'Not Required',
    physicalLocation: 'ICT Repair Bench',
    replacementEligibility: 'For Technical Assessment',
    disposalStatus: 'Not Recommended',
    attachments: [],
    assignmentHistory: ['2025-05-12 - Issued to Incident Response', '2026-06-18 - Returned for repair'],
    lifecycleHistory: ['2025-05-06 - Registered', '2026-06-18 - Under repair'],
  },
  {
    assetId: 'ICT-LT-0084',
    propertyNumber: 'CICC-ICT-2021-0084',
    assetCategory: 'ICT Equipment',
    assetType: 'Laptop',
    assetClassification: 'SEP',
    itemDescription: 'HP EliteBook 840 G8 laptop',
    brand: 'HP',
    productLine: 'EliteBook',
    commercialModel: 'EliteBook 840 G8',
    serialNumber: 'HP840G8-2021',
    manufactureYear: 2021,
    processorBrand: 'Intel',
    processorModel: 'Intel Core i5-1135G7',
    ramCapacityGb: 16,
    storageCapacityGb: 512,
    storageType: 'SATA SSD',
    graphicsType: 'Integrated',
    operatingSystem: 'Windows 10 Pro',
    batteryHealthPercent: 38,
    accessories: defaultLaptopAccessories.slice(0, 1),
    acquisitionDate: '2021-09-18',
    acquisitionCost: 64500,
    supplier: 'HP Authorized Reseller',
    usefulLifeYears: 4,
    expectedReplacementDate: '2025-09-18',
    status: 'For Disposal Review',
    condition: 'Unserviceable',
    acknowledgmentStatus: 'Not Required',
    physicalLocation: 'ICT Storage',
    replacementEligibility: 'Eligible by Condition',
    disposalStatus: 'Recommended',
    dataSanitizationStatus: 'Pending',
    attachments: [],
    assignmentHistory: ['2021-09-22 - Issued to Records Unit', '2025-11-02 - Returned to ICT Storage'],
    lifecycleHistory: ['2021-09-18 - Registered', '2025-11-02 - Recommended for disposal review'],
  },
];

export const ictAssetSubtypes = [
  'Laptop',
  'Desktop',
  'Server',
  'Monitor',
  'Printer',
  'Scanner',
  'Network Device',
  'Storage Device',
  'Mobile Phone',
  'Tablet',
  'UPS',
  'Forensic Workstation',
  'Digital Forensic Equipment',
  'Software License',
  'Other ICT Equipment',
] as const;

