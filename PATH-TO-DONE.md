# AIMRS — Path to Done

Everything between **feature-complete** and **CICC handover**, in rough order.
`FEATURE-STATUS.md` = what the system does today; this file = what's left to ship.
Each line links the doc that has the detail.

Legend: `[ ]` not started · `[~]` partly done · `[x]` done.

---

## A. Finish the build  → `FEATURE-STATUS.md` (🔴 + ⬜)

- [~] Wire the 3 mock screens whose backend exists — Approving Officer `approval-history`,
      Property Officer `disposal` + `audit` (`isLiveFetchPage` one-liners). `MOCK-DATA-WIRING.md` task E.
- [ ] Delete the dead mock code (5 `mock-*.service.ts`, `laptops.mock.ts`, etc.). `MOCK-DATA-WIRING.md` Part A.
- [ ] **Disposal workflow** — documented flow + COA-required fields. `SYSTEM-STATUS.md` #4.
- [ ] **Physical count / reconciliation** — unblocks RPCI / RPCPPE / Physical Count Summary. `SYSTEM-STATUS.md` #8.
- [ ] **Master Admin governance backend** — access reviews, org units, approval routes, custodian
      coverage, system events, scheduled jobs, reference data (decompose into sub-projects). `SYSTEM-STATUS.md` #7.
- [ ] **Trends / utilisation endpoint** — for the Management dashboard chart panels. `MOCK-DATA-WIRING.md` Part D #7.
- [ ] Small wiring leftovers — employee "assigned assets" filter, Returns/Incidents module. `MOCK-DATA-WIRING.md` Part B.

## B. COA form correctness  → `docs/guides/COA-FORMS-AUDIT.md`

- [ ] Fix the Move-In / Move-Out hardcoded Property-Type bug (misrepresents real data).
- [ ] Rebuild the missing sections in WMR and IIRUP.
- [ ] Fix the RSMI zeroed-cost bug.
- [ ] Systematic field / signatory correction pass across all 18 forms vs their reference files.

## C. Phase 5 — Testing & Evaluation  → `docs/phases/PHASE-5-TESTING.md`

- [ ] **JMeter load test** — 362 concurrent users: login, requisition submit, dashboard, QR scan,
      approval, report access. Identify + fix bottlenecks.
- [ ] **OWASP ZAP / ASVS** security scan against the running system; triage findings.
- [ ] **Formal Jest security suite** — privilege-escalation (Employee → disposal flag → 403),
      unauthenticated API access → 403, audit-log immutability (no PUT/DELETE). `docs/guides/SECURITY.md`.
- [ ] Frontend test coverage — there's no coverage gate on `Frontend/` yet (backend has 70%).
- [ ] **UAT with CICC** — structured instrument for Employees / Supervisors / IT Personnel;
      measure requisition time, inventory accuracy, access-control enforcement, audit completeness,
      satisfaction vs the manual process.

## D. Production readiness  → CLAUDE.md §2, §13, §15  (blocked on CICC server access)

- [ ] Real PostgreSQL (CICC-managed), not Supabase — verify all code runs against raw PG.
- [ ] Real TLS certs from CICC IT — **remove the `rejectUnauthorized: false` workaround** in `app.module.ts`.
- [ ] `prod-server` GitHub Environment + manual approval gate; `docker-compose.prod.yml` shakeout.
- [ ] Environment config (`.env`) for prod — JWT secret, DB URL, etc., via secrets not files.
- [ ] Backup / restore procedure + a tested restore.
- [ ] Run the full migration set (`Database/schemas/001..007`) against the prod DB, in order.

## E. Data onboarding  (not tracked elsewhere)

- [ ] Import ~362 personnel — employee ID, name, email, division, office/section, role.
- [ ] Import ~2,000 assets with all required fields (CLAUDE.md §5.3), accountable-officer mapping.
- [ ] Set initial custodian assignments and per-section supervisors (needed for approval routing
      *and* the alternate-approver designation).
- [ ] Seed system-config values if CICC's SLA / thresholds differ from the defaults.

## F. Compliance & handover  → CLAUDE.md §8, §14

- [ ] Data-minimisation / privacy review vs RA 10173 + NPC Circular 2023-06; Privacy Impact
      Assessment; confirm no HR/payroll/leave data anywhere.
- [ ] Security testing report (ASVS checklist results) for the capstone paper.
- [ ] User manuals per role; System Administrator runbook (reset-password, unlock, config,
      migrations, backup).
- [ ] Final documentation + CICC acceptance sign-off (timeline: Sep 16 – Oct 5, 2026).

---

**Suggested order:** A (finish build) → B (forms) interleaved → C (Phase 5) → D + E (once CICC
gives server + data access) → F (handover). C's UAT and D/E can't fully start until the build is
functionally complete.
