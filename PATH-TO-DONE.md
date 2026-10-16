# AIMRS — Path to Done

Everything between **feature-complete** and **CICC handover**, in rough order.
`FEATURE-STATUS.md` = what the system does today; this file = what's left to ship.
Each line links the doc that has the detail.

Legend: `[ ]` not started · `[~]` partly done · `[x]` done.

> **As of 2026-10-16.** The build is functionally complete for all six roles on real
> data. What remains is: `develop` → `main`, the rest of the COA form fidelity, a handful
> of product decisions, Phase 5 testing, and the production / handover work that is
> blocked on CICC. Health on the Property-Officer-merge branch: backend 800 unit + 94 e2e
> tests, frontend 456 tests, every `CHECKS.md` item clean.

---

## G. Merge the PR stack  → `SYSTEM-STATUS.md` "Where things stand"

#105, #106, #107 and #109 are merged into `develop` (2026-10-16). `main` is still behind `develop`: promoting it is the last step of this section.

- [x] PR #102 / #103 (returns & incidents, repairs, replacement flow) — **merged to `develop`**.
- [x] #105 `fix/audit-findings-2026-10-14` — access control, audit integrity, numbering, KPIs.
- [x] #106 `feat/pilot-demo-data` — removes every mock screen (contains #105).
- [x] #107 `feat/demo-data-seed` — repeatable pilot demo data through the real API.
- [x] #108 / #109 — the 12 audit defects, forms redesign, property roles file requisitions, PDF
      layout fixes. **#108 was merged into the already-merged `feat/pilot-demo-data` branch by
      mistake** (its base was not retargeted after #106 merged), so none of it reached `develop`;
      #109 re-delivered the same branch into `develop`. When a PR is stacked, check its base is
      `develop` before merging.
- [x] Merge the Property Officer role into the Property Custodian (schema `017`; the role stays
      in the Postgres enum). Schema `017` is applied to the shared Supabase dev database
      (2026-10-16); any other database needs it before it runs this backend, or a leftover
      Property Officer account is refused everywhere.
- [ ] SonarCloud's quality gate fails on the merged work ("C Reliability Rating on New Code"); the
      issue itself is not identified yet (SonarCloud's API blocks non-main branches: open the
      dashboard and read it).
- [ ] Then `develop` → `main` (2 reviews + all checks, including `secret-scan`, `codeql`,
      `dependency-audit`, `owasp-dc`).
- [ ] Promote CI's `docker-build` job to a required check on `main` once it has stayed green.

## A. Finish the build  → `FEATURE-STATUS.md` (🟡 + ⬜)

- [x] ~~Wire the mock screens, delete the dead mock code~~ — **done (PR #106).** The frontend
      has no sample data; `MOCK-DATA-WIRING.md` is now just the record.
- [x] ~~Disposal workflow~~ — documented flow (justification, condition, recommended action);
      the Disposal Review list; restore-from-flagged with a justification. Documentation
      only; the disposal itself is a manual COA process.
- [x] ~~Master Admin governance~~ — cut as out of scope (2026-09-09); admin hardening done.
- [x] ~~Returns & Incidents, Maintenance & Repair, replacement follow-ups~~ — PR #102 / #103.
- [x] ~~Property Custodian files requisitions; custodians never fulfil their own; System
      Administrator fallback~~ — PR #108, proven on Postgres for both custodian roles.
- [~] **Physical count / reconciliation** — the count sheet exists (read-only). Still to build:
      *recording* a count, comparing it with the records, and inventory corrections.
      Needed before any real RPCI / RPCPPE reconciliation or audit-readiness claim.
- [ ] **Trends / utilisation endpoint** and the **Asset Utilization Summary** report — for the
      Management chart panels and the one management report that does not exist.
- [ ] **Asset Issuance Record / Asset Return Record** should be built from issuance and return
      *events*, not the asset's current status.
- [ ] Await the audit calls for failed login / lockout / refresh-token reuse / logout in
      `auth.service.ts` (currently `void this.auditService.log(...)`).
- [ ] Period reports: treat an end date as the whole day (an item created later on the end date
      is currently left out). `getDateRange` in `reports.service.ts`.
- [ ] Decide the open product questions (Annex A.4 lists every SEP asset, not only issued ones;
      asset history by person instead of role; PAR / ICS / RLSDDP Office/Section). `SYSTEM-STATUS.md`.

## B. COA form correctness  → `docs/guides/COA-FORMS-AUDIT.md`

- [x] ~~RSMI zeroed-cost bug~~ — supplies are priced from the stock they were issued from.
- [x] ~~RPCI printed guesses~~ — shows the quantity on record, leaves the physical count blank.
- [x] ~~Made-up form numbers~~ — real running numbers allocated atomically with the form
      (schema 016); entity name and Fund Cluster are System Settings.
- [x] ~~Layout~~ — tables paginate and fit the page, the form number no longer overprints its
      label, headers do not break mid-word (all 18 PDFs rendered and read, 2026-10-16).
- [x] ~~RLSDDP Accountable Officer~~ is the holder; ~~Annex A.4~~ prints the real ICS number.
- [ ] Fix the Move-In / Move-Out hardcoded "Property Type: Office" (misrepresents real data).
- [ ] Rebuild the missing sections: WMR's Certificate of Inspection; IIRUP's accounting columns
      and Witness.
- [ ] Remove the unofficial third signatory from PAR, ICS, IAR, both receipts, RLSDDP.
- [ ] Decide Sticker Card: rename it (it is an asset tag) or build Appendix 58's Stock Card.
- [ ] Compare each generated PDF with its reference in `FORMS/` (done for layout and content,
      not against the physical forms).
- [ ] Replace the placeholder number series with CICC's own (needs CICC's property office).

## C. Phase 5 — Testing & Evaluation  → `docs/phases/PHASE-5-TESTING.md`

> **Sequencing decision (2026-08-30):** everything here except the security Jest suite
> tests the *whole system surface*, so run it **once, at the end**, on prod-like infra. The
> build is now complete, so the end is near: start once #105–#108 are merged. The security
> suite is the exception: security tests accumulate, so it was built early as a CI gate.

- [x] **Formal Jest security suite** — all 8 Step-5.1 scenarios in
      `Backend/test/security.e2e-spec.ts`, gating CI. Per-module privilege-escalation cases are
      added as modules land (e.g. `property-requisitions.e2e-spec.ts`). `docs/guides/SECURITY.md`.
- [x] **Coverage ≥ 70% on backend services** — 96.3% statements / 88.6% branches (gate: 65 / 55 / 55 / 65).
- [ ] Frontend test coverage — no coverage gate on `Frontend/` yet (456 tests exist).
- [ ] **OWASP ZAP scan** — run ZAP against the running system, save the PDF, fix HIGH findings
      (`PHASE-5-TESTING.md` §5.3–5.4).
- [ ] **JMeter load test** — 362 users, 60 s ramp, the hot endpoints. Needs a **production build**,
      a **dedicated Postgres** (Supabase dev caps connections at 15) and **realistic data volume**
      (`Backend/test/demo-seed` in PR #107 and `perf/seed-volume.sql` help). The `.jmx` plan can be
      authored now.
  - [x] **k6 baseline done** (`perf/`) — 362 VUs on `GET /assets`, 0 errors, p95 758 ms on one
        contended box. De-risks the formal run; the ceiling is the single Node event loop, so scale
        with backend replicas if the formal test confirms it.
- [ ] **UAT with CICC** — structured instrument for Employees / Supervisors / IT Personnel;
      measure requisition time, inventory accuracy, access-control enforcement, audit completeness,
      satisfaction vs the manual process. The flows verified in the browser on 2026-10-15/16
      (file → approve → fulfil, returns, repairs, replacement, forms) are the script.
- [ ] Security testing report (ASVS checklist results) for the capstone paper.

## D. Production readiness  → CLAUDE.md §2, §13, §15  (blocked on CICC server access)

- [ ] Real PostgreSQL (CICC-managed), not Supabase — verify all code runs against raw PG.
- [x] The `rejectUnauthorized: false` code hack is gone — `DATABASE_SSL` (unset = verified TLS).
- [ ] Set `TRUST_PROXY=1` on the CICC server (behind their reverse proxy) so audit-log IPs are the
      real client; CICC IT's proxy must forward `X-Forwarded-For`.
- [ ] Docker: `docker compose -f docker-compose.prod.yml` against a real managed PG via
      `DATABASE_URL`, external TLS/reverse-proxy. Both images build in CI; the prod-compose
      shakeout is still open.
- [ ] `.github/workflows/deploy.yml` is a **placeholder** (it only echoes): write the real deploy,
      the `prod-server` GitHub Environment and the manual approval gate.
- [ ] Production `.env` via secrets, not files (JWT secrets ≥ 32 chars, DB URL, `ALLOWED_ORIGIN`,
      `TRUST_PROXY`; the process runs on Asia/Manila time unless `TZ` is set).
- [ ] Backup / restore procedure + a tested restore.
- [ ] Run the full schema set `Database/schemas/001…017` against the prod DB, in order. **Run
      `003`, `006`, `007`, `008`, `010` and `013` with plain `psql -f` (no `--single-transaction`):**
      they use `ALTER TYPE … ADD VALUE`, which cannot run inside a transaction. All are safe to re-run.
- [x] Shared dev Supabase is at `016` (008–014 applied 2026-10-11, 015 on 2026-10-14, 016 on
      2026-10-15). Any teammate's older local Docker Postgres still needs the missing files.
- [ ] The pilot must **not** use the shared Supabase dev database: 15-connection cap, and it holds
      test rows (`[VERIFY-2026-10-14]`) and demo rows (`DEMO-`).

## E. Data onboarding  (not tracked elsewhere)

- [ ] Import ~362 personnel — employee ID, name, email, division, office/section, role.
- [ ] Import ~2,000 assets with all required fields (CLAUDE.md §5.3), accountable-officer mapping.
- [ ] Set initial custodian assignments and **at least one active Approving Officer per
      section or division** (needed for routing: a division with none cannot submit), each with
      an alternate approver.
- [ ] Seed system-config values if CICC's SLA / thresholds / entity name / Fund Cluster differ from
      the defaults.

## F. Compliance & handover  → CLAUDE.md §8, §14

- [ ] **Rotate every dev password** listed in `docs/guides/ROLES.md`, `TEAM-HANDOFF.md`,
      `RUN-LOCAL.md` and the `CHECKS.md` smoke tests, and keep real credentials out of the
      public repo. No default or shared credentials in production (CLAUDE.md §8.1).
- [ ] Data-minimisation / privacy review vs RA 10173 + NPC Circular 2023-06; Privacy Impact
      Assessment; confirm no HR/payroll/leave data anywhere.
- [ ] User manuals per role; System Administrator runbook (reset-password, unlock, config,
      migrations, backup).
- [ ] Final documentation + CICC acceptance sign-off.

---

**Suggested order:** G (merge the stack) → A / B (the open items, interleaved) → C (Phase 5) →
D + E once CICC gives server and data access → F (handover). C's UAT and D / E cannot fully start
until the stack is merged.
