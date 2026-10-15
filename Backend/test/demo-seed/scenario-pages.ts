import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAssetDto } from '../../src/assets/dto/create-asset.dto';
import {
  CompleteRepairDto,
  IssueLoanerDto,
  UpdateRepairDto,
} from '../../src/assets/dto/repair.dto';
import { CreateRequisitionDto } from '../../src/requisitions/dto/create-requisition.dto';
import { CreateAssetRequestDto } from '../../src/asset-requests/dto/asset-request.dto';
import {
  AssetClass,
  AssetCondition,
  AssetRequestType,
  AssetType,
  RepairOutcome,
  RepairServiceType,
  RequisitionType,
} from '../../../packages/shared/src/enums';
import { USEFUL_LIFE_YEARS } from '../../../packages/shared/src/constants';
import { DEMO_TAG, custodianFor } from './scenario';

// "No page should look empty." The base scenario (scenario.ts) fills the requisition and
// incident queues. This one fills the pages it leaves bare: Maintenance & Repair, My
// Assigned Assets and My Requisitions for every role, the Admin's escalation queues,
// transferred and disposed assets, and a completed replacement in each custodian domain.
//
// Like the base scenario it is replayed through the real API as the real roles, and every
// payload is checked against the real DTOs. Because these flows depend on each other
// (you cannot repair what is already disposed), validatePages() also runs the steps
// against a small model of each asset's lifecycle, so a step the API would refuse fails
// in the tests and not halfway through a run against a shared database.

/** Every demo asset in this scenario has this property-number prefix ("DEMO-P-ICT-0001"). */
export const PAGES_PROPERTY_PREFIX = 'DEMO-P-';

export type Holder =
  | 'employee'
  | 'supervisor'
  | 'it_personnel'
  | 'property_custodian'
  | 'property_officer'
  | 'management'
  | 'system_admin';

/** The roles the seeder can log in as, hence the only ones that can file or decide. */
const FILERS: Holder[] = [
  'employee',
  'supervisor',
  'it_personnel',
  'property_custodian',
];
const CUSTODIANS: Holder[] = ['it_personnel', 'property_custodian'];

// ── Assets ───────────────────────────────────────────────────────────────────

export interface PageAsset {
  key: string;
  dto: CreateAssetDto;
}

const OFFICES = {
  field: {
    division: 'Operations',
    officeOrSection: 'Field Operations',
    officeLocation: 'Field Operations Room, 4th Floor',
  },
  lab: {
    division: 'Operations',
    officeOrSection: 'Digital Forensics Lab',
    officeLocation: 'Forensics Lab, 5th Floor',
  },
  intel: {
    division: 'Operations',
    officeOrSection: 'Cyber Intelligence Unit',
    officeLocation: 'Intelligence Room, 4th Floor',
  },
  records: {
    division: 'Administration',
    officeOrSection: 'Records Section',
    officeLocation: 'Records Room, 2nd Floor',
  },
  it: {
    division: 'Information Technology',
    officeOrSection: 'Systems Administration',
    officeLocation: 'IT Storeroom, 3rd Floor',
  },
  property: {
    division: 'Property and Supply Management',
    officeOrSection: 'Property Custody Unit',
    officeLocation: 'Supply Room, 2nd Floor',
  },
  governance: {
    division: 'Property and Supply Management',
    officeOrSection: 'Property Governance',
    officeLocation: 'Property Office, 2nd Floor',
  },
  director: {
    division: 'Executive',
    officeOrSection: 'Office of the Director',
    officeLocation: "Director's Office, 6th Floor",
  },
};
type Office = keyof typeof OFFICES;

let serial = 1_000;
function asset(
  key: string,
  prefix: 'ICT' | 'FIX',
  n: number,
  office: Office,
  dto: {
    itemDescription: string;
    brand: string;
    acquisitionCost: number;
    acquisitionDate: string;
    assetClass: AssetClass;
    assetType: AssetType;
  },
): PageAsset {
  serial += 1;
  return {
    key,
    dto: {
      ...dto,
      ...OFFICES[office],
      dateOfDelivery: dto.acquisitionDate,
      condition: AssetCondition.SERVICEABLE,
      supplier: 'DEMO Supplier Inc.',
      propertyNumber: `${PAGES_PROPERTY_PREFIX}${prefix}-${String(n).padStart(4, '0')}`,
      serialNumber: `DEMO-SN-${serial}`,
    },
  };
}

const ict = (
  key: string,
  n: number,
  office: Office,
  description: string,
  brand: string,
  cost: number,
  acquired: string,
) =>
  asset(key, 'ICT', n, office, {
    itemDescription: description,
    brand,
    acquisitionCost: cost,
    acquisitionDate: acquired,
    assetClass: AssetClass.SEP,
    assetType: AssetType.ICT,
  });
const fixed = (
  key: string,
  n: number,
  office: Office,
  description: string,
  brand: string,
  cost: number,
  acquired: string,
) =>
  asset(key, 'FIX', n, office, {
    itemDescription: description,
    brand,
    acquisitionCost: cost,
    acquisitionDate: acquired,
    assetClass: AssetClass.SEP,
    assetType: AssetType.FIXED,
  });

const LAPTOP = 'Dell Latitude 5440 Laptop';
const CHAIR = 'Ergonomic Office Chair';

export const PAGES_ASSETS: PageAsset[] = [
  // ── ICT, registered by IT Personnel ─────────────────────────────────────
  ict('laptop-maria', 1, 'field', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict(
    'desktop-maria',
    2,
    'field',
    'Dell OptiPlex 7010 Desktop Computer',
    'Dell',
    41_200,
    '2019-05-14',
  ),
  ict('laptop-jose', 3, 'it', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict(
    'monitor-jose',
    4,
    'it',
    'Dell P2422H 24-inch Monitor',
    'Dell',
    9_800,
    '2025-09-02',
  ),
  ict('laptop-roberto', 5, 'property', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict('laptop-carmela', 6, 'governance', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict('laptop-ana', 7, 'director', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict('laptop-admin', 8, 'it', LAPTOP, 'Dell', 46_500, '2025-09-02'),
  ict(
    'printer-inhouse',
    9,
    'records',
    'Brother HL-L2370DW Printer',
    'Brother',
    12_500,
    '2024-03-18',
  ),
  ict(
    'scanner-external',
    10,
    'lab',
    'Fujitsu ScanSnap iX1600 Scanner',
    'Fujitsu',
    24_000,
    '2024-06-10',
  ),
  ict(
    'laptop-overdue',
    11,
    'intel',
    'Lenovo ThinkPad T14 Laptop',
    'Lenovo',
    44_000,
    '2024-04-09',
  ),
  ict(
    'laptop-spare',
    12,
    'it',
    'Lenovo ThinkPad T14 Laptop',
    'Lenovo',
    44_000,
    '2024-04-09',
  ),
  ict(
    'ups-external',
    13,
    'lab',
    'APC Smart-UPS 1500VA',
    'APC',
    28_000,
    '2025-01-22',
  ),
  ict(
    'projector-done',
    14,
    'field',
    'Epson EB-X49 Projector',
    'Epson',
    32_000,
    '2025-02-18',
  ),
  ict(
    'switch-dead',
    15,
    'lab',
    'TP-Link 8-port Gigabit Switch',
    'TP-Link',
    3_200,
    '2023-08-01',
  ),
  ict(
    'camera-repeat',
    16,
    'field',
    'Canon EOS 90D Evidence Camera',
    'Canon',
    48_000,
    '2024-02-12',
  ),
  ict(
    'desktop-old-repl',
    17,
    'intel',
    'Dell OptiPlex 3060 Desktop Computer',
    'Dell',
    38_500,
    '2018-04-10',
  ),
  ict('laptop-new-unit', 18, 'it', LAPTOP, 'Dell', 46_500, '2026-08-20'),
  ict(
    'laptop-jose-repair',
    19,
    'it',
    'HP EliteBook 840 Laptop',
    'HP',
    47_000,
    '2024-07-05',
  ),
  ict(
    'crt-old',
    20,
    'it',
    'Obsolete 17-inch CRT Monitor',
    'Samsung',
    4_500,
    '2008-03-11',
  ),
  // ── Fixed assets, registered by the Property Custodian ──────────────────
  fixed('chair-maria', 1, 'field', CHAIR, 'Uratex', 6_500, '2025-05-20'),
  fixed(
    'table-jose',
    2,
    'it',
    'Wooden Conference Table, 8-Seater',
    'Orocan',
    22_000,
    '2024-11-04',
  ),
  fixed('chair-roberto', 3, 'property', CHAIR, 'Uratex', 6_500, '2025-05-20'),
  fixed(
    'cabinet-roberto',
    4,
    'property',
    'Steel Filing Cabinet, 4-Drawer',
    'Orocan',
    8_900,
    '2025-05-20',
  ),
  fixed('chair-carmela', 5, 'governance', CHAIR, 'Uratex', 6_500, '2025-05-20'),
  fixed(
    'aircon-ana',
    6,
    'director',
    'Split-Type Air Conditioner, 1.5 HP',
    'Carrier',
    41_000,
    '2025-04-08',
  ),
  fixed(
    'fan-admin',
    7,
    'it',
    'Industrial Stand Fan, 20-inch',
    'Asahi',
    3_200,
    '2025-06-30',
  ),
  fixed(
    'aircon-repair',
    8,
    'lab',
    'Split-Type Air Conditioner, 2.0 HP',
    'Carrier',
    49_000,
    '2024-04-08',
  ),
  fixed(
    'dispenser-done',
    9,
    'records',
    'Hot and Cold Water Dispenser',
    'Concepcion',
    9_800,
    '2024-09-16',
  ),
  fixed(
    'desk-transfer',
    10,
    'property',
    'Executive Office Desk',
    'Uratex',
    14_500,
    '2025-03-03',
  ),
  fixed(
    'table-disposed',
    11,
    'property',
    'Wooden Office Table (cracked)',
    'Orocan',
    7_500,
    '2012-06-20',
  ),
  fixed('chair-old-repl', 12, 'intel', CHAIR, 'Uratex', 6_500, '2019-03-22'),
  fixed('chair-new-unit', 13, 'property', CHAIR, 'Uratex', 6_500, '2026-08-20'),
];

// ── Steps ────────────────────────────────────────────────────────────────────

export interface ServiceDetails {
  type: 'in_house' | 'external';
  provider?: string;
  /** Negative = already overdue, which raises the repair-overdue alert. */
  dueInDays?: number;
}

export type Step =
  /** The Master Admin sets the officer's backup approver, so their own requests can be routed. */
  | { do: 'backupApprover'; officer: Holder }
  | { do: 'issue'; asset: string; to: Holder; dueInDays?: number }
  | {
      do: 'repair';
      asset: string;
      problem: string;
      service?: ServiceDetails;
      /** An available unit lent to the holder meanwhile. */
      loaner?: string;
      /**
       * When the loaner is due back. The API defaults it to the repair's due date but refuses a
       * date in the past, so a loaner on an already-overdue repair must be given its own.
       */
      loanerReturnInDays?: number;
      finish?: {
        outcome: 'repaired' | 'unrepairable';
        findings?: string;
        action: string;
        returnToStock?: boolean;
      };
    }
  | {
      do: 'requisition';
      key: string;
      by: Holder;
      type: RequisitionType;
      justification: string;
      requiredInDays: number;
      items: Array<{
        assetType: AssetType;
        assetClass: AssetClass;
        itemDescription: string;
        quantity: number;
      }>;
      replaces?: string;
      /** 'fulfilled' approves it (employee requests only) and hands over `fulfilWith`. */
      outcome: 'pending' | 'fulfilled';
      fulfilWith?: string;
    }
  | {
      do: 'assetRequest';
      key: string;
      by: Holder;
      asset: string;
      type: AssetRequestType;
      details: string;
      preferredInDays: number;
      /** Whose request it is to decide: a custodian's own item falls to the System Administrator. */
      decider: 'custodian' | 'admin';
      outcome: 'submitted' | 'approved' | 'completed';
      handoverInDays?: number;
      notes?: string;
      /** Repair completed: the service details the decider records afterwards. */
      service?: ServiceDetails;
    }
  | { do: 'transfer'; asset: string; toLocation: string }
  | { do: 'dispose'; asset: string; notes: string };

const ICT_SEP = { assetType: AssetType.ICT, assetClass: AssetClass.SEP };
const FIXED_SEP = { assetType: AssetType.FIXED, assetClass: AssetClass.SEP };

const issue = (assetKey: string, to: Holder, dueInDays?: number): Step => ({
  do: 'issue',
  asset: assetKey,
  to,
  ...(dueInDays === undefined ? {} : { dueInDays }),
});

export const PAGES_STEPS: Step[] = [
  { do: 'backupApprover', officer: 'supervisor' },

  // ── My Assigned Assets: every role holds something ───────────────────────
  issue('laptop-maria', 'supervisor'),
  issue('desktop-maria', 'supervisor'),
  issue('chair-maria', 'supervisor'),
  issue('laptop-jose', 'it_personnel'),
  issue('monitor-jose', 'it_personnel'),
  issue('table-jose', 'it_personnel'),
  issue('laptop-jose-repair', 'it_personnel'),
  issue('laptop-roberto', 'property_custodian'),
  issue('chair-roberto', 'property_custodian'),
  issue('cabinet-roberto', 'property_custodian'),
  issue('laptop-carmela', 'property_officer'),
  issue('chair-carmela', 'property_officer'),
  issue('laptop-ana', 'management'),
  issue('aircon-ana', 'management'),
  issue('laptop-admin', 'system_admin'),
  issue('fan-admin', 'system_admin'),
  // The demo employee's things, about to go to repair or be replaced
  issue('printer-inhouse', 'employee'),
  issue('scanner-external', 'employee'),
  issue('laptop-overdue', 'employee'),
  issue('ups-external', 'employee'),
  issue('projector-done', 'employee'),
  issue('switch-dead', 'employee'),
  issue('camera-repeat', 'employee'),
  issue('desktop-old-repl', 'employee'),
  issue('aircon-repair', 'employee'),
  issue('dispenser-done', 'employee'),
  issue('chair-old-repl', 'employee'),

  // ── Maintenance & Repair: every state a custodian meets ──────────────────
  {
    do: 'repair',
    asset: 'printer-inhouse',
    problem: `${DEMO_TAG} Paper jams on every second page and the tray sensor is faulty.`,
    service: { type: 'in_house', dueInDays: 5 },
  },
  {
    do: 'repair',
    asset: 'scanner-external',
    problem: `${DEMO_TAG} The scanner head is misaligned and leaves streaks on every scan.`,
    service: {
      type: 'external',
      provider: 'DEMO Imaging Service Center',
      dueInDays: 10,
    },
  },
  {
    do: 'repair',
    asset: 'laptop-overdue',
    problem: `${DEMO_TAG} The laptop will not hold a charge and shuts down within minutes.`,
    service: {
      type: 'external',
      provider: 'DEMO Laptop Repair Hub',
      dueInDays: -4,
    },
    loaner: 'laptop-spare',
    // The repair is already overdue; the loaner still has to be due back in the future.
    loanerReturnInDays: 3,
  },
  {
    do: 'repair',
    asset: 'ups-external',
    problem: `${DEMO_TAG} The UPS beeps continuously and no longer carries a load.`,
    service: {
      type: 'external',
      provider: 'DEMO Power Systems Repair',
      dueInDays: 7,
    },
  },
  {
    do: 'repair',
    asset: 'aircon-repair',
    problem: `${DEMO_TAG} The air conditioner runs but no longer cools the forensics lab.`,
    service: {
      type: 'external',
      provider: 'DEMO Cooling Services',
      dueInDays: 8,
    },
  },
  // Finished repairs, the history behind the queue
  {
    do: 'repair',
    asset: 'projector-done',
    problem: `${DEMO_TAG} The projector image is dim and flickers.`,
    finish: {
      outcome: 'repaired',
      action: 'Replaced the lamp and cleaned the filter; tested for two hours.',
    },
  },
  {
    do: 'repair',
    asset: 'dispenser-done',
    problem: `${DEMO_TAG} The dispenser leaks from the cold tap.`,
    finish: {
      outcome: 'repaired',
      action: 'Replaced the cold-water valve and tested for leaks.',
    },
  },
  {
    do: 'repair',
    asset: 'switch-dead',
    problem: `${DEMO_TAG} The switch no longer powers on after a power surge.`,
    finish: {
      outcome: 'unrepairable',
      findings:
        'Power supply and mainboard burnt out; the cost of repair exceeds the replacement cost.',
      action: 'Opened and tested the unit; no repair possible.',
    },
  },
  // One camera repaired three times in a year: the "repeated repairs" replacement reason
  ...[1, 2, 3].map(
    (round): Step => ({
      do: 'repair',
      asset: 'camera-repeat',
      problem: `${DEMO_TAG} The camera shutter jams during field use (breakdown ${round} of 3).`,
      finish: {
        outcome: 'repaired',
        action: `Cleaned and recalibrated the shutter mechanism (visit ${round}).`,
      },
    }),
  ),

  // ── My Requisitions: the Approving Officer and IT file their own ─────────
  {
    do: 'requisition',
    key: 'maria-monitor',
    by: 'supervisor',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} A second monitor for reviewing the section's weekly case reports.`,
    requiredInDays: 14,
    items: [
      {
        ...ICT_SEP,
        itemDescription: 'Dell P2422H 24-inch Monitor',
        quantity: 1,
      },
    ],
    outcome: 'pending',
  },
  {
    do: 'requisition',
    key: 'maria-replacement',
    by: 'supervisor',
    type: RequisitionType.REPLACEMENT,
    justification: `${DEMO_TAG} My assigned desktop is past its useful life and is too slow for the case-tracking tools.`,
    requiredInDays: 21,
    items: [{ ...ICT_SEP, itemDescription: LAPTOP, quantity: 1 }],
    replaces: 'desktop-maria',
    outcome: 'pending',
  },
  {
    do: 'requisition',
    key: 'jose-laptop',
    by: 'it_personnel',
    type: RequisitionType.NEW,
    justification: `${DEMO_TAG} A spare laptop to keep configured and ready as a loaner during repairs.`,
    requiredInDays: 10,
    items: [{ ...ICT_SEP, itemDescription: LAPTOP, quantity: 1 }],
    outcome: 'pending',
  },

  // ── Replacement Validation: a completed replacement in each domain ───────
  {
    do: 'requisition',
    key: 'juan-desktop-replacement',
    by: 'employee',
    type: RequisitionType.REPLACEMENT,
    justification: `${DEMO_TAG} The desktop dates from 2018 and cannot run the current forensic tools.`,
    requiredInDays: 7,
    items: [{ ...ICT_SEP, itemDescription: LAPTOP, quantity: 1 }],
    replaces: 'desktop-old-repl',
    outcome: 'fulfilled',
    fulfilWith: 'laptop-new-unit',
  },
  {
    do: 'requisition',
    key: 'juan-chair-replacement',
    by: 'employee',
    type: RequisitionType.REPLACEMENT,
    justification: `${DEMO_TAG} The chair's seat has collapsed and cannot be adjusted any more.`,
    requiredInDays: 7,
    items: [{ ...FIXED_SEP, itemDescription: CHAIR, quantity: 1 }],
    replaces: 'chair-old-repl',
    outcome: 'fulfilled',
    fulfilWith: 'chair-new-unit',
  },

  // ── Admin escalation queues: a custodian's own items ─────────────────────
  {
    do: 'assetRequest',
    key: 'jose-laptop-repair',
    by: 'it_personnel',
    asset: 'laptop-jose-repair',
    type: AssetRequestType.REPAIR,
    preferredInDays: 3,
    decider: 'admin',
    outcome: 'completed',
    handoverInDays: 2,
    details: `${DEMO_TAG} The keyboard has failed and several keys no longer register.`,
    notes: 'Received for repair; sent to the authorized service center.',
    service: {
      type: 'external',
      provider: 'DEMO Authorized HP Service',
      dueInDays: 6,
    },
  },
  {
    do: 'assetRequest',
    key: 'jose-monitor-return',
    by: 'it_personnel',
    asset: 'monitor-jose',
    type: AssetRequestType.RETURN,
    preferredInDays: 4,
    decider: 'admin',
    outcome: 'submitted',
    details: `${DEMO_TAG} The monitor is no longer needed since the workstation was upgraded.`,
  },
  {
    do: 'assetRequest',
    key: 'roberto-chair-repair',
    by: 'property_custodian',
    asset: 'chair-roberto',
    type: AssetRequestType.REPAIR,
    preferredInDays: 3,
    decider: 'admin',
    outcome: 'approved',
    handoverInDays: 2,
    details: `${DEMO_TAG} The chair's gas lift has failed and it will not stay at a working height.`,
    notes: 'Bring it to the supply room.',
  },
  {
    do: 'assetRequest',
    key: 'roberto-cabinet-return',
    by: 'property_custodian',
    asset: 'cabinet-roberto',
    type: AssetRequestType.RETURN,
    preferredInDays: 2,
    decider: 'admin',
    outcome: 'completed',
    handoverInDays: 1,
    details: `${DEMO_TAG} The cabinet was moved out of the unit's office during the renovation.`,
    notes: 'Received in good condition.',
  },

  // ── Custody and the dashboards: a transferred and two disposed assets ────
  {
    do: 'transfer',
    asset: 'desk-transfer',
    toLocation: 'Cybercrime Operations Division, 5th Floor',
  },
  {
    do: 'dispose',
    asset: 'crt-old',
    notes: `${DEMO_TAG} Obsolete CRT monitor, beyond economical repair and no longer supported by any workstation.`,
  },
  {
    do: 'dispose',
    asset: 'table-disposed',
    notes: `${DEMO_TAG} The tabletop is cracked through and the frame is rotted; condemned by inspection.`,
  },
];

// ── Lifecycle simulation ─────────────────────────────────────────────────────

type SimStatus =
  | 'available'
  | 'issued'
  | 'under_repair'
  | 'flagged'
  | 'returned'
  | 'transferred'
  | 'disposed';
interface Sim {
  status: SimStatus;
  holder: Holder | null;
  repairsDone: number;
  openRequest: boolean;
}
interface OpenRepair {
  asset: string;
  inHouse: boolean;
  overdue: boolean;
  withLoaner: boolean;
  ict: boolean;
  heldByCustodian: boolean;
}

interface Run {
  problems: string[];
  sim: Map<string, Sim>;
  openRepairs: OpenRepair[];
  finishedRepairs: Array<'repaired' | 'unrepairable'>;
  completedReplacements: Array<'ict' | 'fixed'>;
  ownRequisitions: Record<string, number>;
  custodianRequests: Array<'waiting' | 'decided'>;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function simulate(steps: Step[], assets: PageAsset[], now = Date.now()): Run {
  const run: Run = {
    problems: [],
    sim: new Map(),
    openRepairs: [],
    finishedRepairs: [],
    completedReplacements: [],
    ownRequisitions: {},
    custodianRequests: [],
  };
  const byKey = new Map(assets.map((a) => [a.key, a.dto]));
  for (const a of assets)
    run.sim.set(a.key, {
      status: 'available',
      holder: null,
      repairsDone: 0,
      openRequest: false,
    });
  const backups = new Set<Holder>();

  const known = (label: string, key: string) => {
    if (!byKey.has(key)) {
      run.problems.push(`${label}: unknown asset "${key}"`);
      return null;
    }
    return { dto: byKey.get(key)!, sim: run.sim.get(key)! };
  };
  const custodianOf = (assetType: AssetType) => String(custodianFor(assetType));

  steps.forEach((step, i) => {
    const at = `step ${i + 1} (${step.do})`;
    switch (step.do) {
      case 'backupApprover':
        backups.add(step.officer);
        break;

      case 'issue': {
        const a = known(at, step.asset);
        if (!a) break;
        if (a.sim.status !== 'available')
          run.problems.push(
            `${at}: "${step.asset}" is not available (it is ${a.sim.status})`,
          );
        if (a.dto.assetClass === AssetClass.IES)
          run.problems.push(`${at}: "${step.asset}" is a supply, not a unit`);
        a.sim.status = 'issued';
        a.sim.holder = step.to;
        break;
      }

      case 'repair': {
        const a = known(at, step.asset);
        if (!a) break;
        if (!step.problem.startsWith(DEMO_TAG))
          run.problems.push(
            `${at}: the problem is missing the "${DEMO_TAG}" marker`,
          );
        if (a.sim.status !== 'available' && a.sim.status !== 'issued') {
          run.problems.push(
            `${at}: "${step.asset}" cannot go to repair from ${a.sim.status}`,
          );
        }
        const holder = a.sim.holder;
        a.sim.status = 'under_repair';
        if (step.service?.type === 'external' && !step.service.provider)
          run.problems.push(`${at}: an external repair needs a provider`);
        if (step.service) {
          run.problems.push(
            ...dtoProblems(
              `${at} progress`,
              plainToInstance(UpdateRepairDto, {
                serviceType: step.service.type as RepairServiceType,
                ...(step.service.provider
                  ? { serviceProvider: step.service.provider }
                  : {}),
                ...(step.service.dueInDays === undefined
                  ? {}
                  : { expectedCompletionDate: '2026-12-31' }),
              }),
            ),
          );
        }
        if (step.loaner) {
          const loaner = known(`${at} loaner`, step.loaner);
          if (loaner) {
            if (!holder)
              run.problems.push(`${at}: a loaner needs a holder to lend to`);
            if (loaner.sim.status !== 'available')
              run.problems.push(
                `${at}: the loaner "${step.loaner}" is not available`,
              );
            if (loaner.dto.assetType !== a.dto.assetType)
              run.problems.push(
                `${at}: the loaner must be the same asset type`,
              );
            if (loaner.dto.assetClass === AssetClass.IES)
              run.problems.push(`${at}: the loaner must not be a supply`);
            loaner.sim.status = 'issued';
            loaner.sim.holder = holder;
          }
          // The API defaults the return date to the repair's due date and refuses a past one.
          const returnInDays =
            step.loanerReturnInDays ?? step.service?.dueInDays;
          if (returnInDays !== undefined && returnInDays < 0) {
            run.problems.push(
              `${at}: the loaner return date would be in the past; give the loaner its own loanerReturnInDays`,
            );
          }
          run.problems.push(
            ...dtoProblems(
              `${at} loaner`,
              plainToInstance(IssueLoanerDto, {
                assetId: PLACEHOLDER_UUID,
                ...(step.loanerReturnInDays === undefined
                  ? {}
                  : { expectedReturnDate: '2026-12-31' }),
              }),
            ),
          );
        }
        if (step.finish) {
          const f = step.finish;
          run.problems.push(
            ...dtoProblems(
              `${at} completion`,
              plainToInstance(CompleteRepairDto, {
                outcome: f.outcome as RepairOutcome,
                actionTaken: f.action,
                ...(f.findings ? { findings: f.findings } : {}),
                ...(f.returnToStock === undefined
                  ? {}
                  : { returnToStock: f.returnToStock }),
              }),
            ),
          );
          if (f.outcome === 'unrepairable' && !f.findings?.trim())
            run.problems.push(`${at}: an unrepairable item needs findings`);
          a.sim.status =
            f.outcome === 'unrepairable'
              ? 'flagged'
              : holder && !f.returnToStock
                ? 'issued'
                : 'available';
          if (f.outcome === 'repaired' && (!holder || f.returnToStock))
            a.sim.holder = null;
          a.sim.repairsDone += 1;
          run.finishedRepairs.push(f.outcome);
        } else {
          run.openRepairs.push({
            asset: step.asset,
            inHouse: (step.service?.type ?? 'in_house') === 'in_house',
            overdue: (step.service?.dueInDays ?? 1) < 0,
            withLoaner: Boolean(step.loaner),
            ict: a.dto.assetType === AssetType.ICT,
            heldByCustodian:
              holder !== null &&
              String(holder) === custodianOf(a.dto.assetType),
          });
        }
        break;
      }

      case 'requisition': {
        const label = `${at} "${step.key}"`;
        run.problems.push(
          ...dtoProblems(
            label,
            plainToInstance(CreateRequisitionDto, {
              requisitionType: step.type,
              justification: step.justification,
              requiredDate: '2026-12-31',
              items: step.items,
              ...(step.replaces ? { replacedAssetId: PLACEHOLDER_UUID } : {}),
            }),
          ),
        );
        if (!step.justification.startsWith(DEMO_TAG))
          run.problems.push(
            `${label}: justification is missing the "${DEMO_TAG}" marker`,
          );
        if (step.by === 'supervisor' && !backups.has('supervisor')) {
          run.problems.push(
            `${label}: a supervisor's own requisition needs a backup approver set first`,
          );
        }
        if (step.by !== 'employee' && step.outcome !== 'pending') {
          run.problems.push(
            `${label}: only the demo employee's requests can be taken through approval (the approver for anyone else has no seeded login)`,
          );
        }
        if (!['employee', 'supervisor', 'it_personnel'].includes(step.by)) {
          run.problems.push(`${label}: ${step.by} may not file a requisition`);
        }
        run.ownRequisitions[step.by] = (run.ownRequisitions[step.by] ?? 0) + 1;
        if (step.type === RequisitionType.REPLACEMENT) {
          const old = step.replaces ? known(label, step.replaces) : null;
          if (!old) {
            run.problems.push(
              `${label}: a replacement must name the asset it replaces`,
            );
            break;
          }
          if (old.sim.holder !== step.by || old.sim.status !== 'issued')
            run.problems.push(
              `${label}: the requester must hold "${step.replaces}"`,
            );
          const years =
            (now - new Date(old.dto.acquisitionDate ?? now).getTime()) /
            MS_PER_YEAR;
          if (
            !(
              years >= USEFUL_LIFE_YEARS[old.dto.assetClass] ||
              old.sim.repairsDone >= 3
            )
          ) {
            run.problems.push(
              `${label}: "${step.replaces}" does not qualify for replacement yet`,
            );
          }
          if (step.items.length !== 1 || step.items[0].quantity !== 1)
            run.problems.push(`${label}: a replacement is exactly one unit`);
          if (step.items[0].assetType !== old.dto.assetType)
            run.problems.push(
              `${label}: a replacement must be the same asset type`,
            );
          if (step.outcome === 'fulfilled') {
            const unit = step.fulfilWith ? known(label, step.fulfilWith) : null;
            if (!unit) {
              run.problems.push(
                `${label}: a fulfilled replacement needs the unit to hand over`,
              );
            } else {
              if (unit.sim.status !== 'available')
                run.problems.push(
                  `${label}: the replacement unit "${step.fulfilWith}" is not available`,
                );
              if (unit.dto.assetType !== old.dto.assetType)
                run.problems.push(
                  `${label}: the replacement unit is the wrong asset type`,
                );
              unit.sim.status = 'issued';
              unit.sim.holder = step.by;
            }
            old.sim.status = 'returned';
            old.sim.holder = null;
            run.completedReplacements.push(
              old.dto.assetType === AssetType.ICT ? 'ict' : 'fixed',
            );
          }
        } else if (step.replaces) {
          run.problems.push(
            `${label}: only a replacement names a replaced asset`,
          );
        }
        break;
      }

      case 'assetRequest': {
        const label = `${at} "${step.key}"`;
        const a = known(label, step.asset);
        if (!a) break;
        run.problems.push(
          ...dtoProblems(
            label,
            plainToInstance(CreateAssetRequestDto, {
              assetId: PLACEHOLDER_UUID,
              type: step.type,
              preferredDate: '2026-12-31',
              details: step.details,
            }),
          ),
        );
        if (!step.details.startsWith(DEMO_TAG))
          run.problems.push(
            `${label}: details are missing the "${DEMO_TAG}" marker`,
          );
        if (!FILERS.includes(step.by))
          run.problems.push(
            `${label}: ${step.by} cannot file (no seeded login)`,
          );
        if (a.sim.holder !== step.by || a.sim.status !== 'issued') {
          run.problems.push(
            `${label}: ${step.by} does not hold "${step.asset}" (status ${a.sim.status})`,
          );
        }
        if (a.sim.openRequest)
          run.problems.push(
            `${label}: "${step.asset}" already has an open request`,
          );
        const ownItem =
          CUSTODIANS.includes(step.by) &&
          String(step.by) === custodianOf(a.dto.assetType);
        if (step.decider === 'admin' && !ownItem) {
          run.problems.push(
            `${label}: only a custodian's own item falls to the admin, and ${step.by} is not that item's custodian`,
          );
        }
        if (step.decider === 'custodian' && ownItem) {
          run.problems.push(
            `${label}: a custodian cannot decide their own item; it needs decider "admin"`,
          );
        }
        if (
          step.type === AssetRequestType.REPAIR &&
          step.outcome === 'completed'
        ) {
          a.sim.status = 'under_repair';
          run.openRepairs.push({
            asset: step.asset,
            inHouse: (step.service?.type ?? 'in_house') === 'in_house',
            overdue: (step.service?.dueInDays ?? 1) < 0,
            withLoaner: false,
            ict: a.dto.assetType === AssetType.ICT,
            heldByCustodian: ownItem,
          });
        } else if (
          step.type === AssetRequestType.RETURN &&
          step.outcome === 'completed'
        ) {
          a.sim.status = 'returned';
          a.sim.holder = null;
        } else if (step.outcome !== 'completed') {
          a.sim.openRequest = true;
        }
        if (ownItem)
          run.custodianRequests.push(
            step.outcome === 'submitted' ? 'waiting' : 'decided',
          );
        break;
      }

      case 'transfer': {
        const a = known(at, step.asset);
        if (!a) break;
        if (a.sim.status !== 'available')
          run.problems.push(
            `${at}: "${step.asset}" is not available to transfer (it is ${a.sim.status})`,
          );
        a.sim.status = 'transferred';
        break;
      }

      case 'dispose': {
        const a = known(at, step.asset);
        if (!a) break;
        if (a.sim.status !== 'available')
          run.problems.push(
            `${at}: "${step.asset}" must be available to be flagged and disposed (it is ${a.sim.status})`,
          );
        if (!step.notes.trim())
          run.problems.push(`${at}: a disposal flag needs a justification`);
        a.sim.status = 'disposed';
        a.sim.holder = null;
        break;
      }
    }
  });
  return run;
}

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

/** Everything that could make the scenario fail partway through a live run. Empty = valid. */
export function validatePages(): string[] {
  const problems: string[] = [];
  const keys = PAGES_ASSETS.map((a) => a.key);
  keys
    .filter((k, i) => keys.indexOf(k) !== i)
    .forEach((k) => problems.push(`asset: duplicate key "${k}"`));
  for (const a of PAGES_ASSETS) {
    problems.push(
      ...dtoProblems(`asset ${a.key}`, plainToInstance(CreateAssetDto, a.dto)),
    );
    if (!a.dto.propertyNumber?.startsWith(PAGES_PROPERTY_PREFIX)) {
      problems.push(
        `asset ${a.key}: propertyNumber is missing the demo marker "${PAGES_PROPERTY_PREFIX}"`,
      );
    }
  }
  problems.push(...simulate(PAGES_STEPS, PAGES_ASSETS).problems);
  return problems;
}

// ── Coverage ─────────────────────────────────────────────────────────────────

export interface PagesCoverage {
  openRepairs: {
    inHouse: number;
    external: number;
    overdue: number;
    withLoaner: number;
    ict: number;
    fixed: number;
    heldByCustodian: number;
  };
  closedRepairs: { repaired: number; unrepairable: number };
  repeatRepairAssets: number;
  holders: Record<Holder, number>;
  ownRequisitions: Record<string, number>;
  custodianRequests: { waiting: number; decided: number };
  transferred: number;
  disposed: number;
  completedReplacements: { ict: number; fixed: number };
  locations: number;
}

/** What each page will have once the steps have run, from the same simulation validatePages uses. */
export function pagesCoverage(): PagesCoverage {
  const run = simulate(PAGES_STEPS, PAGES_ASSETS);
  const count = <T>(items: T[], pick: (i: T) => boolean) =>
    items.filter(pick).length;
  const holders = {
    employee: 0,
    supervisor: 0,
    it_personnel: 0,
    property_custodian: 0,
    property_officer: 0,
    management: 0,
    system_admin: 0,
  } as Record<Holder, number>;
  for (const s of run.sim.values()) if (s.holder) holders[s.holder] += 1;
  const finalStates = [...run.sim.values()];
  return {
    openRepairs: {
      inHouse: count(run.openRepairs, (r) => r.inHouse),
      external: count(run.openRepairs, (r) => !r.inHouse),
      overdue: count(run.openRepairs, (r) => r.overdue),
      withLoaner: count(run.openRepairs, (r) => r.withLoaner),
      ict: count(run.openRepairs, (r) => r.ict),
      fixed: count(run.openRepairs, (r) => !r.ict),
      heldByCustodian: count(run.openRepairs, (r) => r.heldByCustodian),
    },
    closedRepairs: {
      repaired: count(run.finishedRepairs, (o) => o === 'repaired'),
      unrepairable: count(run.finishedRepairs, (o) => o === 'unrepairable'),
    },
    repeatRepairAssets: count(finalStates, (s) => s.repairsDone >= 3),
    holders,
    ownRequisitions: run.ownRequisitions,
    custodianRequests: {
      waiting: count(run.custodianRequests, (r) => r === 'waiting'),
      decided: count(run.custodianRequests, (r) => r === 'decided'),
    },
    transferred: count(finalStates, (s) => s.status === 'transferred'),
    disposed: count(finalStates, (s) => s.status === 'disposed'),
    completedReplacements: {
      ict: count(run.completedReplacements, (r) => r === 'ict'),
      fixed: count(run.completedReplacements, (r) => r === 'fixed'),
    },
    locations: new Set(PAGES_ASSETS.map((a) => a.dto.officeOrSection)).size,
  };
}
