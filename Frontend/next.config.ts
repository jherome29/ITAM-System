import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/approving-officer/queue", destination: "/approving-officer/approvals", permanent: false },
      { source: "/approving-officer/history", destination: "/approving-officer/approval-history", permanent: false },
      { source: "/it-asset-custodian/custody-issuance", destination: "/it-asset-custodian/custody", permanent: false },
      { source: "/it-asset-custodian/inventory", destination: "/it-asset-custodian/physical-inventory", permanent: false },
      { source: "/it-asset-custodian/reports-forms", destination: "/it-asset-custodian/reports", permanent: false },
      { source: "/it-personnel/assets", destination: "/it-asset-custodian/assets", permanent: false },
      { source: "/it-personnel/assets/new", destination: "/it-asset-custodian/assets/new", permanent: false },
      { source: "/it-personnel/assets/:id", destination: "/it-asset-custodian/assets/:id", permanent: false },
      { source: "/property-custodian/custody-issuance", destination: "/property-custodian/custody", permanent: false },
      { source: "/property-custodian/inventory", destination: "/property-custodian/physical-inventory", permanent: false },
      { source: "/property-custodian/reports-forms", destination: "/property-custodian/reports", permanent: false },
      { source: "/property-officer/registry-overview", destination: "/property-officer/assets", permanent: false },
      { source: "/property-officer/replacement-validation", destination: "/property-officer/replacements", permanent: false },
      { source: "/property-officer/disposal-review", destination: "/property-officer/disposal", permanent: false },
      { source: "/property-officer/reports-forms", destination: "/property-officer/reports", permanent: false },
      { source: "/property-officer/audit-history", destination: "/property-officer/audit", permanent: false },
      { source: "/master-admin/org-units", destination: "/master-admin/organizational-units", permanent: false },
      { source: "/master-admin/approval-config", destination: "/master-admin/approval-configuration", permanent: false },
      { source: "/management-audit/maintenance-disposal-reports", destination: "/management-audit/maintenance-disposal", permanent: false },
      { source: "/management-audit/physical-count-reports", destination: "/management-audit/physical-count", permanent: false },
      { source: "/management-audit/audit-log", destination: "/management-audit/audit", permanent: false },
      { source: "/management-audit/forms-archive", destination: "/management-audit/forms", permanent: false },
    ];
  },
};

export default nextConfig;
