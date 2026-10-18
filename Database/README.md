# AIMRS — Database Directory

This directory contains all database-related files for the Asset Inventory Management and Requisition System.

> Last reviewed 2026-10-16. Schemas **001–017**. If you add a file, update this table, the init list in `docker-compose.yml`, and `PATH-TO-DONE.md` §D.

## Structure

```
Database/
├── schemas/          # SQL schema files — applied in name order (001…017)
└── seeds/            # Development seed data only — never run in production
    └── 001_dev_seed.sql
```

`Database/migrations/` is reserved for post-launch incremental changes and does not exist yet: until the first production deploy every change is a new numbered file in `schemas/`.

### Applying them

`node Backend/scripts/db-migrate.mjs` (with `DATABASE_URL`, and `DATABASE_SSL` as for the app) applies every file not yet recorded in the
`schema_migrations` table, in order. Hosted environments run it as the pre-deploy command, so merging a new numbered file is enough. Never edit a
file once it has been applied anywhere: add the next number. A database built by hand before the runner existed is recorded once with
`MIGRATE_BASELINE=<last applied number>` (for example `017`).

### The schema files

| File | What it adds |
|---|---|
| `001_initial_schema.sql` | all original tables, types, indexes |
| `002_security_hardening.sql` | audit-log immutability (blocks UPDATE / DELETE) and the refresh-token columns |
| `003_property_roles.sql` | `property_custodian` / `property_officer` roles ¹ |
| `004_supply_stock_and_notification_dedup.sql` | supply quantity + reorder level, notification dedup stamps |
| `005_replacement_validation.sql` | `replaced_asset_id` on requisitions |
| `006_system_config.sql` | `system_config` key-value table ¹ |
| `007_alternate_approver.sql` | alternate approver, availability, `requisition_reassigned` ¹ |
| `008_schema_drift_sync.sql` | brings the schema back in line with the entities (requisition workflow, form re-download) ¹ |
| `009_requisition_item_in_inventory.sql` | "In inventory" flag on requisition lines |
| `010_asset_requests.sql` | Returns & Incidents requests + attachments ¹ |
| `011_asset_request_attachment_stage.sql` | request vs receipt attachments, uploader |
| `012_generated_form_asset_request.sql` | links a generated COA form to its request |
| `013_asset_repairs.sql` | one repair record per stay under repair ¹ |
| `014_repair_loaner.sql` | loaner unit on a repair |
| `015_function_search_path.sql` | pins the `search_path` of the two trigger functions (Supabase security advisor) |
| `016_document_numbers.sql` | `document_counters` and `generated_forms.document_number` (running form numbers) |
| `017_retire_property_officer.sql` | turns accounts that hold the retired Property Officer role into Property Custodians and invalidates their sessions. **The enum value stays** (Postgres cannot drop it; old audit rows carry it). Plain `UPDATE`: idempotent, safe in a transaction |

¹ Uses `ALTER TYPE … ADD VALUE`, which cannot run inside a transaction: apply these with plain `psql -f` (no `--single-transaction`), or statement by statement in the Supabase SQL editor. Every file is idempotent and safe to re-run.

## Rules

> **Dev:** Supabase (managed PostgreSQL) — use `DATABASE_URL` from Supabase dashboard.
> **Production:** CICC-managed raw PostgreSQL. All code must work on raw PG.
> **Do NOT** use any Supabase client SDK features in application code.

## Running the Schema

### Via Docker (recommended for dev)
```bash
docker compose up --build
# postgres:16 applies every schemas/*.sql (001…017, listed in docker-compose.yml) then the
# dev seed on first start (empty volume). `docker compose down -v` to reset.
```
The files only run on the **first** boot of an empty volume. For a database that already exists, apply the new file yourself (`RUN-LOCAL.md` §5).

### Manually against Supabase
```bash
# Paste the file into the Supabase SQL editor, or:
psql $DATABASE_URL -f schemas/016_document_numbers.sql
```
**Status of the shared dev Supabase database:** at `017` (008–014 applied 2026-10-11, 015 on 2026-10-14, 016 on 2026-10-15, 017 on 2026-10-16). 017 moved the one Property Officer account (`property.officer@cicc.gov.ph` until it was renamed `property.custodian2@cicc.gov.ph` the same day) to Property Custodian and left the 23 old audit rows that say `property_officer` untouched; it is recorded as `017_retire_property_officer`. Any other database needs it before a backend that includes the role merge runs against it, or a leftover Property Officer account is refused everywhere. No production database exists yet: when CICC provides one, apply `001…017` in order.

### The e2e suite does not use these files
`NODE_ENV=test` builds the schema from the TypeORM entities (`synchronize: true`) on a throwaway Postgres, so a missing or wrong schema file does **not** fail CI. A table that is written only with raw SQL (like `document_counters`) still needs an entity declaring it.

## Migration Strategy

- **Never modify** a schema file once it has been applied anywhere: add a new numbered one
- Each file must be idempotent where possible (`IF NOT EXISTS`, `IF EXISTS`, `ADD VALUE IF NOT EXISTS`)
- `synchronize: false` in TypeORM (CLAUDE.md §11 #11): an entity change that touches a column, table or enum value needs its schema file in the same commit, and a new `audit_action` value is an enum change too
- Add the file to the init list in `docker-compose.yml` (CLAUDE.md §11 #20)

## Critical Constraints

| Rule | Detail |
|---|---|
| `audit_logs` is **append-only** | No UPDATE or DELETE on this table — COA compliance |
| No Supabase SDK in app code | Production runs raw PostgreSQL |
| Seed data is dev-only | Never run `001_dev_seed.sql` in production (mounted only by `docker-compose.yml`, never `docker-compose.prod.yml`) |
| bcrypt hashes in seeds | `001_dev_seed.sql` carries a real bcrypt(12) hash of the dev password `ChangeMe@1234!` for `admin@cicc.gov.ph` and `it.personnel@cicc.gov.ph` — dev only |
| The shared Supabase DB allows 15 connections | Run the backend with `DB_POOL_MAX=8` against it; do not run a pilot on it |
