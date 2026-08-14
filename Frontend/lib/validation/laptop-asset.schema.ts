import { z } from 'zod';
import { laptopMockRows } from '@/lib/mock/laptops.mock';

const currentYear = new Date().getFullYear();

function isHexPair(value: string) {
  return value.length === 2 && [...value].every((char) => '0123456789abcdefABCDEF'.includes(char));
}

function isMacAddress(value: string) {
  const parts = value.split(':');
  return parts.length === 6 && parts.every(isHexPair);
}

export function calculateExpectedReplacementDate(acquisitionDate: string, usefulLifeYears: number) {
  if (!acquisitionDate || usefulLifeYears < 1) return '';
  const date = new Date(acquisitionDate);
  date.setFullYear(date.getFullYear() + usefulLifeYears);
  return date.toISOString().slice(0, 10);
}

export function getWarrantyStatus(expiry?: string) {
  if (!expiry) return 'Not Recorded';
  const today = new Date();
  const expiryDate = new Date(expiry);
  const days = Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'Expired';
  if (days <= 90) return 'Expiring Soon';
  return 'Active';
}

export const accessorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Accessory name is required.'),
  serialNumber: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  condition: z.enum(['Serviceable', 'Damaged', 'Missing']),
  includedOnIssuance: z.boolean(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  fileName: z.string().min(1),
  documentType: z.string().min(1),
  uploadedAt: z.string(),
  uploadedBy: z.string(),
  fileSize: z.number(),
  mockUrl: z.string().optional(),
});

export const laptopAssetSchema = z
  .object({
    assetSubtype: z.string(),
    assetId: z.string().optional(),
    propertyNumber: z.string().min(1, 'Property number is required.'),
    assetCategory: z.literal('ICT Equipment'),
    assetType: z.literal('Laptop'),
    assetClassification: z.enum(['PPE', 'SEP']),
    itemDescription: z.string().min(1, 'Item description is required.'),
    brand: z.string().min(1, 'Brand is required.'),
    productLine: z.string().optional(),
    commercialModel: z.string().min(1, 'Commercial model is required.'),
    manufacturerModelNumber: z.string().optional(),
    serialNumber: z.string().optional(),
    serviceTag: z.string().optional(),
    productReleaseYear: z.coerce.number().optional(),
    manufactureYear: z.coerce.number().optional(),
    manufactureDate: z.string().optional(),
    processorBrand: z.enum(['Intel', 'AMD', 'Apple', 'Other']),
    processorModel: z.string().min(1, 'Processor model is required.'),
    processorGeneration: z.string().optional(),
    ramCapacityGb: z.coerce.number().positive('RAM must be greater than zero.'),
    ramType: z.string().optional(),
    ramUpgradeable: z.boolean().optional(),
    maximumRamGb: z.coerce.number().optional(),
    storageCapacityGb: z.coerce.number().positive('Storage capacity must be greater than zero.'),
    storageType: z.enum(['HDD', 'SATA SSD', 'NVMe SSD', 'eMMC', 'Other']),
    graphicsType: z.enum(['Integrated', 'Dedicated']),
    graphicsModel: z.string().optional(),
    screenSizeInches: z.coerce.number().optional(),
    screenResolution: z.string().optional(),
    displayType: z.string().optional(),
    operatingSystem: z.string().min(1, 'Operating system is required.'),
    osEdition: z.string().optional(),
    osLicenseType: z.string().optional(),
    hostname: z.string().optional(),
    macAddress: z.string().optional(),
    ipAssignment: z.enum(['DHCP', 'Static', 'Not Assigned']).optional(),
    deviceEncryption: z.enum(['Enabled', 'Disabled', 'Not Applicable']).optional(),
    endpointProtection: z.string().optional(),
    batteryHealthPercent: z.coerce.number().min(0).max(100).optional(),
    technicalRemarks: z.string().optional(),
    accessories: z.array(accessorySchema),
    acquisitionDate: z.string().min(1, 'Acquisition date is required.'),
    acquisitionCost: z.coerce.number().min(0, 'Acquisition cost must be zero or greater.'),
    supplier: z.string().min(1, 'Supplier is required.'),
    usefulLifeYears: z.coerce.number().min(1, 'Useful life must be at least one year.'),
    expectedReplacementDate: z.string().optional(),
    warrantyStartDate: z.string().optional(),
    warrantyExpiryDate: z.string().optional(),
    warrantyProvider: z.string().optional(),
    warrantyType: z.string().optional(),
    accountableEmployeeId: z.string().optional(),
    accountableEmployeeName: z.string().optional(),
    division: z.string().optional(),
    officeOrSection: z.string().optional(),
    physicalLocation: z.string().optional(),
    accountabilityFormType: z.enum(['PAR', 'ICS', 'None']).optional(),
    accountabilityFormNumber: z.string().optional(),
    acknowledgmentStatus: z.enum(['Not Required', 'Pending', 'Acknowledged']),
    status: z.enum([
      'Registered',
      'Available',
      'Reserved',
      'Issued',
      'Returned',
      'Transferred',
      'For Inspection',
      'Under Repair',
      'For Disposal Review',
      'Disposed',
      'Lost',
      'Stolen',
      'Damaged',
    ]),
    condition: z.enum(['Serviceable', 'For Repair', 'Unserviceable', 'For Disposal']),
    replacementEligibility: z.enum([
      'Not Eligible',
      'Eligible by Age',
      'Eligible by Condition',
      'Eligible by Damage',
      'For Technical Assessment',
    ]),
    dataSanitizationStatus: z.enum(['Not Required', 'Pending', 'Completed']).optional(),
    remarks: z.string().optional(),
    attachments: z.array(attachmentSchema),
  })
  .superRefine((value, ctx) => {
    if (!value.serialNumber && !value.serviceTag) {
      ctx.addIssue({ code: 'custom', path: ['serialNumber'], message: 'Serial number or service tag is required.' });
    }
    if (value.serialNumber && laptopMockRows.some((row) => row.serialNumber === value.serialNumber)) {
      ctx.addIssue({ code: 'custom', path: ['serialNumber'], message: 'Serial number must be unique in mock data.' });
    }
    if (laptopMockRows.some((row) => row.propertyNumber === value.propertyNumber)) {
      ctx.addIssue({ code: 'custom', path: ['propertyNumber'], message: 'Property number must be unique in mock data.' });
    }
    if (value.manufactureYear && value.manufactureYear > currentYear) {
      ctx.addIssue({ code: 'custom', path: ['manufactureYear'], message: 'Manufacture year cannot be in the future.' });
    }
    if (value.productReleaseYear && value.productReleaseYear > currentYear) {
      ctx.addIssue({ code: 'custom', path: ['productReleaseYear'], message: 'Product release year cannot be in the future.' });
    }
    if (value.manufactureDate && value.acquisitionDate && value.acquisitionDate < value.manufactureDate) {
      ctx.addIssue({ code: 'custom', path: ['acquisitionDate'], message: 'Acquisition date cannot be earlier than manufacture date.' });
    }
    if (value.warrantyStartDate && value.warrantyExpiryDate && value.warrantyExpiryDate < value.warrantyStartDate) {
      ctx.addIssue({ code: 'custom', path: ['warrantyExpiryDate'], message: 'Warranty expiry cannot be earlier than warranty start.' });
    }
    if (value.macAddress && !isMacAddress(value.macAddress)) {
      ctx.addIssue({ code: 'custom', path: ['macAddress'], message: 'MAC address must use format AA:BB:CC:DD:EE:FF.' });
    }
    if (value.status === 'Issued' && !value.accountableEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['accountableEmployeeId'], message: 'Issued assets require an accountable employee.' });
    }
    if (value.status === 'Available' && value.accountableEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['accountableEmployeeId'], message: 'Available assets cannot have an accountable employee.' });
    }
  });

export type LaptopAssetFormValues = z.infer<typeof laptopAssetSchema>;
