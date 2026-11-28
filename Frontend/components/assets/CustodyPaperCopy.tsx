'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';

type CustodyFields = readonly (readonly [label: string, value: string])[];

function openCustodyPrint(item: string, fields: CustodyFields) {
  const preview = window.open('', '_blank');
  if (!preview) return false;
  preview.opener = null;
  const doc = preview.document;
  doc.title = `Custody record — ${item}`;
  const element = (tag: string, text: string) => {
    const node = doc.createElement(tag);
    node.textContent = text;
    return node;
  };

  const style = element('style', `
    body { margin: 24px auto; padding: 0 20px; max-width: 800px; color: #111; font: 14px Arial, sans-serif; }
    header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; }
    h1 { font-size: 20px; margin: 10px 0 0; }
    h2 { font-size: 16px; margin: 18px 0 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #aaa; padding: 8px 10px; text-align: left; }
    th { width: 30%; }
    footer { display: flex; gap: 32px; margin-top: 58px; }
    footer p { border-top: 1px solid #333; flex: 1; margin: 0; padding-top: 6px; }
    button { margin-top: 24px; padding: 8px 16px; cursor: pointer; }
    @page { margin: 16mm; }
    @media print { body { margin: 0; padding: 0; } button { display: none; } tr, footer { break-inside: avoid; } }
  `);
  const header = doc.createElement('header');
  header.append(element('strong', 'Cybercrime Investigation and Coordinating Center'), element('h1', 'Asset Custody Record'));
  const table = doc.createElement('table');
  for (const [label, value] of fields) {
    const heading = element('th', label);
    heading.setAttribute('scope', 'row');
    table.insertRow().append(heading, element('td', value));
  }
  const signatures = doc.createElement('footer');
  signatures.append(element('p', 'Asset holder · Signature and date'), element('p', 'Asset custodian · Signature and date'));
  const button = element('button', 'Print');
  button.addEventListener('click', () => preview.print());
  doc.head.append(style);
  doc.body.replaceChildren(header, element('h2', item), table, signatures, button);
  button.focus();
  return true;
}

export function CustodyPaperCopy({ item, fields }: Readonly<{ item: string; fields: CustodyFields }>) {
  const [blocked, setBlocked] = useState(false);

  return (
    <section aria-label="Paper copy" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="font-bold text-slate-950">Paper copy</h3>
        <p className="mt-1 text-sm text-slate-600">Print the custody record with the holder, issue date, and signature lines.</p>
      </div>
      <button type="button" onClick={() => setBlocked(!openCustodyPrint(item, fields))} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
        <Printer className="size-4" aria-hidden="true" /> Print copy
      </button>
      {blocked && <p role="alert" className="text-sm text-red-700">Allow pop-ups for this site and try again.</p>}
    </section>
  );
}
