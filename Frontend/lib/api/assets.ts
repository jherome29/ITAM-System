import client, { type ApiResponse, type PaginatedResponse } from "./client";

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
  quantity: number;
  reorderLevel: number | null;
  expectedReturnDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One grouped, requestable line from GET /v1/assets/catalogue/items. */
export interface CatalogueItem {
  itemDescription: string;
  brand: string | null;
  itemCode: string | null;
  assetType: string;
  assetClass: string;
  isSupply: boolean;
  /** Units available (PPE/SEP) or quantity on hand (IES). */
  available: number;
  conditions: string[];
  locations: string[];
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
  quantity?: number; // IES only — supply stock on hand
  reorderLevel?: number; // IES only — low-stock alert threshold
}

export interface UpdateLifecycleDto {
  status: string;
  notes?: string;
  employeeId?: string; // For ISSUED — backend resolves to custodian UUID
  toLocation?: string; // For TRANSFERRED — receiving office/section
  fromLocation?: string;
  expectedReturnDate?: string; // For ISSUED — arms the overdue-return watcher
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
  quantity?: number; // IES only — supply stock on hand
  reorderLevel?: number; // IES only — low-stock alert threshold
}

export const assetsApi = {
  list: (
    page = 1,
    limit = 15,
    search?: string,
    status?: string,
    assetType?: string,
    assetClass?: string,
  ) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    if (assetType) params.assetType = assetType;
    if (assetClass) params.assetClass = assetClass;
    return client
      .get<ApiResponse<PaginatedResponse<Asset>>>("/v1/assets", { params })
      .then((r) => r.data);
  },

  stats: () =>
    client.get<ApiResponse<AssetStats>>("/v1/assets/stats").then((r) => r.data),

  catalogue: () =>
    client
      .get<ApiResponse<PaginatedResponse<Asset>>>("/v1/assets/catalogue")
      .then((r) => r.data),

  catalogueItems: (params: { search?: string; assetType?: string; assetClass?: string; limit?: number } = {}) => {
    const query: Record<string, string | number> = {};
    if (params.search) query.search = params.search;
    if (params.assetType) query.assetType = params.assetType;
    if (params.assetClass) query.assetClass = params.assetClass;
    if (params.limit) query.limit = params.limit;
    return client
      .get<ApiResponse<CatalogueItem[]>>("/v1/assets/catalogue/items", { params: query })
      .then((r) => r.data);
  },

  /** Assets currently assigned to the logged-in user (custodianId = me). */
  mine: () =>
    client.get<ApiResponse<Asset[]>>('/v1/assets/mine').then((r) => r.data),

  getOne: (id: string) =>
    client.get<ApiResponse<Asset>>(`/v1/assets/${id}`).then((r) => r.data),

  create: (dto: CreateAssetDto) =>
    client.post<ApiResponse<Asset>>("/v1/assets", dto).then((r) => r.data),

  updateLifecycle: (id: string, dto: UpdateLifecycleDto) =>
    client
      .patch<ApiResponse<Asset>>(`/v1/assets/${id}/lifecycle`, dto)
      .then((r) => r.data),

  generateQr: (id: string) =>
    client
      .post<ApiResponse<{ qrCode: string }>>(`/v1/assets/${id}/qr`)
      .then((r) => r.data),

  update: (id: string, dto: UpdateAssetDto) =>
    client
      .patch<ApiResponse<Asset>>(`/v1/assets/${id}`, dto)
      .then((r) => r.data),
};
