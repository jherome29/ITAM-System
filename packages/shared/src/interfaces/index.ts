// SVC: Plan — shared TypeScript interfaces used across all AIMRS services
import {
  AssetClass,
  AssetCondition,
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  OfficialFormType,
  RequisitionStatus,
  RequisitionType,
  UserRole,
} from '../enums';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  division: string;
  officeOrSection: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Asset ────────────────────────────────────────────────────────────────────

export interface AssetTransaction {
  id: string;
  assetId: string;
  action: AuditAction;
  performedById: string;
  fromLocation?: string;
  toLocation?: string;
  notes?: string;
  timestamp: Date;
}

export interface Asset {
  id: string;
  sapClassification: string;
  itemCode: string;
  itemDescription: string;
  brand: string;
  serialNumber: string;
  propertyNumber: string;       // Official CICC property number
  components: string;           // Attached components/accessories
  acquisitionCost: number;      // ₱ value — recorded for identification only, not financial reporting
  acquisitionDate: Date;
  accountableOfficer: string;
  division: string;
  officeOrSection: string;
  officeLocation: string;
  condition: AssetCondition;
  supplier: string;
  dateOfDelivery: Date;
  assetClass: AssetClass;
  assetType: AssetType;
  qrCode: string;               // System-generated QR identifier
  barcodeValue: string;         // System-generated barcode
  status: AssetStatus;
  custodianId: string | null;   // Current assigned user ID
  locationHistory: AssetTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Requisition ──────────────────────────────────────────────────────────────

export interface RequisitionItem {
  id: string;
  requisitionId: string;
  assetType: AssetType;
  assetClass: AssetClass;
  itemDescription: string;
  quantity: number;
  justification: string;
  fulfilledAssetId?: string;    // Linked after fulfillment
}

export interface Requisition {
  id: string;
  requestNumber: string;        // Human-readable reference (e.g. REQ-2026-0001)
  requestedById: string;
  requisitionType: RequisitionType;
  status: RequisitionStatus;
  items: RequisitionItem[];
  justification: string;
  requiredDate: Date;
  // Approval fields
  supervisorId: string | null;
  supervisorDecision?: 'approved' | 'rejected';
  supervisorComments?: string;
  supervisorDecidedAt?: Date;
  // Fulfillment fields
  itPersonnelId?: string;
  fulfilledAt?: Date;
  fulfillmentNotes?: string;
  // SLA tracking
  submittedAt: Date;
  slaDeadline: Date;            // submittedAt + 24 hours
  createdAt: Date;
  updatedAt: Date;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
// CRITICAL: Audit logs are APPEND-ONLY. No UPDATE or DELETE ever.
// Required for COA compliance and RA 10173 (Data Privacy Act).

export interface AuditLog {
  id: string;
  userId: string;
  userRole: UserRole;           // Role at time of action
  action: AuditAction;
  affectedRecordId: string;
  affectedRecordType: string;   // 'asset' | 'requisition' | 'user' | 'report'
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>; // Additional context (no sensitive data)
  timestamp: Date;              // UTC — never modified after creation
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipientId: string;
  alertType: NotificationAlertType;
  title: string;
  message: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
  isRead: boolean;
  createdAt: Date;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface GeneratedReport {
  id: string;
  generatedById: string;
  reportType: string;
  format: 'PDF' | 'Excel';
  filePath: string;
  generatedAt: Date;
}

export interface GeneratedForm {
  id: string;
  formType: OfficialFormType;
  generatedById: string;
  relatedAssetId?: string;
  relatedRequisitionId?: string;
  filePath: string;
  generatedAt: Date;
}

// ─── API Response Envelope ────────────────────────────────────────────────────
// All AIMRS API responses follow this standard envelope shape.

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
