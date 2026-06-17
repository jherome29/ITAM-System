export declare enum UserRole {
    EMPLOYEE = "employee",
    SUPERVISOR = "supervisor",
    IT_PERSONNEL = "it_personnel",
    SYSTEM_ADMIN = "system_admin",
    MANAGEMENT = "management"
}
export declare enum AssetClass {
    PPE = "PPE",
    SEP = "SEP",
    IES = "IES"
}
export declare enum AssetType {
    ICT = "ICT",
    FIXED = "Fixed",
    SUPPLIES = "Supplies"
}
export declare enum AssetCondition {
    SERVICEABLE = "serviceable",
    UNSERVICEABLE = "unserviceable",
    FOR_REPAIR = "for_repair",
    FOR_DISPOSAL = "for_disposal"
}
export declare enum AssetStatus {
    REGISTERED = "registered",
    AVAILABLE = "available",
    ISSUED = "issued",
    RETURNED = "returned",
    TRANSFERRED = "transferred",
    UNDER_REPAIR = "under_repair",
    FLAGGED_FOR_DISPOSAL = "flagged_for_disposal",
    DISPOSED = "disposed"
}
export declare enum RequisitionStatus {
    DRAFT = "draft",
    PENDING_SUPERVISOR = "pending_supervisor",
    PENDING_FULFILLMENT = "pending_fulfillment",
    ON_HOLD = "on_hold",
    FULFILLED = "fulfilled",
    REJECTED = "rejected",
    CANCELLED = "cancelled"
}
export declare enum RequisitionType {
    NEW = "new",
    REPLACEMENT = "replacement",
    REPAIR = "repair",
    SUPPLY = "supply"
}
export declare enum NotificationAlertType {
    LOW_STOCK = "low_stock",
    OVERDUE_RETURN = "overdue_return",
    PENDING_APPROVAL = "pending_approval",
    SLA_BREACH = "sla_breach",
    ALTERNATE_APPROVER = "alternate_approver",
    REQUISITION_APPROVED = "requisition_approved",
    REQUISITION_REJECTED = "requisition_rejected",
    REQUISITION_FULFILLED = "requisition_fulfilled"
}
export declare enum AuditAction {
    ASSET_CREATED = "asset_created",
    ASSET_UPDATED = "asset_updated",
    ASSET_ISSUED = "asset_issued",
    ASSET_RETURNED = "asset_returned",
    ASSET_TRANSFERRED = "asset_transferred",
    ASSET_FLAGGED_REPAIR = "asset_flagged_repair",
    ASSET_FLAGGED_DISPOSAL = "asset_flagged_disposal",
    ASSET_DISPOSED = "asset_disposed",
    QR_GENERATED = "qr_generated",
    REQUISITION_SUBMITTED = "requisition_submitted",
    REQUISITION_APPROVED = "requisition_approved",
    REQUISITION_REJECTED = "requisition_rejected",
    REQUISITION_ON_HOLD = "requisition_on_hold",
    REQUISITION_FULFILLED = "requisition_fulfilled",
    REQUISITION_CANCELLED = "requisition_cancelled",
    USER_LOGIN = "user_login",
    USER_LOGOUT = "user_logout",
    USER_LOGIN_FAILED = "user_login_failed",
    USER_LOCKED = "user_locked",
    USER_CREATED = "user_created",
    USER_UPDATED = "user_updated",
    USER_DEACTIVATED = "user_deactivated",
    ROLE_ASSIGNED = "role_assigned",
    REPORT_GENERATED = "report_generated",
    FORM_GENERATED = "form_generated"
}
export declare enum OfficialFormType {
    RIS = "RIS",
    RSMI = "RSMI",
    RSPI = "RSPI",
    RECEIPT_RETURNED_PROPERTY = "RECEIPT_RETURNED_PROPERTY",
    RECEIPT_RETURNED_SEP = "RECEIPT_RETURNED_SEP",
    ANNEX_A4 = "ANNEX_A4",
    MOVE_IN = "MOVE_IN",
    MOVE_OUT = "MOVE_OUT",
    STICKER_CARD = "STICKER_CARD",
    ICS = "ICS",
    IAR = "IAR",
    WMR = "WMR",
    RPCI = "RPCI",
    PAR = "PAR",
    RPCPPE = "RPCPPE",
    IIRUP = "IIRUP",
    RLSDDP = "RLSDDP",
    PTR = "PTR"
}
