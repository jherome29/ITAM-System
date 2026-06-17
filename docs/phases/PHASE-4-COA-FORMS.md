# PHASE 4 — COA Official Forms
### Goal: Generate PAR, ICS, and RIS PDFs matching real COA templates
### Time: Week 6
### Do this: ONLY after you have the real form templates from CICC

> ⚠️ Hard requirement before starting this phase:
> 1. You must have the actual blank PAR, ICS, and RIS forms from CICC
> 2. Phase 3 (IT Personnel pages) must be complete
>    because the download buttons live on those pages
>
> Do not attempt to build these forms without the real COA templates.
> The layout is legally fixed — you cannot guess it.

---

## What Claude Code Reads This Session

```
CLAUDE.md + SECURITY.md
```

---

## Step 4.1 — Get the Real Forms from CICC First

Ask your CICC liaison for these three blank form templates:

| Form | COA Reference | Triggered When |
|---|---|---|
| PAR — Property Acknowledgment Receipt | Appendix 71 | IT Personnel issues a property item |
| ICS — Inventory Custodian Slip | Appendix 59 | IT Personnel issues a SEP item |
| RIS — Requisition and Issue Slip | N/A | Employee requisition is fulfilled |

Get them as Word (.docx) or PDF files.

Once you have them, do this for each form:
- Write down every field label and where it appears
- Note the table structure (column names and order)
- Note the header section contents
- Note exactly where the signature lines are placed
- Note any government reference numbers on the form

---

## Step 4.2 — Build the PAR Generator

Once you have the real PAR form, use this prompt.
Fill in the bracketed parts from your actual form:

```
Read CLAUDE.md and SECURITY.md.

Build the PAR (Property Acknowledgment Receipt) PDF generator
in Backend/src/reports/par/

The real COA PAR form (Appendix 71) has these fields:
[list every field exactly as it appears on the real form]
[example: Entity Name, Fund Cluster, Property Number, etc.]

Map them to database fields like this:
[describe each mapping]
[example: "Entity Name" → always "CICC"]
[example: "Property Number" → asset.propertyNumber]
[example: "Item Description" → asset.itemDescription]

Requirements:
- Use pdfkit — not puppeteer
- Match the COA Appendix 71 layout exactly
  replicate the exact table structure and field positions
- Signature line is TEXT ONLY — no digital signature, no image
  Text: "Received by: _________________________"
        "Name / Position / Date"
- Endpoint: GET /api/v1/reports/par/:requisition_id
- Restrict to @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
- When form is generated, log to audit_logs:
  action: FORM_GENERATED, record_table: 'requisitions'
- Stream the PDF as the response:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="PAR-[id].pdf"
```

---

## Step 4.3 — Build the ICS Generator

Same approach as PAR. Fill in your real ICS form fields:

```
Read CLAUDE.md and SECURITY.md.

Build the ICS (Inventory Custodian Slip) PDF generator
in Backend/src/reports/ics/

The real COA ICS form (Appendix 59) has these fields:
[list every field from the real form]

Map them to database fields:
[describe each mapping]

Requirements:
- Same as PAR (pdfkit, signature line, audit log)
- Triggered when a SEP item is issued (not property items)
- Endpoint: GET /api/v1/reports/ics/:requisition_id
- Restrict to @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
```

---

## Step 4.4 — Build the RIS Generator

```
Read CLAUDE.md and SECURITY.md.

Build the RIS (Requisition and Issue Slip) PDF generator
in Backend/src/reports/ris/

The real RIS form has these fields:
[list every field from the real form]

Map them to database fields:
[describe each mapping]

Requirements:
- Same as PAR (pdfkit, signature line, audit log)
- Triggered when any requisition is fulfilled
- Endpoint: GET /api/v1/reports/ris/:requisition_id
- Restrict to @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
```

---

## Step 4.5 — Add Download Buttons to Frontend

After the three PDF endpoints are working, add download buttons
to the relevant IT Personnel pages:

```
Read CLAUDE.md and SECURITY.md.

Add download buttons to the IT Personnel fulfill requisition page.

When an IT Personnel member fulfills a requisition:
- If the item is a PROPERTY item → show "Download PAR" button
- If the item is a SEP item → show "Download ICS" button
- Always show "Download RIS" button for any fulfilled requisition

Each button calls the corresponding GET endpoint
and triggers a file download in the browser.
Use responseType: 'blob' in the axios call.
Show a loading spinner on the button while the PDF generates.
```

---

## Step 4.6 — Test Each Generated PDF

After building each generator, test it manually:

1. Create a test requisition and fulfill it through the system
2. Click the download button on the frontend
3. Open the downloaded PDF
4. Compare it side by side with the real blank COA form
5. Confirm every field is in the correct position
6. Confirm the signature line is text only — no digital signature
7. Show the PDF to your CICC liaison and ask if it matches
   what they currently use

---

## ✅ Checklist — confirm before moving to Phase 5

- [ ] Real PAR, ICS, RIS templates obtained from CICC
- [ ] PAR PDF downloads and matches Appendix 71 layout
- [ ] ICS PDF downloads and matches Appendix 59 layout
- [ ] RIS PDF downloads correctly
- [ ] All three forms log to audit_logs on generation
- [ ] Signature lines are text placeholders only — no digital signature
- [ ] Download buttons work correctly on the frontend
- [ ] CICC liaison has reviewed at least one generated form and confirmed it matches

---

## Next Step

Go to `docs/phases/PHASE-5-TESTING.md`
