# AIMRS — Where Things Actually Stand

A fast-read gap check. Order of work so far: frontend UI/UX redesign → security hardening → backend role/data wiring (current). This is what's still missing before the system actually *works* end to end, not just looks and logs in correctly.

## Solid

- **Login and roles are real.** All 7 roles (5 original + Property Custodian/Officer, added this round) authenticate against the real backend and database. No mock login path exists anymore.
- **The core requisition loop works at the API level.** Submit → approve → fulfill → asset issued is real, tested, and enforces who's allowed to touch what asset type — confirmed via automated tests hitting the API directly. The UI's own Approve/Reject buttons are a separate story — see below.
- **Some real pages, most still mock.** Employee's actions, and parts of Master Admin (Users/Roles/Audit) are genuinely wired end to end. The Approving Officer's queue *shows* real data but its action buttons aren't wired (see below). Everything else in the redesigned UI — most dashboards, IT Asset Custodian's and the two Property roles' own screens, most of Master Admin — is still fake data behind a real-looking UI.
- **Security basics are in place.** RBAC guards, audit logging, password hashing, CI checks.

## Missing — the business logic, not the plumbing

This is the real gap. The data model and CRUD exist; the *rules* CICC actually needs mostly don't:

- **Approving Officer's Approve/Reject buttons don't persist.** The approval queue shows real, live requisitions — but clicking Approve or Reject only updates your browser's local state, never the backend. The code's own toast message admits it: "completed in frontend mock mode." Refresh and it reverts. This is the most urgent item on this list — it's inside the core requisition loop, not a peripheral screen, and it looks completely real until you refresh. Checked the other "real" pages (Employee's actions, Master Admin's Users/Roles) for the same pattern — they're genuinely wired, this is isolated to this one screen's action buttons.
- **No reachable way to register a new asset that actually saves.** IT Asset Custodian's "Add Asset" form only writes to browser `localStorage`. Property Custodian's asset screens don't even do that — refresh and anything "added" is just gone. There is a page that genuinely writes to the database (`it-personnel/assets/new`, left over from before the redesign), but it isn't linked from anywhere in the current navigation, so nobody would find it without knowing the URL.
- **Notifications don't fire.** The alert types are defined (low stock, overdue return, pending approval, SLA breach, alternate approver), but nothing actually watches for these conditions and creates them. There's no scheduled job at all in the backend — one relevant function exists but nothing ever calls it.
- **No SLA enforcement.** The 24-hour approval target is documented and there's dead code that could check it, but nothing runs it.
- **Replacement requisitions aren't validated.** The system is supposed to check useful-life, condition, or loss/damage before approving a "replacement" request — it doesn't check anything right now.
- **Disposal is a status flag, not a workflow.** Flagging an asset "for disposal" just changes its status. There's no required justification, condition assessment, or recommended-action fields actually enforced.
- **No alternate approver support.** Documented as a requirement; doesn't exist in the data model or anywhere in the code.
- **No physical count / reconciliation.** The forms for it exist as templates, but there's no way to actually record a count and compare it against system records — the "report" is just today's live asset list.
- **2 of 8 management reports don't exist**: Asset Utilization Summary and Audit Trail Report (as an export — the live audit log itself works).
- **Generated COA forms don't match the official templates.** Checked 5 of the 18 against their actual reference files in `FORMS/` (the source templates the generators were supposedly built from). All 18 share one generic layout (header + meta fields + table + signature block) instead of reproducing each form's real field list. Some are close — RIS and PTR have the right number of signatories in roughly the right roles, just minor field/column differences. Others aren't: PAR and ICS add an "Approved by"/"Head of Division" signature block that doesn't exist on the real form, plus extra fields and reordered/added table columns. WMR is the worst — the real Appendix 65 has a whole second section, "Certificate of Inspection," with disposition-method checkboxes (destroyed / sold / transferred) and a witness signature, plus a "Record of Sales" table — none of that exists in the generated version at all. These are real government forms; an auditor comparing output to the official template would notice immediately. Not checked yet: the other 13 forms.
- **Everything else already known and deferred on purpose**: IT Asset Custodian's and the two Property roles' own screens, most of Master Admin, Reconciliation/Corrections screens — these are UI-redesign leftovers not yet connected, tracked separately.

## What's actually solid despite the gaps above

Forms/reports generation *mechanism* is in good shape — all 18 forms generate real PDFs from real data, correctly stored and re-downloadable, no crashes. Whether each form's actual *layout* matches its official COA template is a separate, weaker claim — see the forms-fidelity gap above. 6 of 8 management reports are fully wired.

## Suggested order of next work

0. **Fix the Approve/Reject buttons and the asset-registration dead end.** These aren't new features — they're the two spots where the UI looks fully real but silently isn't. Fix these before anything else, and before anyone demos or relies on this build.
1. **Notifications + SLA job** — one scheduled task unlocks two "not built" items at once, and it's the most visible gap in daily use (people expect alerts to just work).
2. **Replacement validation** — a real compliance/audit-readiness gap, not just a nice-to-have; worth closing before any real requisition volume goes through the replacement path.
3. **Disposal workflow** — turn the status flag into an actual documented flow with the required fields (matches your COA/audit obligations).
4. **Fix the COA form templates against their actual references** — go through each of the 18 generators in `Backend/src/reports/forms/` against its matching file in `FORMS/`, field by field, not just "does a PDF come out." WMR needs its missing Certificate of Inspection section entirely; PAR and ICS need their extra signatory removed and columns corrected. This is exactly the kind of thing that looks fine until CICC or COA actually compares it to the real form.
5. **Alternate approver** — smaller, but blocks a documented requirement outright.
6. **Wire the remaining "look real but aren't" pages** — the deferred UI screens from this round (IT Asset Custodian, Property roles' own pages, rest of Master Admin) — and while doing that pass, specifically re-check each one's action buttons the way we just did here, not just its data loading.
7. **Physical count / reconciliation + the 2 missing reports** — lower urgency, but needed before any real audit-readiness claim.

Everything above is backend-logic-plus-a-little-UI, not another redesign — the design work is done, this is about making the system actually do what it already claims to do.
