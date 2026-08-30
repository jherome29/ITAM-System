// SVC: Plan — shared enumerations used across all AIMRS services

export enum UserRole {
  EMPLOYEE = 'employee',
  SUPERVISOR = 'supervisor',
  IT_PERSONNEL = 'it_personnel',
  SYSTEM_ADMIN = 'system_admin',
  MANAGEMENT = 'management',
  PROPERTY_CUSTODIAN = 'property_custodian',
  PROPERTY_OFFICER = 'property_officer',
}

export enum AssetClass {
  PPE = 'PPE', // Property, Plant & Equipment — useful life >1yr, cost >= PHP 50,000
  SEP = 'SEP', // Semi-Expendable Property — useful life >1yr, cost < PHP 50,000
  IES = 'IES', // Inventory/Expendable Supplies — consumables, <1yr useful life
}

export enum AssetType {
  ICT = 'ICT',
  FIXED = 'Fixed',
  SUPPLIES = 'Supplies',
}

export enum AssetCondition {
  SERVICEABLE = 'serviceable',
  UNSERVICEABLE = 'unserviceable',
  FOR_REPAIR = 'for_repair',
  FOR_DISPOSAL = 'for_disposal',
}

export enum AssetStatus {
  REGISTERED = 'registered',
  AVAILABLE = 'available',
  ISSUED = 'issued',
  RETURNED = 'returned',
  TRANSFERRED = 'transferred',
  UNDER_REPAIR = 'under_repair',
  FLAGGED_FOR_DISPOSAL = 'flagged_for_disposal',
  DISPOSED = 'disposed',
}

export enum RequisitionStatus {
  DRAFT               = 'draft',
  PENDING_SUPERVISOR  = 'pending_supervisor',  // Submitted — awaiting supervisor
  PENDING_FULFILLMENT = 'pending_fulfillment', // Approved — awaiting IT fulfillment
  ON_HOLD             = 'on_hold',             // Asset unavailable — IT notified
  FULFILLED           = 'fulfilled',           // IT issued the asset
  REJECTED            = 'rejected',            // Rejected by supervisor
  CANCELLED           = 'cancelled',           // Cancelled by requester
}

export enum RequisitionType {
  NEW         = 'new',
  REPLACEMENT = 'replacement',
  REPAIR      = 'repair',
  SUPPLY      = 'supply',
}

export enum NotificationAlertType {
  LOW_STOCK        = 'low_stock',
  OVERDUE_RETURN   = 'overdue_return',
  PENDING_APPROVAL = 'pending_approval',
  SLA_BREACH       = 'sla_breach',
  ALTERNATE_APPROVER = 'alternate_approver',
  REQUISITION_APPROVED  = 'requisition_approved',
  REQUISITION_REJECTED  = 'requisition_rejected',
  REQUISITION_FULFILLED = 'requisition_fulfilled',
}

export enum AuditAction {
  // Asset actions
  ASSET_CREATED         = 'asset_created',
  ASSET_UPDATED         = 'asset_updated',
  ASSET_ISSUED          = 'asset_issued',
  ASSET_RETURNED        = 'asset_returned',
  ASSET_TRANSFERRED     = 'asset_transferred',
  ASSET_FLAGGED_REPAIR  = 'asset_flagged_repair',
  ASSET_FLAGGED_DISPOSAL= 'asset_flagged_disposal',
  ASSET_DISPOSED        = 'asset_disposed',
  QR_GENERATED          = 'qr_generated',
  // Requisition actions
  REQUISITION_SUBMITTED = 'requisition_submitted',
  REQUISITION_APPROVED  = 'requisition_approved',
  REQUISITION_REJECTED  = 'requisition_rejected',
  REQUISITION_ON_HOLD   = 'requisition_on_hold',
  REQUISITION_FULFILLED = 'requisition_fulfilled',
  REQUISITION_CANCELLED = 'requisition_cancelled',
  // Auth actions
  USER_LOGIN       = 'user_login',
  USER_LOGOUT      = 'user_logout',
  USER_LOGIN_FAILED= 'user_login_failed',
  USER_LOCKED      = 'user_locked',
  // Admin actions
  USER_CREATED     = 'user_created',
  USER_UPDATED     = 'user_updated',
  USER_DEACTIVATED = 'user_deactivated',
  ROLE_ASSIGNED    = 'role_assigned',
  // Report actions
  REPORT_GENERATED = 'report_generated',
  FORM_GENERATED   = 'form_generated',

  SYSTEM_CONFIG_UPDATED = 'system_config_updated',
  REQUISITION_REASSIGNED = 'requisition_reassigned',
}

export enum OfficialFormType {
  RIS = 'RIS',
  RSMI = 'RSMI',
  RSPI = 'RSPI',
  RECEIPT_RETURNED_PROPERTY = 'RECEIPT_RETURNED_PROPERTY',
  RECEIPT_RETURNED_SEP = 'RECEIPT_RETURNED_SEP',
  ANNEX_A4 = 'ANNEX_A4',
  MOVE_IN = 'MOVE_IN',
  MOVE_OUT = 'MOVE_OUT',
  STICKER_CARD = 'STICKER_CARD',           // Appendix 58
  ICS = 'ICS',                             // Appendix 59
  IAR = 'IAR',                             // Appendix 62
  WMR = 'WMR',                             // Appendix 65
  RPCI = 'RPCI',                           // Appendix 66
  PAR = 'PAR',                             // Appendix 71
  RPCPPE = 'RPCPPE',                       // Appendix 73
  IIRUP = 'IIRUP',                         // Appendix 74
  RLSDDP = 'RLSDDP',                      // Appendix 75
  PTR = 'PTR',                             // Appendix 76
}
