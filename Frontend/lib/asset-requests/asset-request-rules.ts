import type { AssetRequest, AssetRequestStatus, AssetRequestType } from '@/lib/api/asset-requests';

export const REQUEST_TYPE_LABEL: Record<AssetRequestType, string> = {
  return: 'Return request',
  repair: 'Repair request',
  damage: 'Damage report',
  loss: 'Loss report',
  theft: 'Theft report',
};

export const REQUEST_STATUS_LABEL: Record<AssetRequestStatus, string> = {
  submitted: 'Awaiting custodian',
  approved: 'Approved — hand-over pending',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const REQUEST_STATUS_TONE: Record<AssetRequestStatus, 'amber' | 'blue' | 'green' | 'red' | 'slate'> = {
  submitted: 'amber',
  approved: 'blue',
  completed: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

export const ALL_REQUEST_TYPES: AssetRequestType[] = ['return', 'repair', 'damage', 'loss', 'theft'];

const INCIDENT_TYPES = new Set<AssetRequestType>(['loss', 'theft']);

export function isOpen(r: Pick<AssetRequest, 'status'>): boolean {
  return r.status === 'submitted' || r.status === 'approved';
}

/**
 * Mirrors the backend rule (AssetRequestsService.blockingRequest): one open
 * request per asset, except a loss/theft can still be reported while a
 * return/repair/damage request is pending; nothing else while an incident is
 * open. Returns the open request that blocks `type`, if any.
 */
export function blockingRequest<T extends Pick<AssetRequest, 'type' | 'status'>>(
  type: AssetRequestType,
  requestsForAsset: T[],
): T | undefined {
  const open = requestsForAsset.filter(isOpen);
  return INCIDENT_TYPES.has(type) ? open.find((r) => INCIDENT_TYPES.has(r.type)) : open[0];
}

export function allowedTypes(requestsForAsset: Pick<AssetRequest, 'type' | 'status'>[]): AssetRequestType[] {
  return ALL_REQUEST_TYPES.filter((type) => !blockingRequest(type, requestsForAsset));
}

/**
 * What the custodian can do with a request in its current state. Reject is the
 * alternative to Approve — once approved, the only step left is Mark received.
 */
export function custodianActions(status: AssetRequestStatus): Array<'approve' | 'reject' | 'complete'> {
  if (status === 'submitted') return ['approve', 'reject'];
  if (status === 'approved') return ['complete'];
  return [];
}

export function completeActionLabel(type: AssetRequestType): string {
  if (type === 'return') return 'Mark received';
  if (type === 'repair' || type === 'damage') return 'Mark received for repair';
  return 'Confirm & flag for disposal';
}

export const FORM_LABEL: Record<string, string> = {
  RECEIPT_RETURNED_PROPERTY: 'Receipt of Returned Property',
  RECEIPT_RETURNED_SEP: 'Receipt of Returned Semi-Expendable Property',
  IIRUP: 'Inventory and Inspection Report of Unserviceable Property (IIRUP)',
  RLSDDP: 'Report of Lost, Stolen, Damaged or Destroyed Property (RLSDDP)',
};

type RequestForGuidance = Pick<
  AssetRequest,
  'type' | 'status' | 'handoverDate' | 'custodianLabel' | 'asset' | 'resultingStatus' | 'accountabilityCleared' | 'requester'
>;

/** The item plus each accessory recorded in the asset's components field. */
export function bringList(r: Pick<AssetRequest, 'asset'>): string[] {
  if (!r.asset) return [];
  const parts = (r.asset.components ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [r.asset.itemDescription, ...parts];
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Requester-facing guidance once the custodian approves: what to bring and
 * what will happen — mirrors the documents the backend generates on completion
 * (AssetRequestsService.requiredDocuments).
 */
export function nextSteps(r: RequestForGuidance): { title: string; bring: string[]; notes: string[] } | null {
  if (r.status !== 'approved') return null;
  const custodian = r.custodianLabel ?? 'custodian';
  const when = r.handoverDate ? ` on ${shortDate(r.handoverDate)}` : '';
  if (r.type === 'loss' || r.type === 'theft') {
    return {
      title: 'Before the report is completed',
      bring: [r.type === 'theft' ? 'Police report' : 'Affidavit of loss', 'Any other proof of the circumstances'],
      notes: [
        `Bring these to the ${custodian}${when}.`,
        `The ${custodian} prepares the RLSDDP for your signature.`,
        'The item stays on your accountability record until COA grants relief.',
      ],
    };
  }
  const outcome: Record<string, string> = {
    return: 'You will sign the Receipt of Returned Property — your proof of return, downloadable here once received.',
    repair: 'The item will be repaired and returned to you; it stays under your accountability.',
    damage: 'The custodian inspects it and either sends it for repair or flags it for disposal. An RLSDDP is prepared for the damage.',
  };
  return {
    title: 'What to bring',
    bring: bringList(r),
    notes: [`Hand it over to the ${custodian}${when}.`, outcome[r.type]],
  };
}

/** What completion meant for the holder, shown on a completed request. */
export function outcomeSummary(r: RequestForGuidance): { tone: 'green' | 'amber' | 'blue'; text: string } | null {
  if (r.status !== 'completed') return null;
  const holder = r.requester?.name ?? 'the holder';
  if (r.accountabilityCleared) {
    return { tone: 'green', text: `Accountability cleared — this item is no longer assigned to ${holder}.` };
  }
  if (r.type === 'loss' || r.type === 'theft') {
    return { tone: 'amber', text: `Incident documented. The item stays on ${holder}'s accountability record until COA grants relief.` };
  }
  return { tone: 'blue', text: `Received for repair — it will be returned to ${holder} and stays under their accountability.` };
}

// Client-side mirror of the upload limits in Backend attachment-files.ts. The
// server re-checks every file by content; this is only for instant feedback.
export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export function fileProblem(files: Pick<File, 'name' | 'size' | 'type'>[]): string | null {
  if (files.length > MAX_FILES) return `Attach at most ${MAX_FILES} files.`;
  for (const f of files) {
    if (!ALLOWED_MIME.has(f.type)) return `"${f.name}" must be a JPG, PNG, WEBP or PDF.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" is larger than 5 MB.`;
  }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
