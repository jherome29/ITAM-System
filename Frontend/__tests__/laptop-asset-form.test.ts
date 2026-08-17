import { describe, expect, it } from 'vitest';
import { laptopFormSections } from '@/components/assets/LaptopAssetForm';
import { laptopMockRows } from '@/lib/mock/laptops.mock';
import {
  calculateExpectedReplacementDate,
  getWarrantyStatus,
  laptopAssetSchema,
} from '@/lib/validation/laptop-asset.schema';

const validLaptop = {
  assetSubtype: 'Laptop',
  propertyNumber: 'CICC-ICT-2026-9999',
  assetCategory: 'ICT Equipment',
  assetType: 'Laptop',
  assetClassification: 'PPE',
  itemDescription: 'Test laptop',
  brand: 'Dell',
  commercialModel: 'Latitude 5450',
  serialNumber: 'UNIQUE-SERIAL-9999',
  serviceTag: '',
  productReleaseYear: 2024,
  manufactureYear: 2025,
  manufactureDate: '2025-01-01',
  processorBrand: 'Intel',
  processorModel: 'Intel Core i7',
  ramCapacityGb: 16,
  storageCapacityGb: 512,
  storageType: 'NVMe SSD',
  graphicsType: 'Integrated',
  operatingSystem: 'Windows 11 Pro',
  batteryHealthPercent: 95,
  accessories: [],
  acquisitionDate: '2026-02-14',
  acquisitionCost: 78500,
  supplier: 'ABC Technology Solutions',
  usefulLifeYears: 5,
  warrantyStartDate: '2026-02-14',
  warrantyExpiryDate: '2029-02-14',
  acknowledgmentStatus: 'Not Required',
  accountabilityFormType: 'PAR',
  status: 'Registered',
  condition: 'Serviceable',
  replacementEligibility: 'Not Eligible',
  dataSanitizationStatus: 'Not Required',
  attachments: [],
};

describe('laptop asset registration schema', () => {
  it('exposes all required form sections', () => {
    expect(laptopFormSections).toEqual([
      'Basic Information',
      'Technical Specifications',
      'Accessories',
      'Acquisition and Warranty',
      'Assignment and Location',
      'Lifecycle and Condition',
      'Attachments',
      'Review and Submit',
    ]);
  });

  it('requires brand, commercial model, serial/service tag, and property number', () => {
    const result = laptopAssetSchema.safeParse({ ...validLaptop, brand: '', commercialModel: '', serialNumber: '', propertyNumber: '' });
    expect(result.success).toBe(false);
  });

  it('rejects future manufacture year and invalid warranty ordering', () => {
    const result = laptopAssetSchema.safeParse({
      ...validLaptop,
      manufactureYear: new Date().getFullYear() + 1,
      warrantyStartDate: '2026-01-01',
      warrantyExpiryDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('calculates expected replacement date', () => {
    expect(calculateExpectedReplacementDate('2026-02-14', 5)).toBe('2031-02-14');
  });

  it('rejects duplicate serial and property numbers from mock data', () => {
    const existing = laptopMockRows[0];
    const result = laptopAssetSchema.safeParse({
      ...validLaptop,
      serialNumber: existing.serialNumber,
      propertyNumber: existing.propertyNumber,
    });
    expect(result.success).toBe(false);
  });

  it('requires accountable employee when issued', () => {
    const result = laptopAssetSchema.safeParse({ ...validLaptop, status: 'Issued', accountableEmployeeId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects accountable employee when available', () => {
    const result = laptopAssetSchema.safeParse({ ...validLaptop, status: 'Available', accountableEmployeeId: 'EMP-001' });
    expect(result.success).toBe(false);
  });

  it('keeps model, manufacture year, and acquisition year separate in mock detail records', () => {
    const laptop = laptopMockRows[0];
    expect(`${laptop.brand} ${laptop.commercialModel}`).toBe('Dell Latitude 5440');
    expect(laptop.manufacturerModelNumber).toBe('P137G');
    expect(laptop.manufactureYear).toBe(2024);
    expect(laptop.acquisitionDate.slice(0, 4)).toBe('2026');
  });

  it('returns warranty status labels', () => {
    expect(getWarrantyStatus(undefined)).toBe('Not Recorded');
  });
});

