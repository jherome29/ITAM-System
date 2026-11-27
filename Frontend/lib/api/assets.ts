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
  photoFileName: string | null;
  photoMimeType: string | null;
  status: string;
  custodianId: string | null;
  /** Who holds it — name and employee ID only. Present on the custodians' asset list. */
  custodian?: { id: string; name: string; employeeId: string } | null;
  lastIssuedAt?: string | null;
  lastIssuedFor?: string | null;
  lastIssuedRequisitionId?: string | null;
  quantity: number;
  reorderLevel: number | null;
  expectedReturnDate: string | null;
  /** Lists only: while transferred, where the latest transfer sent it (its location column still shows where it came from). */
  transferredTo?: string | null;
  /** The asset's own record only: its transfers and other moves, with destinations. */
  locationHistory?: Array<{
    id: string;
    action: string;
    fromLocation: string | null;
    toLocation: string | null;
    notes: string | null;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/** Server-computed replacement rule (CLAUDE.md §17) for one of my assets. */
export interface ReplacementEligibility {
  eligible: boolean;
  basis:
    | 'condition'
    | 'useful_life'
    | 'repeat_repair'
    | 'loss_or_damage'
    | null;
  reason: string;
  /** An open replacement requisition for this asset, if one exists. */
  openRequestNumber: string | null;
}

/** An asset from GET /v1/assets/mine — the holder's view. */
export type MyAsset = Asset & {
  replacement: ReplacementEligibility;
  /** While under repair: where it is and when it is due back. */
  repair: { serviceType: 'in_house' | 'external'; serviceProvider: string | null; openedAt: string; dueDate: string } | null;
};

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
  inventoryByType: Record<string, number>;
  total: number;
  available: number;
  issued: number;
  underRepair: number;
  flaggedForDisposal: number;
  transferred: number;
  returned: number;
  disposed: number;
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
  officeOrSection?: string; // Arrival (transferred → available) — where it now sits
  officeLocation?: string; // Arrival (transferred → available) — room / floor
  disposalDate?: string;
  disposalMethod?: string;
  disposalReference?: string;
  disposalConfirmed?: boolean;
}

export interface UpdateAssetDto {
  sapClassification?: string;
  itemCode?: string;
  itemDescription?: string;
  brand?: string;
  serialNumber?: string;
  propertyNumber?: string | null;
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
    view?: "inventory",
  ) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    if (assetType) params.assetType = assetType;
    if (assetClass) params.assetClass = assetClass;
    if (view) params.view = view;
    return client
      .get<ApiResponse<PaginatedResponse<Asset>>>("/v1/assets", { params })
      .then((r) => r.data);
  },

  stats: () =>
    client.get<ApiResponse<AssetStats>>("/v1/assets/stats").then((r) => r.data),

  custody: (page: number, limit: number) =>
    client.get<ApiResponse<PaginatedResponse<Asset>>>("/v1/assets", {
      params: { page, limit, view: "custody" },
    }).then((r) => r.data),

  disposalQueue: (page: number, limit: number) =>
    client.get<ApiResponse<PaginatedResponse<Asset>>>("/v1/assets", {
      params: { page, limit, view: "disposal" },
    }).then((r) => r.data),

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
    client.get<ApiResponse<MyAsset[]>>('/v1/assets/mine').then((r) => r.data),

  findByInventoryTag: (value: string, signal?: AbortSignal) =>
    client.get<ApiResponse<Asset>>('/v1/assets/tag-lookup', { params: { value }, signal }).then((r) => r.data),

  getOne: (id: string) =>
    client.get<ApiResponse<Asset>>(`/v1/assets/${id}`).then((r) => r.data),

  markUnserviceable: (id: string, reason: string) =>
    client.patch<ApiResponse<Asset>>(`/v1/assets/${id}/lifecycle`, {
      status: 'flagged_for_disposal', notes: reason.trim(),
    }).then((r) => r.data),

  create: (dto: CreateAssetDto) =>
    client.post<ApiResponse<Asset>>("/v1/assets", dto).then((r) => r.data),

  updateLifecycle: (id: string, dto: UpdateLifecycleDto) =>
    client
      .patch<ApiResponse<Asset>>(`/v1/assets/${id}/lifecycle`, dto)
      .then((r) => r.data),

  generateQr: (id: string) =>
    client
      .post<ApiResponse<{ qrCode: string; barcodeValue: string; assetId: string }>>(`/v1/assets/${id}/qr`)
      .then((r) => r.data),

  update: (id: string, dto: UpdateAssetDto) =>
    client
      .patch<ApiResponse<Asset>>(`/v1/assets/${id}`, dto)
      .then((r) => r.data),

  photo: (id: string) =>
    client.get<Blob>(`/v1/assets/${id}/photo`, { responseType: "blob" }).then((r) => r.data),

  uploadPhoto: (id: string, photo: File) => {
    const body = new FormData();
    body.append("photo", photo);
    return client.post<ApiResponse<Asset>>(`/v1/assets/${id}/photo`, body).then((r) => r.data);
  },

  deletePhoto: (id: string) =>
    client.delete<ApiResponse<Asset>>(`/v1/assets/${id}/photo`).then((r) => r.data),
};
