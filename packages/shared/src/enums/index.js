"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficialFormType = exports.AuditAction = exports.NotificationAlertType = exports.RequisitionType = exports.RequisitionStatus = exports.AssetStatus = exports.AssetCondition = exports.AssetType = exports.AssetClass = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["EMPLOYEE"] = "employee";
    UserRole["SUPERVISOR"] = "supervisor";
    UserRole["IT_PERSONNEL"] = "it_personnel";
    UserRole["SYSTEM_ADMIN"] = "system_admin";
    UserRole["MANAGEMENT"] = "management";
})(UserRole || (exports.UserRole = UserRole = {}));
var AssetClass;
(function (AssetClass) {
    AssetClass["PPE"] = "PPE";
    AssetClass["SEP"] = "SEP";
    AssetClass["IES"] = "IES";
})(AssetClass || (exports.AssetClass = AssetClass = {}));
var AssetType;
(function (AssetType) {
    AssetType["ICT"] = "ICT";
    AssetType["FIXED"] = "Fixed";
    AssetType["SUPPLIES"] = "Supplies";
})(AssetType || (exports.AssetType = AssetType = {}));
var AssetCondition;
(function (AssetCondition) {
    AssetCondition["SERVICEABLE"] = "serviceable";
    AssetCondition["UNSERVICEABLE"] = "unserviceable";
    AssetCondition["FOR_REPAIR"] = "for_repair";
    AssetCondition["FOR_DISPOSAL"] = "for_disposal";
})(AssetCondition || (exports.AssetCondition = AssetCondition = {}));
var AssetStatus;
(function (AssetStatus) {
    AssetStatus["REGISTERED"] = "registered";
    AssetStatus["AVAILABLE"] = "available";
    AssetStatus["ISSUED"] = "issued";
    AssetStatus["RETURNED"] = "returned";
    AssetStatus["TRANSFERRED"] = "transferred";
    AssetStatus["UNDER_REPAIR"] = "under_repair";
    AssetStatus["FLAGGED_FOR_DISPOSAL"] = "flagged_for_disposal";
    AssetStatus["DISPOSED"] = "disposed";
})(AssetStatus || (exports.AssetStatus = AssetStatus = {}));
var RequisitionStatus;
(function (RequisitionStatus) {
    RequisitionStatus["DRAFT"] = "draft";
    RequisitionStatus["PENDING_SUPERVISOR"] = "pending_supervisor";
    RequisitionStatus["PENDING_FULFILLMENT"] = "pending_fulfillment";
    RequisitionStatus["ON_HOLD"] = "on_hold";
    RequisitionStatus["FULFILLED"] = "fulfilled";
    RequisitionStatus["REJECTED"] = "rejected";
    RequisitionStatus["CANCELLED"] = "cancelled";
})(RequisitionStatus || (exports.RequisitionStatus = RequisitionStatus = {}));
var RequisitionType;
(function (RequisitionType) {
    RequisitionType["NEW"] = "new";
    RequisitionType["REPLACEMENT"] = "replacement";
    RequisitionType["REPAIR"] = "repair";
    RequisitionType["SUPPLY"] = "supply";
})(RequisitionType || (exports.RequisitionType = RequisitionType = {}));
var NotificationAlertType;
(function (NotificationAlertType) {
    NotificationAlertType["LOW_STOCK"] = "low_stock";
    NotificationAlertType["OVERDUE_RETURN"] = "overdue_return";
    NotificationAlertType["PENDING_APPROVAL"] = "pending_approval";
    NotificationAlertType["SLA_BREACH"] = "sla_breach";
    NotificationAlertType["ALTERNATE_APPROVER"] = "alternate_approver";
    NotificationAlertType["REQUISITION_APPROVED"] = "requisition_approved";
    NotificationAlertType["REQUISITION_REJECTED"] = "requisition_rejected";
    NotificationAlertType["REQUISITION_FULFILLED"] = "requisition_fulfilled";
})(NotificationAlertType || (exports.NotificationAlertType = NotificationAlertType = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["ASSET_CREATED"] = "asset_created";
    AuditAction["ASSET_UPDATED"] = "asset_updated";
    AuditAction["ASSET_ISSUED"] = "asset_issued";
    AuditAction["ASSET_RETURNED"] = "asset_returned";
    AuditAction["ASSET_TRANSFERRED"] = "asset_transferred";
    AuditAction["ASSET_FLAGGED_REPAIR"] = "asset_flagged_repair";
    AuditAction["ASSET_FLAGGED_DISPOSAL"] = "asset_flagged_disposal";
    AuditAction["ASSET_DISPOSED"] = "asset_disposed";
    AuditAction["QR_GENERATED"] = "qr_generated";
    AuditAction["REQUISITION_SUBMITTED"] = "requisition_submitted";
    AuditAction["REQUISITION_APPROVED"] = "requisition_approved";
    AuditAction["REQUISITION_REJECTED"] = "requisition_rejected";
    AuditAction["REQUISITION_ON_HOLD"] = "requisition_on_hold";
    AuditAction["REQUISITION_FULFILLED"] = "requisition_fulfilled";
    AuditAction["REQUISITION_CANCELLED"] = "requisition_cancelled";
    AuditAction["USER_LOGIN"] = "user_login";
    AuditAction["USER_LOGOUT"] = "user_logout";
    AuditAction["USER_LOGIN_FAILED"] = "user_login_failed";
    AuditAction["USER_LOCKED"] = "user_locked";
    AuditAction["USER_CREATED"] = "user_created";
    AuditAction["USER_UPDATED"] = "user_updated";
    AuditAction["USER_DEACTIVATED"] = "user_deactivated";
    AuditAction["ROLE_ASSIGNED"] = "role_assigned";
    AuditAction["REPORT_GENERATED"] = "report_generated";
    AuditAction["FORM_GENERATED"] = "form_generated";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
var OfficialFormType;
(function (OfficialFormType) {
    OfficialFormType["RIS"] = "RIS";
    OfficialFormType["RSMI"] = "RSMI";
    OfficialFormType["RSPI"] = "RSPI";
    OfficialFormType["RECEIPT_RETURNED_PROPERTY"] = "RECEIPT_RETURNED_PROPERTY";
    OfficialFormType["RECEIPT_RETURNED_SEP"] = "RECEIPT_RETURNED_SEP";
    OfficialFormType["ANNEX_A4"] = "ANNEX_A4";
    OfficialFormType["MOVE_IN"] = "MOVE_IN";
    OfficialFormType["MOVE_OUT"] = "MOVE_OUT";
    OfficialFormType["STICKER_CARD"] = "STICKER_CARD";
    OfficialFormType["ICS"] = "ICS";
    OfficialFormType["IAR"] = "IAR";
    OfficialFormType["WMR"] = "WMR";
    OfficialFormType["RPCI"] = "RPCI";
    OfficialFormType["PAR"] = "PAR";
    OfficialFormType["RPCPPE"] = "RPCPPE";
    OfficialFormType["IIRUP"] = "IIRUP";
    OfficialFormType["RLSDDP"] = "RLSDDP";
    OfficialFormType["PTR"] = "PTR";
})(OfficialFormType || (exports.OfficialFormType = OfficialFormType = {}));
//# sourceMappingURL=index.js.map