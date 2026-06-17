import PDFDocument from 'pdfkit';
import { bufferize, phpFormat, fmtDate } from './base-form.generator';

// SVC: Obtain/Build — Sticker Card printed when IT Personnel tags a registered asset (Appendix 58)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
  acquisitionCost: number;
  acquisitionDate: Date | string | null;
  condition: string;
  qrCode: string | null;
}

const CARD_W = 252; // ~3.5 inches
const CARD_H = 144; // ~2 inches
const MARGIN = 8;

function drawCard(
  doc: PDFKit.PDFDocument,
  asset: AssetLike,
  x: number,
  y: number,
): void {
  // Border
  doc.rect(x, y, CARD_W, CARD_H).strokeColor('#000000').lineWidth(1).stroke();

  // Header bar
  doc.rect(x, y, CARD_W, 18).fillAndStroke('#1a4d7a', '#1a4d7a');
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
  doc.text('CICC — Government Property', x + MARGIN, y + 5, {
    width: CARD_W - MARGIN * 2,
  });

  let cy = y + 22;
  const lx = x + MARGIN;
  const lw = CARD_W - MARGIN * 2;

  const line = (label: string, value: string) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor('#000000')
      .text(`${label}:`, lx, cy, { continued: true, width: lw });
    doc.font('Helvetica').fontSize(6.5).text(` ${value}`, { width: lw });
    cy += 11;
  };

  line('Property No', asset.propertyNumber ?? '—');
  line(
    'Description',
    asset.itemDescription.length > 40
      ? asset.itemDescription.slice(0, 40) + '…'
      : asset.itemDescription,
  );
  if (asset.brand) line('Brand', asset.brand);
  if (asset.serialNumber) line('Serial No', asset.serialNumber);
  line('Acq. Cost', phpFormat(asset.acquisitionCost));
  line('Date Acquired', fmtDate(asset.acquisitionDate));
  line('Condition', asset.condition);

  // QR placeholder
  if (asset.qrCode) {
    doc.font('Helvetica').fontSize(5.5).fillColor('#555555');
    doc.text(`QR: ${asset.qrCode.slice(0, 20)}`, lx, cy, { width: lw });
  }
}

export async function generateStickerCard(
  assets: AssetLike[],
): Promise<Buffer> {
  // 4 cards per A4 page, 2 columns × 2 rows
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    autoFirstPage: true,
  });

  const COLS = 2;
  const GAP = 20;
  const items =
    assets.length === 0
      ? [
          {
            propertyNumber: null,
            itemDescription: 'No data',
            brand: null,
            serialNumber: null,
            acquisitionCost: 0,
            acquisitionDate: null,
            condition: '—',
            qrCode: null,
          },
        ]
      : assets;

  let idx = 0;
  for (idx = 0; idx < items.length; idx++) {
    if (idx > 0 && idx % 4 === 0) doc.addPage();
    const col = idx % COLS;
    const row = Math.floor((idx % 4) / COLS);
    const x = 40 + col * (CARD_W + GAP);
    const y = 40 + row * (CARD_H + GAP);
    drawCard(doc, items[idx], x, y);
  }

  return bufferize(doc);
}
