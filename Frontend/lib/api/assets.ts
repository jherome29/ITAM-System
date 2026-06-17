import client, { type ApiResponse, type PaginatedResponse } from './client';

export interface Asset {
  id: string;
  sapClassification: string;
  itemCode: string;
  itemDescription: string;
  brand: string;
  serialNumber: string;
  propertyNumber: string;
  components: string;
  acquisitionCost: number;
  acquisitionDate: string;
  accountableOfficer: string;
  division: string;
  officeOrSection: string;
  officeLocation: string;
  condition: string;
  supplier: string;
  dateOfDelivery: string;
  assetClass: string;
  assetType: string;
  qrCode: string;
  barcodeValue: string;
  status: string;
  custodianId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetStats {
  total: number;
  available: number;
  issued: number;
  underRepair: number;
  flaggedForDisposal: number;
  transferred: number;
}

export interface CreateAssetDto {
  itemDescription: string;
  assetClass: string;
  assetType: string;
  sapClassification?: string;
  itemCode?: string;
  propertyNumber?: string;
  brand?: string;
  serialNumber?: string;
  components?: string;
  acquisitionCost?: number;
  acquisitionDate?: string;
  supplier?: string;
  dateOfDelivery?: string;
  accountableOfficer?: string;
  division?: string;
  officeOrSection?: string;
  officeLocation?: string;
  condition?: string;
}

export interface UpdateLifecycleDto {
  status: string;
  notes?: string;
  employeeId?: string;    // For ISSUED — backend resolves to custodian UUID
  toLocation?: string;    // For TRANSFERRED — receiving office/section
  fromLocation?: string;
}

export interface UpdateAssetDto {
  sapClassification?: string;
  itemCode?: string;
  itemDescription?: string;
  brand?: string;
  serialNumber?: string;
  propertyNumber?: string;
  components?: string;
  acquisitionCost?: number;
  acquisitionDate?: string;
  accountableOfficer?: string;
  division?: string;
  officeOrSection?: string;
  officeLocation?: string;
  condition?: string;
  supplier?: string;
  dateOfDelivery?: string;
}

export const assetsApi = {
  list: (page = 1, limit = 15, search?: string, status?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    return client.get<ApiResponse<PaginatedResponse<Asset>>>('/v1/assets', { params }).then((r) => r.data);
  },

  stats: () =>
    client.get<ApiResponse<AssetStats>>('/v1/assets/stats').then((r) => r.data),

  catalogue: () =>
    client.get<ApiResponse<PaginatedResponse<Asset>>>('/v1/assets/catalogue').then((r) => r.data),

  getOne: (id: string) =>
    client.get<ApiResponse<Asset>>(`/v1/assets/${id}`).then((r) => r.data),

  create: (dto: CreateAssetDto) =>
    client.post<ApiResponse<Asset>>('/v1/assets', dto).then((r) => r.data),

  updateLifecycle: (id: string, dto: UpdateLifecycleDto) =>
    client.patch<ApiResponse<Asset>>(`/v1/assets/${id}/lifecycle`, dto).then((r) => r.data),

  generateQr: (id: string) =>
    client.post<ApiResponse<{ qrCode: string }>>(`/v1/assets/${id}/qr`).then((r) => r.data),

  update: (id: string, dto: UpdateAssetDto) =>
    client.patch<ApiResponse<Asset>>(`/v1/assets/${id}`, dto).then((r) => r.data),
};
