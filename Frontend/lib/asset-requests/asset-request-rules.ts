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

/**
 * What the request's one date field means for each type. It is stored as
 * `preferredDate` either way, but a return asks when you *will* bring it in
 * while every other type asks when something *happened* — and "the date it
 * happened" is unclear for a repair (nothing "happened"; it stopped working).
 */
export const REQUEST_DATE_COPY: Record<AssetRequestType, { label: string; hint: string; missing: string; detailLabel: string; future: boolean }> = {
  return: {
    label: 'When would you like to return it?',
    hint: 'Your preferred hand-over date. The custodian confirms the actual date when approving.',
    missing: 'Choose when you would like to return it.',
    detailLabel: 'Preferred return date',
    future: true,
  },
  repair: {
    label: 'When did the problem start?',
    hint: 'The date you first noticed it was not working properly — an estimate is fine.',
    missing: 'Enter the date the problem started.',
    detailLabel: 'Problem started',
    future: false,
  },
  damage: {
    label: 'When was it damaged?',
    hint: 'The date the damage happened, or when you first noticed it.',
    missing: 'Enter the date it was damaged.',
    detailLabel: 'Date damaged',
    future: false,
  },
  loss: {
    label: 'When was it lost?',
    hint: 'When you last had it, or when you noticed it was missing.',
    missing: 'Enter the date it was lost or last seen.',
    detailLabel: 'Lost / last seen',
    future: false,
  },
  theft: {
    label: 'When was it stolen?',
    hint: 'The date of the theft, or when you discovered it.',
    missing: 'Enter the date it was stolen.',
    detailLabel: 'Date stolen',
    future: false,
  },
};

export const REQUEST_DETAILS_PLACEHOLDER: Record<AssetRequestType, string> = {
  return: 'Why you are returning it, and its current condition.',
  repair: 'What is wrong — e.g. "Does not charge; battery light blinks orange." Include any error messages.',
  damage: 'How it was damaged and what is affected — e.g. "Dropped it; screen cracked, still powers on."',
  loss: 'Where and when you last had it, and where you have already searched.',
  theft: 'What happened and where, and whether it was reported to the police (attach the report if you have it).',
};

/** Who handles a request for an asset of this type (mirrors the backend routing). */
export function custodianLabelFor(assetType: string): string {
  return assetType === 'ICT' ? 'IT Asset Custodian' : 'Property Custodian';
}

/**
 * The points a holder confirms before filing — what happens next and what the
 * request locks on the item. Mirrors the one-case-per-item rule
 * (blockingRequest / supersededRequests): a return, repair or damage request
 * blocks the others of that kind but never a loss/theft report, which closes
 * it instead; an open loss/theft report blocks everything.
 */
export function filingConsequences(
  type: AssetRequestType,
  assetType: string,
  closes: Pick<AssetRequest, 'type' | 'requestNumber'>[] = [],
): string[] {
  const custodian = custodianLabelFor(assetType);
  if (INCIDENT_TYPES.has(type)) {
    return [
      `The ${custodian} is notified and prepares the incident report (RLSDDP). Keep ${type === 'theft' ? 'the police report' : 'an affidavit of loss'} ready.`,
      ...closes.map((r) => `It closes ${r.requestNumber} (${REQUEST_TYPE_LABEL[r.type].toLowerCase()}) — the item can no longer be handed over.`),
      'While it is open, no other request can be filed for this item.',
      'The item stays on your accountability record until COA grants relief.',
      'You can cancel it until the custodian processes it.',
    ];
  }
  const outcome: Record<string, string> = {
    return: 'Once the custodian receives it, it is no longer assigned to you.',
    repair: 'It stays under your accountability during the repair and comes back to you afterwards.',
    damage: 'The custodian decides whether it is repaired or written off after inspecting it.',
  };
  return [
    `The ${custodian} reviews it and tells you when to bring the item in.`,
    outcome[type],
    'While it is open, you cannot file another return, repair or damage request for this item.',
    'If the item is lost or stolen in the meantime, you can still report it — that closes this request.',
    'You can cancel it until the custodian marks the item received.',
  ];
}

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

/**
 * Mirrors AssetRequestsService.supersededRequests: filing a loss/theft closes
 * any open return / repair / damage request on the asset — the item can no
 * longer be handed over. Returns the requests that filing `type` would close.
 */
export function supersededRequests<T extends Pick<AssetRequest, 'type' | 'status'>>(
  type: AssetRequestType,
  requestsForAsset: T[],
): T[] {
  return INCIDENT_TYPES.has(type) ? requestsForAsset.filter((r) => isOpen(r) && !INCIDENT_TYPES.has(r.type)) : [];
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

/** Shortest rejection reason the server accepts (RejectAssetRequestDto). */
export const MIN_REJECT_REASON_LENGTH = 10;

/** What is wrong with a rejection reason, or null. A rejection is the requester's only explanation. */
export function rejectReasonProblem(reason: string): string | null {
  const length = reason.trim().length;
  if (length >= MIN_REJECT_REASON_LENGTH) return null;
  return `Write at least ${MIN_REJECT_REASON_LENGTH} characters so the requester knows why (${MIN_REJECT_REASON_LENGTH - length} more).`;
}
