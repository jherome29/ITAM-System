import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAssetDto } from '../../src/assets/dto/create-asset.dto';
import { CreateRequisitionDto } from '../../src/requisitions/dto/create-requisition.dto';
import { CreateAssetRequestDto } from '../../src/asset-requests/dto/asset-request.dto';
import {
  AssetClass,
  AssetCondition,
  AssetRequestType,
  AssetType,
  RequisitionType,
  UserRole,
} from '../../../packages/shared/src/enums';
import { USEFUL_LIFE_YEARS } from '../../../packages/shared/src/constants';

// Pilot demo data — every role gets something real to look at or act on.
//
// Everything here is fictional and tagged so it can never be mistaken for CICC
// records or hunted down later: assets carry a DEMO- property number and serial,
// and every free-text request starts with DEMO_TAG. The data is replayed through
// the real API by seed.ts (so numbering, notifications, audit trail and COA forms
// all behave exactly as in use) — nothing here is inserted into the database
// directly.

export const DEMO_TAG = '[DEMO]';
export const DEMO_PROPERTY_PREFIX = 'DEMO-';

/** Who registers, issues and fulfils for an asset type (CLAUDE.md §4). */
export type CustodianRole = UserRole.IT_PERSONNEL | UserRole.PROPERTY_CUSTODIAN;

export function custodianFor(assetType: AssetType): CustodianRole {
  return assetType === AssetType.ICT
    ? UserRole.IT_PERSONNEL
    : UserRole.PROPERTY_CUSTODIAN;
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface DemoAsset {
  /** Stable handle other parts of the scenario refer to. */
  key: string;
  dto: CreateAssetDto;
}

const IT_STORE = {
  division: 'Information Technology',
  officeOrSection: 'Systems Administration',
  officeLocation: 'IT Storeroom, 3rd Floor',
};
const SUPPLY_STORE = {
  division: 'Property and Supply Management',
  officeOrSection: 'Property Custody Unit',
  officeLocation: 'Supply Room, 2nd Floor',
};
const COMMON = {
  condition: AssetCondition.SERVICEABLE,
  supplier: 'DEMO Supplier Inc.',
};

let serialCounter = 0;
function unit(
  key: string,
  prefix: 'ICT' | 'FIX' | 'SUP',
  number: number,
  dto: Omit<
    CreateAssetDto,
    'propertyNumber' | 'serialNumber' | 'condition' | 'supplier'
  >,
): DemoAsset {
  serialCounter += 1;
  return {
    key,
    dto: {
      ...COMMON,
      ...dto,
      propertyNumber: `${DEMO_PROPERTY_PREFIX}${prefix}-${String(number).padStart(4, '0')}`,
      serialNumber: `${DEMO_PROPERTY_PREFIX}SN-${String(serialCounter).padStart(4, '0')}`,
    },
  };
}

const laptop = {
  itemDescription: 'Dell Latitude 5440 Laptop',
  brand: 'Dell',
  acquisitionCost: 46_500,
  acquisitionDate: '2025-08-12',
  dateOfDelivery: '2025-08-26',
  assetClass: AssetClass.SEP,
  assetType: AssetType.ICT,
  ...IT_STORE,
};
const monitor = {
  itemDescription: 'Dell P2422H 24-inch Monitor',
  brand: 'Dell',
  acquisitionCost: 9_800,
  acquisitionDate: '2025-08-12',
  dateOfDelivery: '2025-08-26',
  assetClass: AssetClass.SEP,
  assetType: AssetType.ICT,
  ...IT_STORE,
};
const chair = {
  itemDescription: 'Ergonomic Office Chair',
  brand: 'Uratex',
  acquisitionCost: 6_500,
  acquisitionDate: '2025-05-20',
  dateOfDelivery: '2025-06-03',
  assetClass: AssetClass.SEP,
  assetType: AssetType.FIXED,
  ...SUPPLY_STORE,
};

export const DEMO_ASSETS: DemoAsset[] = [
  // ── ICT, registered by IT Personnel ───────────────────────────────────────
  unit('laptop-a', 'ICT', 1, laptop),
  unit('laptop-b', 'ICT', 2, laptop),
  unit('laptop-c', 'ICT', 3, laptop),
  unit('monitor-a', 'ICT', 4, monitor),
  unit('monitor-b', 'ICT', 5, monitor),
  unit('forensic-workstation', 'ICT', 6, {
    itemDescription: 'Forensic Workstation, Intel Core i9, 64GB RAM',
    brand: 'Custom Build',
    components: 'Write blocker, 2x 4TB evidence drives, keyboard, mouse',
    acquisitionCost: 245_000,
    acquisitionDate: '2025-11-03',
    dateOfDelivery: '2025-11-17',
    assetClass: AssetClass.PPE,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('network-switch', 'ICT', 7, {
    itemDescription: 'Cisco Catalyst 2960-X 24-port Switch',
    brand: 'Cisco',
    acquisitionCost: 72_000,
    acquisitionDate: '2025-03-14',
    dateOfDelivery: '2025-03-28',
    assetClass: AssetClass.PPE,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('desktop-old', 'ICT', 8, {
    itemDescription: 'Dell OptiPlex 7010 Desktop Computer',
    brand: 'Dell',
    components: 'Keyboard, mouse, power cord',
    acquisitionCost: 41_200,
    acquisitionDate: '2020-06-15',
    dateOfDelivery: '2020-06-29',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('printer-old', 'ICT', 9, {
    itemDescription: 'HP LaserJet Pro M404dn Printer',
    brand: 'HP',
    acquisitionCost: 18_500,
    acquisitionDate: '2021-02-10',
    dateOfDelivery: '2021-02-24',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('ups-repair', 'ICT', 10, {
    itemDescription: 'APC Smart-UPS 1500VA',
    brand: 'APC',
    acquisitionCost: 28_000,
    acquisitionDate: '2025-01-22',
    dateOfDelivery: '2025-02-05',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('keyboard-set', 'ICT', 11, {
    itemDescription: 'Logitech MK270 Wireless Keyboard and Mouse Set',
    brand: 'Logitech',
    acquisitionCost: 1_800,
    acquisitionDate: '2025-09-02',
    dateOfDelivery: '2025-09-09',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('laptop-lost', 'ICT', 12, {
    itemDescription: 'Lenovo ThinkPad T14 Laptop',
    brand: 'Lenovo',
    acquisitionCost: 44_000,
    acquisitionDate: '2024-04-09',
    dateOfDelivery: '2024-04-23',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),
  unit('projector-loan', 'ICT', 13, {
    itemDescription: 'Epson EB-X49 Projector',
    brand: 'Epson',
    acquisitionCost: 32_000,
    acquisitionDate: '2025-02-18',
    dateOfDelivery: '2025-03-04',
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
    ...IT_STORE,
  }),

  // ── Fixed assets, registered by the Property Custodian ────────────────────
  unit('chair-a', 'FIX', 1, chair),
  unit('chair-b', 'FIX', 2, chair),
  unit('filing-cabinet', 'FIX', 3, {
    itemDescription: 'Steel Filing Cabinet, 4-Drawer',
    brand: 'Orocan',
    acquisitionCost: 8_900,
    acquisitionDate: '2025-05-20',
    dateOfDelivery: '2025-06-03',
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),
  unit('aircon', 'FIX', 4, {
    itemDescription: 'Split-Type Air Conditioner, 2.0 HP',
    brand: 'Carrier',
    acquisitionCost: 58_000,
    acquisitionDate: '2025-04-08',
    dateOfDelivery: '2025-04-22',
    assetClass: AssetClass.PPE,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),
  unit('desk-damaged', 'FIX', 5, {
    itemDescription: 'Executive Office Desk',
    brand: 'Uratex',
    acquisitionCost: 14_500,
    acquisitionDate: '2023-07-11',
    dateOfDelivery: '2023-07-25',
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),
  unit('fan-return', 'FIX', 6, {
    itemDescription: 'Industrial Stand Fan, 20-inch',
    brand: 'Asahi',
    acquisitionCost: 3_200,
    acquisitionDate: '2025-06-30',
    dateOfDelivery: '2025-07-07',
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),
  // Older units the demo employee already holds: replacement validation is
  // scoped by asset type, so the Property Officer needs Fixed examples of its
  // own — a cabinet with a replacement request open, a chair that qualifies but
  // has none yet, and a TV reported stolen.
  unit('cabinet-old', 'FIX', 7, {
    itemDescription: 'Steel Filing Cabinet, 4-Drawer',
    brand: 'Orocan',
    acquisitionCost: 8_900,
    acquisitionDate: '2019-03-12',
    dateOfDelivery: '2019-03-26',
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),
  unit('chair-old', 'FIX', 8, {
    ...chair,
    acquisitionDate: '2021-05-10',
    dateOfDelivery: '2021-05-24',
  }),
  unit('tv-stolen', 'FIX', 9, {
    itemDescription: 'Samsung 43-inch Smart TV',
    brand: 'Samsung',
    acquisitionCost: 27_000,
    acquisitionDate: '2024-02-19',
    dateOfDelivery: '2024-03-04',
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
    ...SUPPLY_STORE,
  }),

  // ── Supplies (IES), registered by the Property Custodian ──────────────────
  unit('paper', 'SUP', 1, {
    itemDescription: 'A4 Bond Paper, 80gsm (ream)',
    brand: 'Hard Copy',
    acquisitionCost: 250,
    acquisitionDate: '2026-09-01',
    dateOfDelivery: '2026-09-08',
    assetClass: AssetClass.IES,
    assetType: AssetType.SUPPLIES,
    quantity: 120,
    reorderLevel: 30,
    ...SUPPLY_STORE,
  }),
  unit('pens', 'SUP', 2, {
    itemDescription: 'Ballpoint Pen, Black (box of 50)',
    brand: 'HBW',
    acquisitionCost: 320,
    acquisitionDate: '2026-08-04',
    dateOfDelivery: '2026-08-11',
    assetClass: AssetClass.IES,
    assetType: AssetType.SUPPLIES,
    quantity: 8,
    reorderLevel: 20,
    ...SUPPLY_STORE,
  }),
  unit('toner', 'SUP', 3, {
    itemDescription: 'Printer Toner Cartridge CF258A',
    brand: 'HP',
    acquisitionCost: 6_800,
    acquisitionDate: '2026-09-15',
    dateOfDelivery: '2026-09-22',
    assetClass: AssetClass.IES,
    assetType: AssetType.SUPPLIES,
    quantity: 6,
    reorderLevel: 5,
    ...SUPPLY_STORE,
  }),
  unit('folders', 'SUP', 4, {
    itemDescription: 'Folder, Long, Brown (pack of 100)',
    brand: 'Sterling',
    acquisitionCost: 480,
    acquisitionDate: '2026-09-01',
    dateOfDelivery: '2026-09-08',
    assetClass: AssetClass.IES,
    assetType: AssetType.SUPPLIES,
    quantity: 40,
    reorderLevel: 10,
    ...SUPPLY_STORE,
  }),
];

// ── Issuances ────────────────────────────────────────────────────────────────
// Units handed to the demo employee up front, so the holder-side flows (return,
// repair, loss, damage, replacement) have something real to act on.

export interface DemoIssuance {
  asset: string;
  /** Loaned items only. Negative = already overdue, which raises the overdue-return alert. */
  expectedReturnInDays?: number;
}

export const DEMO_ISSUANCES: DemoIssuance[] = [
  { asset: 'desktop-old' },
  { asset: 'printer-old' },
  { asset: 'ups-repair' },
  { asset: 'keyboard-set' },
  { asset: 'laptop-lost' },
  { asset: 'projector-loan', expectedReturnInDays: -3 },
  { asset: 'desk-damaged' },
  { asset: 'fan-return' },
  { asset: 'cabinet-old' },
  { asset: 'chair-old' },
  { asset: 'tv-stolen' },
];

// ── Requisitions (employee → supervisor → custodian) ─────────────────────────

export type RequisitionOutcome =
  | 'pending' //   submitted, waiting on the supervisor
  | 'approved' //  supervisor approved, waiting on the custodian
  | 'rejected' //  supervisor rejected
  | 'on_hold' //   approved, custodian put it on hold
  | 'fulfilled'; // approved and fulfilled

export interface DemoRequisition {
  key: string;
  type: RequisitionType;
  justification: string;
  requiredInDays: number;
  items: Array<{
    assetType: AssetType;
    assetClass: AssetClass;
    itemDescription: string;
    quantity: number;
  }>;
  /** Replacement only — the issued asset being replaced. */
  replaces?: string;
  outcome: RequisitionOutcome;
  /** Supervisor's approve / reject comment. Required when rejected. */
  comments?: string;
  /** Required when on hold. */
  holdReason?: string;
  /** Required when fulfilled: one asset key per item line, plus whether to hand the unit over. */
  fulfil?: { notes: string; assets: string[]; issue?: boolean };
}

const ICT_SEP = { assetType: AssetType.ICT, assetClass: AssetClass.SEP };
const FIXED_SEP = { assetType: AssetType.FIXED, assetClass: AssetClass.SEP };
const SUPPLY = { assetType: AssetType.SUPPLIES, assetClass: AssetClass.IES };

export const DEMO_REQUISITIONS: DemoRequisition[] = [
  // Waiting on the supervisor — the Approving Officer's queue.
  {
    key: 'laptop-pending',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} Field investigators need a laptop for on-site device imaging and evidence logging.`,
    requiredInDays: 14,
    items: [
      { ...ICT_SEP, itemDescription: laptop.itemDescription, quantity: 1 },
    ],
    outcome: 'pending',
  },
  {
    key: 'monitor-pending',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} A second screen for reviewing seized-device images side by side.`,
    requiredInDays: 10,
    items: [
      { ...ICT_SEP, itemDescription: monitor.itemDescription, quantity: 1 },
    ],
    outcome: 'pending',
  },
  {
    key: 'paper-pending',
    type: RequisitionType.SUPPLY,
    justification: `${DEMO_TAG} Printing of case folders and monthly reports for the section.`,
    requiredInDays: 7,
    items: [
      {
        ...SUPPLY,
        itemDescription: 'A4 Bond Paper, 80gsm (ream)',
        quantity: 5,
      },
    ],
    outcome: 'pending',
  },

  // Approved — waiting on the custodians.
  {
    key: 'monitor-approved',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} Replacement display for the evidence-review desk; the old one flickers.`,
    requiredInDays: 7,
    items: [
      { ...ICT_SEP, itemDescription: monitor.itemDescription, quantity: 1 },
    ],
    outcome: 'approved',
    comments: 'Approved — needed for the evidence-review desk.',
  },
  {
    key: 'chair-approved',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} Chair for the new analyst joining the section next week.`,
    requiredInDays: 5,
    items: [
      { ...FIXED_SEP, itemDescription: chair.itemDescription, quantity: 1 },
    ],
    outcome: 'approved',
    comments: 'Approved. New hire starts Monday.',
  },
  {
    key: 'toner-approved',
    type: RequisitionType.SUPPLY,
    justification: `${DEMO_TAG} Toner for the section printer, which is down to its last cartridge.`,
    requiredInDays: 3,
    items: [
      {
        ...SUPPLY,
        itemDescription: 'Printer Toner Cartridge CF258A',
        quantity: 2,
      },
    ],
    outcome: 'approved',
    comments: 'Approved.',
  },
  {
    key: 'replacement-desktop',
    type: RequisitionType.REPLACEMENT,
    justification: `${DEMO_TAG} The assigned desktop is well past its useful life and can no longer run the current forensic tools.`,
    requiredInDays: 14,
    items: [
      { ...ICT_SEP, itemDescription: laptop.itemDescription, quantity: 1 },
    ],
    replaces: 'desktop-old',
    outcome: 'approved',
    comments:
      'Approved — the unit is past its useful life. Please turn in the old desktop on hand-over.',
  },
  {
    key: 'replacement-cabinet',
    type: RequisitionType.REPLACEMENT,
    justification: `${DEMO_TAG} The cabinet drawers no longer close properly and the lock is broken; the unit is past its useful life.`,
    requiredInDays: 14,
    items: [
      {
        ...FIXED_SEP,
        itemDescription: 'Steel Filing Cabinet, 4-Drawer',
        quantity: 1,
      },
    ],
    replaces: 'cabinet-old',
    outcome: 'approved',
    comments:
      'Approved — case files need a lockable cabinet. Turn in the old one on hand-over.',
  },

  // Already through the whole workflow — history for every role.
  {
    key: 'paper-fulfilled',
    type: RequisitionType.SUPPLY,
    justification: `${DEMO_TAG} Quarterly paper allotment for the section.`,
    requiredInDays: 2,
    items: [
      {
        ...SUPPLY,
        itemDescription: 'A4 Bond Paper, 80gsm (ream)',
        quantity: 10,
      },
    ],
    outcome: 'fulfilled',
    comments: 'Approved — within the quarterly allotment.',
    fulfil: {
      notes: 'Released 10 reams from the supply room.',
      assets: ['paper'],
    },
  },
  {
    key: 'laptop-fulfilled',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} Laptop for the cyber-patrol team's field monitoring.`,
    requiredInDays: 4,
    items: [
      { ...ICT_SEP, itemDescription: laptop.itemDescription, quantity: 1 },
    ],
    outcome: 'fulfilled',
    comments: 'Approved. Field monitoring is a priority this quarter.',
    fulfil: {
      notes: 'Issued with charger and carrying case.',
      assets: ['laptop-c'],
      issue: true,
    },
  },

  // Not every request goes through.
  {
    key: 'laptop-rejected',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} A spare laptop to keep at home for convenience.`,
    requiredInDays: 30,
    items: [
      { ...ICT_SEP, itemDescription: laptop.itemDescription, quantity: 1 },
    ],
    outcome: 'rejected',
    comments:
      'Rejected — government property is issued for official use on premises. Please file a replacement request if your current unit fails.',
  },
  {
    key: 'pens-rejected',
    type: RequisitionType.SUPPLY,
    justification: `${DEMO_TAG} Stock up pens for the whole division.`,
    requiredInDays: 9,
    items: [
      {
        ...SUPPLY,
        itemDescription: 'Ballpoint Pen, Black (box of 50)',
        quantity: 40,
      },
    ],
    outcome: 'rejected',
    comments:
      'Rejected — the quantity exceeds the monthly allotment. Please resubmit for 2 boxes or fewer.',
  },
  {
    key: 'gpu-on-hold',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} Graphics card to speed up password-recovery workloads on the forensic workstation.`,
    requiredInDays: 20,
    items: [
      {
        ...ICT_SEP,
        itemDescription: 'NVIDIA RTX 4070 Graphics Card',
        quantity: 1,
      },
    ],
    outcome: 'on_hold',
    comments: 'Approved, subject to availability.',
    holdReason:
      'Not in inventory — awaiting delivery. IT will fulfil it once stock arrives.',
  },
];

// ── Holder requests: returns, repairs, incidents ────────────────────────────

export type AssetRequestOutcome =
  | 'submitted' // waiting on the custodian to approve
  | 'approved' //  approved, waiting for the hand-over
  | 'completed' // received / processed
  | 'rejected';

export interface DemoAssetRequest {
  key: string;
  asset: string;
  type: AssetRequestType;
  details: string;
  preferredInDays: number;
  outcome: AssetRequestOutcome;
  /** Approved and completed requests: when the hand-over is scheduled. */
  handoverInDays?: number;
  /** Custodian's note on approval / completion. */
  notes?: string;
  /** Required when rejected. */
  reason?: string;
  /** Damage only, when completed: where the item goes. */
  damageOutcome?: 'repair' | 'disposal';
}

export const DEMO_ASSET_REQUESTS: DemoAssetRequest[] = [
  {
    key: 'return-printer',
    asset: 'printer-old',
    type: AssetRequestType.RETURN,
    details: `${DEMO_TAG} The section moved to the shared network printer, so this unit is no longer needed.`,
    preferredInDays: 3,
    outcome: 'submitted',
  },
  {
    key: 'repair-ups',
    asset: 'ups-repair',
    type: AssetRequestType.REPAIR,
    details: `${DEMO_TAG} The UPS beeps continuously and no longer holds a charge during brownouts.`,
    preferredInDays: 4,
    outcome: 'approved',
    handoverInDays: 3,
    notes: 'Bring it to the IT Storeroom with its power cable.',
  },
  {
    key: 'return-keyboard',
    asset: 'keyboard-set',
    type: AssetRequestType.RETURN,
    details: `${DEMO_TAG} Replaced with the keyboard that came with the new laptop, so returning this set.`,
    preferredInDays: 1,
    outcome: 'completed',
    handoverInDays: 1,
    notes: 'Received in good condition.',
  },
  {
    key: 'loss-laptop',
    asset: 'laptop-lost',
    type: AssetRequestType.LOSS,
    details: `${DEMO_TAG} The laptop bag was left in a taxi after an off-site coordination meeting; the driver could not be traced.`,
    preferredInDays: 2,
    outcome: 'completed',
    handoverInDays: 2,
    notes:
      'Affidavit of loss received. RLSDDP prepared for the Property Officer.',
  },
  {
    key: 'damage-desk',
    asset: 'desk-damaged',
    type: AssetRequestType.DAMAGE,
    details: `${DEMO_TAG} The desk top cracked after the ceiling leak during last week's storm and cannot be used.`,
    preferredInDays: 2,
    outcome: 'completed',
    handoverInDays: 2,
    damageOutcome: 'disposal',
    notes: 'Inspected: warped and cracked beyond economical repair.',
  },
  {
    key: 'theft-tv',
    asset: 'tv-stolen',
    type: AssetRequestType.THEFT,
    details: `${DEMO_TAG} The wall-mounted TV was taken from the conference room over the weekend; a police blotter was filed.`,
    preferredInDays: 2,
    outcome: 'completed',
    handoverInDays: 2,
    notes: 'Police blotter received. RLSDDP prepared for the Property Officer.',
  },
  {
    key: 'return-fan',
    asset: 'fan-return',
    type: AssetRequestType.RETURN,
    details: `${DEMO_TAG} Air conditioning was installed in the room, so the stand fan is no longer needed.`,
    preferredInDays: 3,
    outcome: 'approved',
    handoverInDays: 2,
    notes: 'Please bring it to the Supply Room.',
  },
  {
    key: 'repair-projector-rejected',
    asset: 'projector-loan',
    type: AssetRequestType.REPAIR,
    details: `${DEMO_TAG} The projector image looks slightly dim in the training room.`,
    preferredInDays: 5,
    outcome: 'rejected',
    reason:
      'The projector is on loan and overdue for return. Please return it first; IT will inspect the lamp on receipt.',
  },
];

// ── Validation ───────────────────────────────────────────────────────────────

const PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000000';

function dtoProblems(label: string, instance: object): string[] {
  return validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) =>
    Object.values(e.constraints ?? { invalid: 'invalid' }).map(
      (message) => `${label}: ${message}`,
    ),
  );
}

function duplicates(label: string, keys: string[]): string[] {
  return keys
    .filter((k, i) => keys.indexOf(k) !== i)
    .map((k) => `${label}: duplicate key "${k}"`);
}

const OPEN_REQUEST: AssetRequestOutcome[] = ['submitted', 'approved'];

/**
 * Everything that could make the scenario fail partway through a live run:
 * payloads that the real DTOs would reject, dangling references, and workflow
 * rules the API enforces (one open request per asset, replacement needs a held
 * asset, a fulfilled requisition needs the units to hand out, …). Empty = valid.
 */
export function validateScenario(): string[] {
  const problems: string[] = [];
  const byKey = new Map(DEMO_ASSETS.map((a) => [a.key, a]));
  const issued = new Set(DEMO_ISSUANCES.map((i) => i.asset));

  problems.push(
    ...duplicates(
      'asset',
      DEMO_ASSETS.map((a) => a.key),
    ),
    ...duplicates(
      'requisition',
      DEMO_REQUISITIONS.map((r) => r.key),
    ),
    ...duplicates(
      'asset request',
      DEMO_ASSET_REQUESTS.map((r) => r.key),
    ),
  );

  // The marker is what keeps demo rows identifiable (and removable) later, and
  // what stops them being mistaken for CICC records — so the runner refuses a
  // scenario that has lost it, not just the unit test.
  for (const a of DEMO_ASSETS) {
    problems.push(
      ...dtoProblems(`asset ${a.key}`, plainToInstance(CreateAssetDto, a.dto)),
    );
    for (const [field, value] of [
      ['propertyNumber', a.dto.propertyNumber],
      ['serialNumber', a.dto.serialNumber],
    ] as const) {
      if (!value?.startsWith(DEMO_PROPERTY_PREFIX)) {
        problems.push(
          `asset ${a.key}: ${field} is missing the demo marker "${DEMO_PROPERTY_PREFIX}"`,
        );
      }
    }
  }

  // A fulfilled-and-issued requisition hands a unit over, so that unit must not
  // also be issued up front.
  const handedOver = DEMO_REQUISITIONS.flatMap((r) =>
    r.fulfil?.issue ? r.fulfil.assets : [],
  );
  for (const key of handedOver) {
    if (issued.has(key)) {
      problems.push(`asset ${key} is issued twice (issuance and requisition)`);
    }
  }

  for (const i of DEMO_ISSUANCES) {
    if (!byKey.has(i.asset)) {
      problems.push(`issuance: unknown asset "${i.asset}"`);
    } else if (byKey.get(i.asset)!.dto.assetClass === AssetClass.IES) {
      problems.push(`issuance: "${i.asset}" is a supply, not a unit asset`);
    }
  }

  for (const r of DEMO_REQUISITIONS) {
    const label = `requisition ${r.key}`;
    problems.push(
      ...dtoProblems(
        label,
        plainToInstance(CreateRequisitionDto, {
          requisitionType: r.type,
          justification: r.justification,
          requiredDate: '2026-12-31',
          items: r.items,
          ...(r.replaces ? { replacedAssetId: PLACEHOLDER_UUID } : {}),
        }),
      ),
    );
    if (!r.justification.startsWith(DEMO_TAG)) {
      problems.push(
        `${label}: justification is missing the "${DEMO_TAG}" marker`,
      );
    }
    if (r.outcome === 'rejected' && !r.comments) {
      problems.push(`${label}: a rejection needs comments`);
    }
    if (r.outcome === 'on_hold' && !r.holdReason) {
      problems.push(`${label}: on hold needs a holdReason`);
    }
    if (r.outcome === 'fulfilled') {
      if (!r.fulfil) {
        problems.push(`${label}: fulfilled needs fulfil details`);
      } else if (r.fulfil.assets.length !== r.items.length) {
        problems.push(`${label}: fulfil needs one asset per item line`);
      } else {
        r.fulfil.assets.forEach((key, idx) => {
          const stock = byKey.get(key);
          const line = r.items[idx];
          if (!stock) {
            problems.push(`${label}: fulfil references unknown asset "${key}"`);
          } else if (stock.dto.itemDescription !== line.itemDescription) {
            problems.push(
              `${label}: fulfil asset "${key}" is not "${line.itemDescription}"`,
            );
          } else if (
            stock.dto.assetClass === AssetClass.IES &&
            (stock.dto.quantity ?? 0) < line.quantity
          ) {
            problems.push(`${label}: not enough "${key}" stock to fulfil`);
          }
        });
      }
    }
    if (r.type === RequisitionType.REPLACEMENT) {
      if (!r.replaces || !issued.has(r.replaces)) {
        problems.push(`${label}: replacement must name an issued asset`);
      } else if (r.items.length !== 1 || r.items[0].quantity !== 1) {
        problems.push(`${label}: replacement is exactly one unit`);
      } else if (
        r.items[0].assetType !== byKey.get(r.replaces)!.dto.assetType
      ) {
        problems.push(`${label}: replacement must be the same asset type`);
      }
    } else if (r.replaces) {
      problems.push(`${label}: only a replacement names a replaced asset`);
    }
    // The requester's custodian can only act on items in their own scope, and a
    // requisition is fulfilled as a whole (see assertItemsInScope).
    if (new Set(r.items.map((i) => custodianFor(i.assetType))).size > 1) {
      problems.push(`${label}: items span two custodians`);
    }
  }

  const openByAsset = new Map<string, number>();
  for (const r of DEMO_ASSET_REQUESTS) {
    const label = `asset request ${r.key}`;
    if (!issued.has(r.asset)) {
      problems.push(`${label}: "${r.asset}" is not issued to the employee`);
    }
    problems.push(
      ...dtoProblems(
        label,
        plainToInstance(CreateAssetRequestDto, {
          assetId: PLACEHOLDER_UUID,
          type: r.type,
          preferredDate: '2026-12-31',
          details: r.details,
        }),
      ),
    );
    if (!r.details.startsWith(DEMO_TAG)) {
      problems.push(`${label}: details are missing the "${DEMO_TAG}" marker`);
    }
    if (r.outcome === 'rejected' && !r.reason) {
      problems.push(`${label}: a rejection needs a reason`);
    }
    if (
      r.type === AssetRequestType.DAMAGE &&
      r.outcome === 'completed' &&
      !r.damageOutcome
    ) {
      problems.push(
        `${label}: a completed damage report needs a damageOutcome`,
      );
    }
    if (OPEN_REQUEST.includes(r.outcome)) {
      openByAsset.set(r.asset, (openByAsset.get(r.asset) ?? 0) + 1);
    }
  }
  for (const [asset, count] of openByAsset) {
    if (count > 1) {
      problems.push(`asset "${asset}" has ${count} open requests (limit 1)`);
    }
  }

  return problems;
}

// ── Coverage ─────────────────────────────────────────────────────────────────

/** Replacement validation and disposal review are scoped by asset type. */
export interface ScopeCoverage {
  replacementRequests: number;
  replacementCandidates: number;
  disposalCandidates: number;
}

export interface Coverage {
  supervisorPending: number;
  supervisorDecided: number;
  /** Approved requisitions waiting for the custodian to fulfil. */
  itFulfilment: number;
  pcFulfilment: number;
  /** Approved but put on hold by the custodian (item not in stock). */
  onHold: number;
  itAssetRequests: number;
  pcAssetRequests: number;
  /** IT Personnel's domain: ICT assets. */
  it: ScopeCoverage;
  /** Property Custodian / Property Officer's domain: Fixed assets and Supplies. */
  po: ScopeCoverage;
  lowStockSupplies: number;
  overdueLoans: number;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Assets the replacement screen will list as candidates: still on the demo
 * employee's record, with no replacement request open, and either lost/stolen
 * (the item stays on the holder's record until COA grants relief) or
 * serviceable but past its class's useful life. A return or a damage write-off
 * ends the holder's accountability, so those never qualify.
 */
export function replacementCandidateKeys(now = Date.now()): string[] {
  const byKey = new Map(DEMO_ASSETS.map((a) => [a.key, a.dto]));
  const replaced = new Set(
    DEMO_REQUISITIONS.flatMap((r) => (r.replaces ? [r.replaces] : [])),
  );
  return DEMO_ISSUANCES.map((i) => i.asset).filter((key) => {
    if (replaced.has(key)) return false;
    const completed = DEMO_ASSET_REQUESTS.find(
      (r) => r.asset === key && r.outcome === 'completed',
    );
    if (completed) {
      return (
        completed.type === AssetRequestType.LOSS ||
        completed.type === AssetRequestType.THEFT
      );
    }
    const dto = byKey.get(key)!;
    const years =
      (now - new Date(dto.acquisitionDate ?? now).getTime()) / MS_PER_YEAR;
    return years >= USEFUL_LIFE_YEARS[dto.assetClass];
  });
}

/** What each role will find waiting for them once the scenario has run. */
export function coverage(now = Date.now()): Coverage {
  const byKey = new Map(DEMO_ASSETS.map((a) => [a.key, a.dto]));
  const ownerOfAsset = (key: string) => custodianFor(byKey.get(key)!.assetType);
  const ownerOfItems = (r: DemoRequisition) =>
    custodianFor(r.items[0].assetType);
  const approved = DEMO_REQUISITIONS.filter((r) => r.outcome === 'approved');
  const openRequests = DEMO_ASSET_REQUESTS.filter((r) =>
    OPEN_REQUEST.includes(r.outcome),
  );
  const candidateKeys = replacementCandidateKeys(now);
  const disposalRequests = DEMO_ASSET_REQUESTS.filter(
    (r) =>
      r.outcome === 'completed' &&
      (r.type === AssetRequestType.LOSS ||
        r.type === AssetRequestType.THEFT ||
        (r.type === AssetRequestType.DAMAGE && r.damageOutcome === 'disposal')),
  );
  const inScope = (owner: CustodianRole): ScopeCoverage => ({
    replacementRequests: DEMO_REQUISITIONS.filter(
      (r) =>
        r.type === RequisitionType.REPLACEMENT &&
        ownerOfAsset(r.replaces!) === owner,
    ).length,
    replacementCandidates: candidateKeys.filter(
      (key) => ownerOfAsset(key) === owner,
    ).length,
    disposalCandidates: disposalRequests.filter(
      (r) => ownerOfAsset(r.asset) === owner,
    ).length,
  });

  return {
    supervisorPending: DEMO_REQUISITIONS.filter((r) => r.outcome === 'pending')
      .length,
    supervisorDecided: DEMO_REQUISITIONS.filter((r) => r.outcome !== 'pending')
      .length,
    itFulfilment: approved.filter(
      (r) => ownerOfItems(r) === UserRole.IT_PERSONNEL,
    ).length,
    pcFulfilment: approved.filter(
      (r) => ownerOfItems(r) === UserRole.PROPERTY_CUSTODIAN,
    ).length,
    onHold: DEMO_REQUISITIONS.filter((r) => r.outcome === 'on_hold').length,
    itAssetRequests: openRequests.filter(
      (r) => ownerOfAsset(r.asset) === UserRole.IT_PERSONNEL,
    ).length,
    pcAssetRequests: openRequests.filter(
      (r) => ownerOfAsset(r.asset) === UserRole.PROPERTY_CUSTODIAN,
    ).length,
    it: inScope(UserRole.IT_PERSONNEL),
    po: inScope(UserRole.PROPERTY_CUSTODIAN),
    lowStockSupplies: DEMO_ASSETS.filter(
      (a) =>
        a.dto.assetClass === AssetClass.IES &&
        (a.dto.quantity ?? 0) <= (a.dto.reorderLevel ?? 0),
    ).length,
    overdueLoans: DEMO_ISSUANCES.filter(
      (i) => (i.expectedReturnInDays ?? 0) < 0,
    ).length,
  };
}
