# COA Form Template Fidelity Audit — 2026-08-19 (status updated 2026-10-16)

## Status update — 2026-10-16

The audit below is kept as written on 2026-08-19: it is the structural comparison against `FORMS/`. This block says what has happened since. Each "Fixed" was checked in the code and, for layout, in rendered PDFs.

| Finding (2026-08-19) | Status | Notes |
|---|---|---|
| RSMI hardcodes every cost to ₱0.00 | **Fixed** | Supplies are priced from the stock they were issued from (`fulfilledAssetId`); a line with no stock link prints a dash and is left out of the total |
| RPCI fakes the count columns (`'1'`, blank shortage) | **Fixed** | `QTY PER CARD` shows the quantity on record, the physical count and shortage/overage are left blank to fill in by hand. A *real* reconciliation still needs physical-count recording, which is not built |
| RPCPPE is a plain asset listing | Open | Same dependency on physical-count recording; its third signatory is still an internal officer, not the COA Representative the official form requires |
| Move-In / Move-Out "Property Type" always `[x] Office` | **Open** | Still hardcoded in `move-in.generator.ts` / `move-out.generator.ts`. Misrepresents real data: fix first |
| WMR has no Certificate of Inspection | Open | |
| IIRUP drops the accounting columns and the Witness | Open | |
| Extra unofficial third signatory on PAR, ICS, IAR, both receipts, RLSDDP | Open | The shared template still defaults to three signature slots |
| Sticker Card is an asset tag, not Appendix 58's Stock Card | Open | Needs a decision: rename it, or build a real Stock Card |
| Annex A.4 is a flat per-period list, not a running-balance ledger | Open | It now prints the *real* ICS number of an item (see below) |
| RLSDDP: no police-notified field, no notarisation block | Open | The notarisation block is deliberately left to a live notary |
| RIS / RSMI: no Responsibility Center Code | Open (minor) | |

**Fixed in the shared machinery since the audit (applies to all 18 forms):**
- The seven per-transaction forms (PAR, ICS, PTR, IAR, Receipt of Returned Property / SEP, RLSDDP, Move-Out) carry a **real running number** `<SERIES>-<YYYY>-<NNNN>`, allocated in the same transaction that stores the form (no gaps, no duplicates). The series is a placeholder until CICC's property office gives its own. Entity name and Fund Cluster are System Settings, not fixed text.
- Tables paginate and **fit the page**: `drawTable` scales columns to the content width, never below the longest word in a column, and grows its header row to the tallest header.
- The form number no longer prints over its own label (`drawFormTitle` stacks them).

**Found by rendering and reading all 18 PDFs on 2026-10-16 (and fixed):** the form number overprinted its label on every numbered form; the Annex A.4, RPCPPE and IIRUP tables ran past the right margin (the RPCPPE's Accountable Officer column was entirely off the page); headers and values broke mid-word (`REM/ARK/S`, `Serviceabl/e`); a 3-line header spilled over the first row (ICS); a stray `:` on the RIS; the IIRUP printed the raw role `property_custodian`; the RLSDDP named whoever generated it, not the holder, as Accountable Officer; the Annex A.4 printed an invented `ICS-<property number>`.

**Raised the same day, needs a decision (not changed):**
- The Annex A.4 is titled "Issued" but lists every SEP asset created in the period, including stock that was never issued.
- PAR, ICS and RLSDDP print the asset's registered section as Office/Section, not the end user's.
- The Receipt of Returned Property prints a blank line for Date Acquired.
- An IIRUP can show Condition "Serviceable" for an asset flagged for disposal through the lifecycle endpoint (the flag does not change the condition).
- Dates print MM/DD/YYYY; period reports treat an end date as midnight.

**Still not done:** a comparison of each generated PDF with its reference in `FORMS/` (layout and content have been read; the paper forms have not been laid next to them). When a generator changes, run `CHECKS.md` check 13.

---


All 18 generators in `Backend/src/reports/forms/` checked against their actual
reference files in `FORMS/`. Method: extracted each reference `.xls`/`.xlsx`/`.docx`
to text (cell/paragraph content) and compared field lists, table columns, and
signatory count/roles against each generator's code. Not a pixel-level visual
comparison — a structural one. Findings grouped by how far each form has drifted
from its reference, worst first.

All 18 share one generic layout from `base-form.generator.ts` (header + meta
fields + table + signature block) instead of each form reproducing its own
official field list. That shared template is *why* the same failure pattern
— an extra, unofficial third signatory — shows up repeatedly across unrelated
forms: the template defaults to 3 signature slots regardless of what the real
form actually requires.

## Conceptually the wrong document

- **Sticker Card (Appendix 58 / `sticker-card.generator.ts`)** — the actual
  reference file for Appendix 58 is a **Stock Card**: a running ledger of
  Date / Reference / Receipt Qty / Issue Qty / Balance Qty / Days-to-Consume
  for a single stock item over time. The generator instead produces a
  physical adhesive asset tag (property no., description, QR code, 4-per-page
  layout) — a real, useful thing for IT Personnel to print and stick on
  equipment, but not the same document as Appendix 58 at all. Either the
  generator should be renamed/reclassified as something else entirely, or a
  real Stock Card generator needs to be built separately.

## Functionally broken, not just wrong layout

- **RPCI (Appendix 66)** — the "physical count" columns are faked in the
  generator code itself: `QTY PER CARD` and `QTY PER COUNT` are both
  hardcoded to `'1'`, and `SHORTAGE`/`OVERAGE` are hardcoded to `''`
  (`rpci.generator.ts` line ~58). **RPCPPE (Appendix 73) is different and
  arguably worse** — `rpcppe.generator.ts` has no card/count/shortage/overage
  columns at all (verified directly: its table is Property No./Description/
  Serial No./Date Acquired/Acquisition Cost/Condition/Location/Accountable
  Officer — a plain asset listing, not a reconciliation table in any form,
  faked or otherwise). Neither generator can actually record a physical
  count and compare it against system records — this confirms and details
  the "No physical count / reconciliation" gap already on the priority list,
  not a new issue, but
  worth knowing it's not just "the UI to input a count doesn't exist yet" —
  the generator would silently show zero discrepancy for every asset even if
  one existed. Separately, the official form's third signatory is
  specifically a **COA Representative** ("Verified by") — the generator
  assigns that role to an internal "Supply / Property Officer" instead, which
  isn't a stand-in a system can legitimately claim.
- **IIRUP (Appendix 74)** — the real form is a dense accounting document:
  Unit Cost, Total Cost, Accumulated Depreciation, Accumulated Impairment
  Losses, Carrying Amount, a disposal-method breakdown (Sale / Transfer /
  Destruction / Others), Appraised Value, and a Record of Sales (OR No. /
  Amount) — plus **4** signature roles including a required **Witness**. The
  generator drops all of the accounting columns and the disposal breakdown,
  and its signature block only has 3 roles — the Witness is missing entirely.
- **WMR (Appendix 65)** — the official form has a second section, "Certificate
  of Inspection," with disposition-method checkboxes (destroyed / sold at
  private sale / sold at public auction / transferred), a Record of Sales
  table (OR No./Date/Amount), and a Witness signature — none of it exists in
  the generated version, which only produces the first (simpler) half of the
  form with different signatory labels than the original.

## Moderate divergence — extra/wrong fields, extra signatory

- **PAR (Appendix 71)** — adds an unofficial Republic/CICC letterhead header
  (the real form is just a blank "Entity Name" field) and an unofficial third
  "Approved by" signatory; the real form has only 2 (Received by, Issued by).
  Adds "Date"/"Office/Section" meta fields not on the original; reorders and
  adds a "REMARKS" table column not present in the official 6-column layout.
- **ICS (Appendix 59)** — same pattern: unofficial header, unofficial third
  signatory ("Head, Property/Supply Division" — original has 2), drops the
  official's "Total Cost" sub-column in favor of "DATE ACQUIRED" (not on the
  original at all).
- **IAR (Appendix 62)** — official has a genuinely different structure: two
  parallel INSPECTION/ACCEPTANCE sections with a Complete/Partial acceptance
  checkbox and only 2 signatories. Generator sequences the two sections
  reasonably but drops the Complete/Partial checkbox, drops PO No./Date,
  Invoice No., and Responsibility Center Code meta fields, and adds an
  unofficial third "Authorized Official" signatory.
- **Receipt of Returned Property (Annex 28)** — official has 2 signatories
  (Returned by, Received by); generator adds an unofficial third ("Head,
  Property/Supply Division"). Table column "End-user/Office" gets replaced
  with "DATE ACQUIRED", which isn't on the original.
- **Receipt of Returned SEP (Annex A.6)** — same extra-signatory pattern as
  above; table columns otherwise close to the original.
- **Annex A.4** — official is a running-balance *registry ledger* per SEP
  item (Issued/Returned/Re-issued/Disposed quantities + a Balance column,
  tracked over the item's life), not a flat per-period issuance list. The
  generator produces the latter — same general subject, structurally a
  different kind of document. Missing "Estimated Useful Life" and all of the
  Returned/Re-issued/Disposed/Balance tracking.
- **RLSDDP (Appendix 75)** — captures the Lost/Stolen/Damaged/Destroyed
  status checkbox and circumstances narrative correctly. Missing the "Police
  Notified: Yes/No + Police Station" field the real form has. Missing the
  entire notarization block (government ID, Doc/Page/Book/Series No.,
  "SUBSCRIBED AND SWORN...") — arguably unavoidable, since that section
  legally requires a live notary to execute, not something software should
  auto-fill. Adds an unofficial third signatory ("Head, Property Division").
- **Move-In / Move-Out (SS-01, SS-02)** — these are internal CICC admin
  forms, not COA appendices, and diverge the most from any of the 18. Wrong
  attachment checkboxes entirely (generator offers "PAR / ICS / Others"; the
  real forms require "Equipment Photos (MANDATORY)" for move-in, and
  "Incident Report / Destination-Transfer / Borrowed by / Returned Date" for
  move-out). **The "Property Type: Office/Personal" checkbox is hardcoded to
  always show `[x] Office [ ] Personal`** regardless of the actual request —
  a real logic bug, not just a formatting gap; a personal-item move would be
  misrepresented on the printed form. Missing the "Third Party: POC/Others"
  field and "Date of Pull-out" entirely. Signatory labels don't match
  (generator: Requested by/Noted by/Received by or Guard on Duty; official:
  Approved by/Requested by/Checked by).

## Close — minor field differences only

- **RIS** — 4 signatory roles (Requested/Approved/Issued/Received by) match
  the original well. Missing "Responsibility Center Code" meta field; table
  columns reasonably close (merges the official's Yes/No stock-availability
  split into one column).
- **RSMI (Appendix 64)** — table columns line up closely with the reference
  (RIS No., Stock No., Item, Unit, Qty Issued, Unit Cost, Amount); missing
  "Responsibility Center Code" column. Adds a Recapitulation/UACS section not
  fully verified against the reference (the reference sample ran to
  real historical data too large to fully render in this pass).
- **RSPI (Annex A.7)** — the closest match of all 18: table columns
  (ICS No./RC Code/SEP No./Item Description/Unit/Qty/Unit Cost/Amount) map
  almost one-to-one onto the reference.
- **PTR (Appendix 76)** — same 3 signatory roles as the original (Approved
  by/Released-Issued by/Received by), just different display order. Table
  columns close, adds a "QTY" column not clearly present in the flattened
  reference (hard to confirm from the extracted text alone).

## What this means practically

Fixing this is bounded, repetitive work, not architecturally hard — the
shared `drawTable`/`drawSignatureBlock`/`drawMetaFields` helpers in
`base-form.generator.ts` already work fine. Each generator needs its field
list, column list, and signatory list rebuilt from its actual reference file
in `FORMS/` instead of the generic template's assumptions. RPCI/RPCPPE need
an actual physical-count input mechanism before their numbers mean anything,
which is separate, larger work already tracked on the priority list. Sticker
Card needs a decision: rename/reclassify it, or build a real Stock Card
generator to match what Appendix 58 actually is.
