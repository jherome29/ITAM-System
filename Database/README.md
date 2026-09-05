# AIMRS — Database Directory

This directory contains all database-related files for the Asset Inventory Management and Requisition System.

## Structure

```
Database/
├── schemas/          # SQL schema files — applied in name order (001…007)
│   ├── 001_initial_schema.sql              # all tables, types, indexes
│   ├── 002_security_hardening.sql
│   ├── 003_property_roles.sql
│   ├── 004_supply_stock_and_notification_dedup.sql
│   ├── 005_replacement_validation.sql
│   ├── 006_system_config.sql
│   └── 007_alternate_approver.sql
├── migrations/       # Future schema changes (incremental, never modify existing)
├── seeds/            # Development seed data only — never run in production
│   └── 001_dev_seed.sql
└── supabase/         # Supabase-specific config (dev/test only)
```

## Rules

> **Dev:** Supabase (managed PostgreSQL) — use `DATABASE_URL` from Supabase dashboard.  
> **Production:** CICC-managed raw PostgreSQL. All code must work on raw PG.  
> **Do NOT** use any Supabase client SDK features in application code.

## Running the Schema

### Via Docker (recommended for dev)
```bash
docker compose up --build
# postgres:16 applies every schemas/*.sql (001…007) then the dev seed on
# first start (empty volume). `docker compose down -v` to reset.
```

### Manually against Supabase
```bash
# Paste contents of schemas/001_initial_schema.sql into Supabase SQL editor
# Or use psql:
psql $DATABASE_URL -f schemas/001_initial_schema.sql
```

## Migration Strategy

- **Never modify** existing migration files once committed
- For schema changes: create a new numbered file (e.g. `migrations/002_add_column.sql`)
- Each migration must be idempotent where possible (`IF NOT EXISTS`, `IF EXISTS`)

## Critical Constraints

| Rule | Detail |
|---|---|
| `audit_logs` is **append-only** | No UPDATE or DELETE on this table — COA compliance |
| No Supabase SDK in app code | Production runs raw PostgreSQL |
| Seed data is dev-only | Never run `001_dev_seed.sql` in production (mounted only by `docker-compose.yml`, never `docker-compose.prod.yml`) |
| bcrypt hashes in seeds | `001_dev_seed.sql` now carries a real bcrypt(12) hash of the dev password `ChangeMe@1234!` for `admin@cicc.gov.ph` and `it.personnel@cicc.gov.ph` — dev only |
