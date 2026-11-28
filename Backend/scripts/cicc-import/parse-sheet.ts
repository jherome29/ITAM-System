import ExcelJS from 'exceljs';
import {
  AssetClass,
  AssetCondition,
  AssetType,
} from '../../../packages/shared/src/enums';
import { CreateAssetDto } from '../../src/assets/dto/create-asset.dto';

// Turns CICC's own partial equipment list (an ad-hoc PPE/SEP workbook, not a
// system export) into CreateAssetDto rows ready for the real /v1/assets API.
// The workbook itself is never committed — real property numbers, costs and
// accountable-officer names don't belong in a public repo's history — only
// this parser does. Point --file at the actual workbook at run time.

export interface ParsedAsset {
  sheet: string;
  row: number;
  dto: CreateAssetDto;
}

export interface ReviewRow {
  sheet: string;
  row: number;
  reason: string;
  itemDescription?: string;
}

export interface ParseResult {
  assets: ParsedAsset[];
  needsReview: ReviewRow[];
}

// Column order in both sheets (1-indexed, matching the workbook's header row).
const COL = {
  sapClassification: 1,
  itemCode: 2,
  itemType: 3, // "CLASSIFICATION" — MONITOR / CPU / PRINTER / etc. Sorting hint only, not stored.
  itemDescription: 4,
  assetClassLabel: 5, // "CLASSIFICATION" again — PPE/SEP, used only when cost can't decide.
  brand: 6,
  serialNumber: 7,
  propertyNumber: 8,
  componets: 9, // sub-item code for a multi-row set (e.g. a desktop's monitor/CPU/UPS)
  acquisitionCost: 10,
  acquisitionDate: 11,
  accountableOfficer: 12,
  subAccountableOfficer: 13,
  division: 14,
  officeOrSection: 15,
  officeLocation: 16,
  condition: 17,
  supplier: 18,
  dateOfDelivery: 19,
} as const;
const LAST_COL = 19;

// Item-type → ICT/Fixed, agreed over the session by walking the workbook's
// own vocabulary rather than guessing. Case-insensitive, trimmed.
const ICT_ITEM_TYPES = new Set([
  'monitor', 'laptop', 'cpu', 'ups', 'headphone', 'mouse',
  'faraday box with tablet', 'faraday box', 'document camera',
  'technical printer', 'power supply', 'id card printer', 'printer',
  'modem', 'projector', 'cctv',
]);
const FIXED_ITEM_TYPES = new Set([
  'television', 'photocopying machine e-copy', 'duplicator', 'car',
  'testing device', 'office table', 'executive table', 'folding table', 'chair',
]);

// Fallback for the ~122 SEP rows with no item-type cell at all — classify by
// description keyword instead. Checked in order, first match wins.
const ICT_DESC_KEYWORDS = [
  'seagate', 'back up', 'ssd', 'nvme', 'kingston', 'samsung', ' ram',
  'gskill', 'dram', 'transcend', 'biometric', 'finger scanner',
  'wall charger', 'projector', 'document camera', 'webcam', 'network',
  'bullet camera', 'poe switch', 'ptz', 'microphone', 'recorder',
  'headphone', 'ds 200', 'ds rotation', 'scanner', 'hardisk', 'hard drive',
  'keyboard', 'license', 'laserfiche', 'laserfische',
  'enterprise content management', 'forensic workstation', 'workstation',
];
const FIXED_DESC_KEYWORDS = [
  'aircon', 'air conditio', 'fan', 'humidifier', 'purifier', 'led light',
  'table', 'chair', 'shredd', 'paper cutter', 'laminat', 'bill counter',
  'pvc id cutter', 'gree', 'split type', 'flag pole', 'podium',
];

interface RichTextValue {
  richText: { text: string }[];
}
function isRichText(v: unknown): v is RichTextValue {
  return (
    typeof v === 'object' &&
    !!v &&
    Array.isArray((v as RichTextValue).richText)
  );
}

interface FormulaValue {
  result?: unknown;
}
function isFormula(v: unknown): v is FormulaValue {
  return typeof v === 'object' && !!v && 'result' in v;
}

// ExcelJS hands back a plain value for most cells, but not for every one:
// mixed formatting (part bold, part not) comes back as { richText: [...] },
// and a formula cell — CICC used these to repeat an identical description via
// a cell reference instead of retyping it — comes back as
// { result, sharedFormula }. Read either with String(v) and you get the
// useless "[object Object]" instead of the text inside (confirmed: this
// silently wrote "[object Object]" as the item description for 70 real rows
// before this fix).
function trimmed(v: unknown): string {
  if (v == null) return '';
  if (isRichText(v)) return v.richText.map((part) => part.text).join('').trim();
  if (isFormula(v)) return trimmed(v.result);
  return String(v).trim();
}

function classifyAssetType(
  itemType: string,
  itemDescription: string,
): AssetType | undefined {
  const type = itemType.trim().toLowerCase();
  if (type) {
    if (ICT_ITEM_TYPES.has(type)) return AssetType.ICT;
    if (FIXED_ITEM_TYPES.has(type)) return AssetType.FIXED;
  }
  const desc = itemDescription.toLowerCase();
  for (const kw of ICT_DESC_KEYWORDS) if (desc.includes(kw)) return AssetType.ICT;
  for (const kw of FIXED_DESC_KEYWORDS) if (desc.includes(kw)) return AssetType.FIXED;
  return undefined; // genuinely unrecognized — goes to needsReview, never guessed
}

// Only real condition wording is mapped; custody/location notes that landed
// in this column ("from Juan dela Cruz", a PTR reference, a room name) are
// not a condition at all and are intentionally dropped, per session review.
function classifyCondition(raw: string): AssetCondition {
  const s = raw.trim().toUpperCase();
  if (!s || s === 'GOOD') return AssetCondition.SERVICEABLE;
  if (s.includes('REPAIR')) return AssetCondition.FOR_REPAIR;
  if (s.includes('DAMAG') || s.includes('DEFECTIVE')) return AssetCondition.UNSERVICEABLE;
  return AssetCondition.SERVICEABLE;
}

// CICC uses a bare "x" to mean "not assigned yet" in several columns
// (confirmed for serial number; a live import run found it in property
// number too — two assets both named "x" collided on the DB's unique
// constraint until this was added).
function cleanCode(raw: string): string {
  const s = raw.trim();
  return !s || /^x+$/i.test(s) ? '' : s;
}

// A monitor/CPU/UPS set shares one property number in the sheet with a
// sub-code in "COMPONETS" (e.g. 0122ICT0008-DT-001-A). The DB's property
// number column is unique, so the sub-code becomes the real property number
// and the shared set code becomes a note — never both written to the same field.
function propertyAndComponents(
  sheetPropertyNumber: string,
  componets: string,
): Pick<CreateAssetDto, 'propertyNumber' | 'components'> {
  const prop = cleanCode(sheetPropertyNumber);
  const comp = cleanCode(componets);
  if (comp) {
    return {
      propertyNumber: comp,
      components: prop && prop !== comp ? `Set: ${prop}` : undefined,
    };
  }
  return { propertyNumber: prop || undefined };
}

function combineOfficer(officer: string, sub: string): string | undefined {
  if (officer && sub) return `${officer} / Sub: ${sub}`;
  if (officer) return officer;
  if (sub) return `Sub: ${sub}`;
  return undefined;
}

function parseCost(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return raw > 0 ? raw : undefined;
  const n = Number.parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
];

// The header claims DD/MM/YYYY; the actual text dates in this workbook are
// MM/DD/YYYY (confirmed: 135 values prove it, zero prove the header's claim).
// A cell with two dates jammed together ("11/28/22 & 07/26/23") is held out
// for manual review rather than guessed.
function parseDate(raw: unknown): { iso?: string; review?: string } {
  if (raw instanceof Date) {
    return { iso: raw.toISOString().slice(0, 10) };
  }
  const s = trimmed(raw);
  if (!s || s.toLowerCase() === 'x' || s.toLowerCase() === 'n/a') return {};
  const slashDates = s.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) ?? [];
  if (s.includes('&') || slashDates.length > 1) return { review: s };

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, mm, dd, yyRaw] = m;
    const year = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return { iso: `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` };
  }
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const idx = MONTH_NAMES.indexOf(m[1].toLowerCase());
    if (idx >= 0) {
      return { iso: `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` };
    }
  }
  return { review: s }; // unrecognized format — flagged, never guessed
}

function cleanSerial(raw: string): string | undefined {
  const s = raw.trim();
  if (!s || /^x+$/i.test(s)) return undefined;
  return s;
}

export async function parseWorkbook(filePath: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const assets: ParsedAsset[] = [];
  const needsReview: ReviewRow[] = [];

  for (const sheetName of ['PPE', 'SEP'] as const) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;

    for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const cell = (col: number) => row.getCell(col).value;
      const texts: string[] = [];
      for (let c = 1; c <= LAST_COL; c += 1) {
        const t = trimmed(cell(c));
        if (t) texts.push(t);
      }
      // A real row has different values in different columns. A section
      // header is either one lone cell ("DESKTOP") or — further down this
      // sheet — a single cell merged across the whole row, which ExcelJS
      // reports as every column holding that same repeated text
      // ("HEADPHONE", "TELEVISION", "MOTOR VEHICLE", …). Either way, down to
      // one distinct value across the row means it isn't a real item.
      if (new Set(texts).size <= 1) continue;

      const itemDescription = trimmed(cell(COL.itemDescription));
      if (!itemDescription) {
        needsReview.push({
          sheet: sheetName,
          row: rowNumber,
          reason: 'No item description',
        });
        continue;
      }

      const itemType = trimmed(cell(COL.itemType));
      const assetType = classifyAssetType(itemType, itemDescription);
      if (!assetType) {
        needsReview.push({
          sheet: sheetName,
          row: rowNumber,
          reason: `Could not classify ICT vs Fixed (item type: "${itemType || '(blank)'}")`,
          itemDescription,
        });
        continue;
      }

      // The server always recomputes assetClass itself from assetType + cost
      // (classifyRegisteredAsset) and rejects the row outright if it can't —
      // it does not fall back to whatever assetClass the client sends. So for
      // ICT/Fixed (Supplies is always IES regardless of cost) a missing cost
      // isn't a value we can paper over with the sheet's PPE/SEP label; the
      // row genuinely cannot be registered until CICC supplies a real cost.
      const cost = parseCost(cell(COL.acquisitionCost));
      if (cost === undefined && assetType !== AssetType.SUPPLIES) {
        needsReview.push({
          sheet: sheetName,
          row: rowNumber,
          reason: 'No acquisition cost — the app requires one to classify an ICT/Fixed item as PPE or SEP, and will not accept a guess',
          itemDescription,
        });
        continue;
      }
      const assetClass =
        assetType === AssetType.SUPPLIES
          ? AssetClass.IES
          : (cost as number) >= 50_000
            ? AssetClass.PPE
            : AssetClass.SEP;

      // Likewise, the server refuses to *create* an asset already unserviceable
      // (or for_disposal) — that assessment has to be recorded through Mark
      // Unserviceable in Update Lifecycle, with its own disposal justification,
      // which is a real decision for a custodian to make, not something an
      // import should trigger on CICC's behalf.
      const condition = classifyCondition(trimmed(cell(COL.condition)));
      if (
        condition === AssetCondition.UNSERVICEABLE ||
        condition === AssetCondition.FOR_DISPOSAL
      ) {
        needsReview.push({
          sheet: sheetName,
          row: rowNumber,
          reason: `Sheet says this item is ${condition} — register it, then use Mark Unserviceable in Update Lifecycle (needs a disposal justification the sheet doesn't provide)`,
          itemDescription,
        });
        continue;
      }

      const acqDate = parseDate(cell(COL.acquisitionDate));
      const deliveryDate = parseDate(cell(COL.dateOfDelivery));
      if (acqDate.review || deliveryDate.review) {
        needsReview.push({
          sheet: sheetName,
          row: rowNumber,
          reason: `Ambiguous date — acquisition: ${acqDate.review ?? 'ok'}, delivery: ${deliveryDate.review ?? 'ok'}`,
          itemDescription,
        });
        continue;
      }

      const { propertyNumber, components } = propertyAndComponents(
        trimmed(cell(COL.propertyNumber)),
        trimmed(cell(COL.componets)),
      );

      const dto: CreateAssetDto = {
        sapClassification: trimmed(cell(COL.sapClassification)) || undefined,
        itemCode: trimmed(cell(COL.itemCode)) || undefined,
        itemDescription,
        brand: trimmed(cell(COL.brand)) || undefined,
        serialNumber: cleanSerial(trimmed(cell(COL.serialNumber))),
        propertyNumber,
        components,
        acquisitionCost: cost,
        acquisitionDate: acqDate.iso,
        accountableOfficer: combineOfficer(
          trimmed(cell(COL.accountableOfficer)),
          trimmed(cell(COL.subAccountableOfficer)),
        ),
        division: trimmed(cell(COL.division)) || undefined,
        officeOrSection: trimmed(cell(COL.officeOrSection)) || undefined,
        officeLocation: trimmed(cell(COL.officeLocation)) || undefined,
        condition,
        supplier: trimmed(cell(COL.supplier)) || undefined,
        dateOfDelivery: deliveryDate.iso,
        assetClass,
        assetType,
      };

      assets.push({ sheet: sheetName, row: rowNumber, dto });
    }
  }

  // property_number is unique in the database. Two rows landing on the same
  // value is either a genuine duplicate in CICC's own records, or — seen in
  // a live run — the property-number column holding a model/spec note
  // ("DDR5 5600 32GB Unbuffered") that's identical across several otherwise-
  // unrelated identical parts, not an actual identifier. Either way it's not
  // something to resolve by guessing which row "wins"; both/all go to review.
  const byPropertyNumber = new Map<string, ParsedAsset[]>();
  for (const a of assets) {
    if (!a.dto.propertyNumber) continue;
    const list = byPropertyNumber.get(a.dto.propertyNumber) ?? [];
    list.push(a);
    byPropertyNumber.set(a.dto.propertyNumber, list);
  }
  const duplicateRowKeys = new Set<string>();
  for (const [propertyNumber, group] of byPropertyNumber) {
    if (group.length <= 1) continue;
    const rows = group.map((g) => `${g.sheet} ${g.row}`);
    for (const g of group) {
      duplicateRowKeys.add(`${g.sheet}:${g.row}`);
      needsReview.push({
        sheet: g.sheet,
        row: g.row,
        reason: `Property number "${propertyNumber}" also used by: ${rows.filter((r) => r !== `${g.sheet} ${g.row}`).join(', ')}`,
        itemDescription: g.dto.itemDescription,
      });
    }
  }
  const deduped = assets.filter(
    (a) => !duplicateRowKeys.has(`${a.sheet}:${a.row}`),
  );

  return { assets: deduped, needsReview };
}
