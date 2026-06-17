"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB_TABLES = exports.BCRYPT_ROUNDS = exports.PAGINATION = exports.ASSET_COST_THRESHOLDS = exports.INVENTORY_ACCURACY_TARGET = exports.SLA_PENDING_ALERT_HOURS = exports.SLA_APPROVAL_HOURS = exports.JWT_EXPIRES_IN = exports.MAX_LOGIN_ATTEMPTS = void 0;
exports.MAX_LOGIN_ATTEMPTS = 5;
exports.JWT_EXPIRES_IN = '8h';
exports.SLA_APPROVAL_HOURS = 24;
exports.SLA_PENDING_ALERT_HOURS = 12;
exports.INVENTORY_ACCURACY_TARGET = 0.98;
exports.ASSET_COST_THRESHOLDS = {
    PPE_MINIMUM: 50_000,
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
exports.BCRYPT_ROUNDS = 12;
exports.DB_TABLES = {
    USERS: 'users',
    ASSETS: 'assets',
    ASSET_TRANSACTIONS: 'asset_transactions',
    REQUISITIONS: 'requisitions',
    REQUISITION_ITEMS: 'requisition_items',
    AUDIT_LOGS: 'audit_logs',
    NOTIFICATIONS: 'notifications',
    REPORTS: 'generated_reports',
    FORMS: 'generated_forms',
};
//# sourceMappingURL=index.js.map