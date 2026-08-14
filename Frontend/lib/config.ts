export const appConfig = {
  useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false',
  enableRolePreview: process.env.NEXT_PUBLIC_ENABLE_ROLE_PREVIEW !== 'false',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'AIMRS',
  appFullName:
    process.env.NEXT_PUBLIC_APP_FULL_NAME ??
    'Asset Inventory Management and Requisition System',
  orgName:
    process.env.NEXT_PUBLIC_ORG_NAME ??
    'Cybercrime Investigation and Coordinating Center',
  isProduction: process.env.NODE_ENV === 'production',
};
