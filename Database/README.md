# AIMRS — Database Directory

This directory contains all database-related files for the Asset Inventory Management and Requisition System.

## Structure

```
Database/
├── schemas/          # SQL schema files — run in order
│   └── 001_initial_schema.sql   # Full initial schema (all tables, types, indexes)
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
docker-compose up --build
# PostgreSQL auto-runs schemas/001_initial_schema.sql on first start
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
| Seed data is dev-only | Never run `001_dev_seed.sql` in production |
| bcrypt hashes in seeds | Replace placeholder hashes before any use |
