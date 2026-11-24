export async function showAssetBarcode(
  preview: Window,
  itemDescription: string,
  labelCode: string,
  barcodeValue: string,
) {
  const { default: JsBarcode } = await import('jsbarcode');
  if (preview.closed) return;

  const doc = preview.document;
  const label = doc.createElement('main');
  const item = doc.createElement('div');
  item.textContent = itemDescription;
  const barcode = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(barcode, barcodeValue, {
    format: 'CODE128',
    width: 1.2,
    height: 48,
    margin: 12,
    displayValue: false,
  });
  const code = doc.createElement('strong');
  code.textContent = labelCode;
  label.append(item, barcode, code);

  const print = doc.createElement('button');
  print.type = 'button';
  print.textContent = 'Print label';
  print.addEventListener('click', () => preview.print());

  const style = doc.createElement('style');
  style.textContent = `
    body { margin: 16px; font: 14px system-ui, sans-serif; color: #000; background: #fff; }
    main { display: inline-grid; justify-items: center; text-align: center; }
    main div { max-width: 60mm; overflow-wrap: anywhere; }
    button { display: block; margin-top: 16px; padding: 6px 12px; cursor: pointer; }
    @page { margin: 4mm; }
    @media print { body { margin: 0; } button { display: none; } }
  `;
  doc.title = 'Asset barcode';
  doc.head.append(style);
  doc.body.replaceChildren(label, print);
  print.focus();
}
