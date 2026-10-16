# Pilot demo data

Fills a fresh AIMRS with believable, **clearly fictional** sample data so every
role has something to look at or act on during the employee pilot — requisitions
to approve, items to fulfil, returns and repairs to process, a lost laptop for
the Property Officer to review, low-stock and overdue-loan alerts.

It does this by **replaying a scenario through the real API as the real roles**
(`scenario.ts`), not by writing SQL. So numbering (`REQ-…`, `AR-…`), the audit
trail, notifications and the generated COA forms all behave exactly as they do
in use, and every business rule is enforced — if a rule changes, the seed fails
loudly instead of inserting rows the app would never have allowed.

## What it creates

| | |
|---|---|
| Assets | 26 — 13 ICT, 9 Fixed, 4 Supplies. Each starts `available`; 11 are then issued to the demo employee |
| Requisitions | 13 — 3 awaiting the supervisor, 5 approved and waiting on a custodian (3 new/supply + 2 replacements), 2 fulfilled, 2 rejected, 1 on hold |
| Return / repair / incident requests | 8 — submitted, approved, completed (a return, a loss, a theft, a damage written off) and rejected |
| Alerts | the notification watchers run once at the end: low stock (ballpoint pens), overdue loan (projector) |

Run `npm run seed:demo` (no flags) for the exact plan and a per-role summary.

### Second round: every page filled (`--scenario pages`)

The first round fills the requisition and incident queues, but leaves pages bare:
Maintenance & Repair, My Assigned Assets for anyone but the demo employee, My
Requisitions for the Approving Officer and IT, the Master Admin's escalation
queues, transferred and disposed assets. `scenario-pages.ts` goes on top of the
first round and fills those, with the same rules: it replays the flows through
the API as the real roles.

| | |
|---|---|
| Assets | 33 — 20 ICT, 13 Fixed (`DEMO-P-…`), spread over 8 offices for the physical count |
| Held by | every role: the Approving Officer, IT, Property Custodian, Property Officer, Management and the Master Admin each hold items; the demo employee holds 12 |
| Maintenance & Repair | 5 ICT + 1 Fixed repairs open — in-house, external, one **overdue** with a loaner lent out — and a history of 5 repaired and 1 written off, plus one item repaired three times (the "repeated repairs" replacement reason) |
| My Requisitions | the Approving Officer files 2 and IT files 1 of their own |
| Replacement Validation | one completed replacement per custodian domain (the old unit is taken back and its receipt generated) |
| Master Admin escalations | return and repair requests on a custodian's *own* item, which only the System Administrator can decide: one waiting, three decided |
| Custody / dashboards | 1 transferred and 2 disposed assets |

```bash
npm run seed:demo -- --scenario pages                 # dry run: the plan, sends nothing
npm run seed:demo -- --scenario pages --apply         # writes it
```

Run the first round first. Two things differ from it:

* **It modifies one account.** The Approving Officer's own requisitions need a
  backup approver, so the Master Admin sets one (`alternateApproverId`). It uses
  the only other active supervisor, or the one you name with
  `--backup-approver <employee ID>`; if there are several and you named none, it
  stops before writing. Unless someone signs in as that backup account, the
  Approving Officer's own requisitions simply stay pending, which is what My
  Requisitions should show.
* **The Property Officer and Management only hold assets.** Their accounts are
  looked up in the directory (there must be exactly one active account of each
  role, or it stops before writing). Everything is resolved before the first write.

### Everything is tagged

* Assets carry a `DEMO-` property number and serial number (`DEMO-ICT-0001`, …;
  the pages round uses `DEMO-P-…`).
* Every requisition justification, request description and repair problem starts
  with `[DEMO]`.
* Neither round creates users. The pages round changes one thing on an existing
  account: the backup approver above.

`validateScenario()` / `validatePages()` refuse to run a scenario that has lost
these markers, and `scenario.spec.ts` / `scenario-pages.spec.ts` check the
payloads against the real DTO classes (the pages round also runs every step
against a model of each asset's lifecycle), so a rule change that would break the
seed fails in `npm test`, not mid-run.

## Running it

1. **Credentials.** Copy `accounts.example.json` to `accounts.local.json` (it is
   gitignored) and fill in a real login and password for each of the five roles
   the seed acts as: employee, supervisor, IT personnel, property custodian,
   system admin. Passwords are never committed and never printed.
   Or point `DEMO_SEED_ACCOUNTS` / `--accounts <file>` at a file elsewhere.
2. **Backend running** and reachable (default `http://localhost:3001/api`;
   override with `DEMO_SEED_API_URL` or `--api <url>`).
3. ```bash
   cd Backend
   npm run seed:demo                  # dry run: prints the plan, sends nothing
   npm run seed:demo -- --apply       # writes it (a few minutes — it is paced)
   ```

The employee, supervisor, etc. it logs in as must already exist with the
expected sections (the demo employee and supervisor share a section so the
requisitions route to that supervisor). No user is created.

### Safety rules built in

* **Dry run by default.** Nothing is sent without `--apply`.
* **Local only unless you say otherwise.** A non-local `--api` host is refused
  without `--allow-remote`. Use that flag deliberately for the pilot server.
* **Won't stack on itself.** If any `DEMO-` asset is already visible, it stops
  before writing anything (the pages round checks for `DEMO-P-`). That also means
  the first round will not run once the pages round is in, so run them in order.
* **A typo in `--scenario` stops the run** instead of falling back to the first round.
* **Stops at the first failure** rather than piling more writes on a broken step.
* **Paced** to ~54 requests/minute to stay under the API's 60/min rate limit.

### Side effects to know about

* **Logging in signs out that account's other sessions** (the app allows one
  session per account). Seed when nobody is using the five accounts.
* The audit trail is append-only by design, so every seeded action is recorded
  there permanently, attributed to the account that performed it.

## If a run stops part-way

The error names the step that failed and how many succeeded; rows already
written stay. There is no automatic resume — the usual cause is a rule or
credential problem, so fix that first. Then either:

* **Fresh database (the pilot):** reset it and run again from scratch.
* **Shared dev database:** the registered assets can't be re-registered
  (duplicate property numbers are refused), and the seed won't run while any
  `DEMO-` asset exists. Clean the partial rows with SQL keyed on the markers
  above, with a snapshot first — and note the audit rows for them remain.

## Removing demo data

The API has no delete for assets or requests (and the audit log is immutable),
so removal is a SQL job keyed on the `DEMO-` / `[DEMO]` markers (and the backup
approver the pages round set, if you want that undone too). For the pilot,
the clean answer is to seed a **fresh pilot database** and discard it afterwards,
rather than seeding a database that also holds real records.
