import client, { type ApiResponse } from './client';

export type RepairServiceType = 'in_house' | 'external';
export type RepairOutcome = 'repaired' | 'unrepairable';

/** One stay in `under_repair` — mirrors AssetRepairsService.toView. */
export interface Repair {
  id: string;
  assetRequestId: string | null;
  openedAt: string;
  reportedProblem: string | null;
  serviceType: RepairServiceType;
  serviceProvider: string | null;
  expectedCompletionDate: string | null;
  /** Expected completion date, or the default turnaround from opening. */
  dueDate: string;
  /** The due date if no expected date were set: opened + the default turnaround. */
  defaultDueDate: string;
  overdue: boolean;
  findings: string | null;
  actionTaken: string | null;
  outcome: RepairOutcome | null;
  completedAt: string | null;
  completedBy: { id: string; name: string; employeeId: string } | null;
  holder: { id: string; name: string; employeeId: string } | null;
  asset: {
    id: string;
    itemDescription: string;
    propertyNumber: string | null;
    serialNumber: string | null;
    assetType: string;
    assetClass: string;
    status: string;
    condition: string;
    components: string | null;
  } | null;
  custodianLabel: string | null;
  /** Unit lent to the holder while this one is repaired. */
  loaner: {
    id: string;
    itemDescription: string;
    propertyNumber: string | null;
    serialNumber: string | null;
    status: string;
    expectedReturnDate: string | null;
    /** Still out with the person it was lent to. */
    withHolder: boolean;
  } | null;
  /** Whether the viewer may update / close it (server-decided). */
  canAct: boolean;
}

export interface UpdateRepairInput {
  serviceType?: RepairServiceType;
  serviceProvider?: string;
  /** '' clears it (back to the default turnaround). */
  expectedCompletionDate?: string;
  findings?: string;
  actionTaken?: string;
}

export interface CompleteRepairInput {
  outcome: RepairOutcome;
  findings?: string;
  actionTaken: string;
  returnToStock?: boolean;
}

export const repairsApi = {
  /** `status`: 'open' | 'closed' | undefined (all). Scoped by asset type server-side. */
  list: (status?: 'open' | 'closed') =>
    client.get<ApiResponse<Repair[]>>('/v1/repairs', { params: status ? { status } : {} }).then((r) => r.data),

  forAsset: (assetId: string) =>
    client.get<ApiResponse<Repair[]>>(`/v1/repairs/asset/${assetId}`).then((r) => r.data),

  getOne: (id: string) => client.get<ApiResponse<Repair>>(`/v1/repairs/${id}`).then((r) => r.data),

  update: (id: string, dto: UpdateRepairInput) =>
    client.patch<ApiResponse<Repair>>(`/v1/repairs/${id}`, dto).then((r) => r.data),

  complete: (id: string, dto: CompleteRepairInput) =>
    client.post<ApiResponse<Repair>>(`/v1/repairs/${id}/complete`, dto).then((r) => r.data),

  /** Lend the holder an available unit of the same type; due back by `expectedReturnDate` (default: the repair's due date). */
  issueLoaner: (id: string, dto: { assetId: string; expectedReturnDate?: string }) =>
    client.post<ApiResponse<Repair>>(`/v1/repairs/${id}/loaner`, dto).then((r) => r.data),
};

export const SERVICE_TYPE_LABEL: Record<RepairServiceType, string> = {
  in_house: 'In-house',
  external: 'External service',
};

export const OUTCOME_LABEL: Record<RepairOutcome, string> = {
  repaired: 'Repaired',
  unrepairable: 'Not repairable',
};
