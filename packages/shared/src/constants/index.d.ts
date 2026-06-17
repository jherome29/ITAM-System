export declare const MAX_LOGIN_ATTEMPTS = 5;
export declare const JWT_EXPIRES_IN = "8h";
export declare const SLA_APPROVAL_HOURS = 24;
export declare const SLA_PENDING_ALERT_HOURS = 12;
export declare const INVENTORY_ACCURACY_TARGET = 0.98;
export declare const ASSET_COST_THRESHOLDS: {
    readonly PPE_MINIMUM: 50000;
};
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
export declare const BCRYPT_ROUNDS = 12;
export declare const DB_TABLES: {
    readonly USERS: "users";
    readonly ASSETS: "assets";
    readonly ASSET_TRANSACTIONS: "asset_transactions";
    readonly REQUISITIONS: "requisitions";
    readonly REQUISITION_ITEMS: "requisition_items";
    readonly AUDIT_LOGS: "audit_logs";
    readonly NOTIFICATIONS: "notifications";
    readonly REPORTS: "generated_reports";
    readonly FORMS: "generated_forms";
};
