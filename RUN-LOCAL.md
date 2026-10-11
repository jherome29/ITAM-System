# AIMRS — Local Development Runbook

How to get the stack running on this machine. Written 2026-09-30 against
Windows 11 / PowerShell, Node v25.2.1, npm 11.6.2, Docker Desktop 29.4.3.

First-time setup is already done on this machine — if you just want to start
working, read **§1 and stop**. The rest is for a fresh clone, a teammate's
machine, or when something breaks.

---

## 1. Daily start (the whole thing)

Three steps, in order.

```powershell
# 1. Docker Desktop must be running first — the DB lives in a container.
#    Launch it from the Start menu, or:
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 2. Start Postgres (data persists between runs — this is not a reset)
cd "D:\Documents(D)\CAPSTONE"
docker compose --env-file .env.docker up -d postgres

# 3. Start backend + frontend together
npm run dev
```

Leave that last terminal open — it runs both servers with hot reload. `Ctrl+C`
stops both.

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| Backend API | http://localhost:3001/api |
| Health check | http://localhost:3001/api/health |
| Postgres | `localhost:5432` — db `aimrs_dev`, user `aimrs_user` |

Wait for **both** lines before opening the browser:

```
[0] ✓ Ready in 868ms                                   <- frontend
[1] [Nest] LOG [NestApplication] Nest application successfully started
```

`[0]` is the frontend, `[1]` is the backend — `concurrently` prefixes them.

### Confirm it is actually up

```powershell
Invoke-RestMethod "http://localhost:3001/api/health"
```

Expect `status = ok` and `db = True`. If `db` is `False`, Postgres is not
reachable — go to §5.

---

## 2. Login credentials

Open http://localhost:3000/login. Credentials match `users.md` (reset to those
values on 2026-10-07 via the admin API):

| Role | Email | Password | Lands on |
|---|---|---|---|
| System Administrator | `admin@cicc.gov.ph` | `Admin@CICC2026!` | `/master-admin/dashboard` |
| IT Personnel | `itpersonnel@cicc.gov.ph` | `CiccIT@2026!Sec` | `/it-asset-custodian/dashboard` |
| Employee | `employee@cicc.gov.ph` | `Employee@CICC2026!` | `/employee/dashboard` |
| Supervisor | `supervisor@cicc.gov.ph` | `Supervisor@CICC2026!` | `/approving-officer/dashboard` |
| Supervisor (IT Division — approves IT Personnel's requests) | `it.supervisor@cicc.gov.ph` | `ItSupervisor@CICC2026!` | `/approving-officer/dashboard` |
| Management | `management@cicc.gov.ph` | `Management@CICC2026!` | `/management-audit/dashboard` |
| Property Custodian | `property.custodian@cicc.gov.ph` | `PropertyCustodian@2026!` | `/property-custodian/dashboard` |
| Property Officer | `property.officer@cicc.gov.ph` | `PropertyOfficer@2026!` | `/property-officer/dashboard` |

> After a DB reset (§6) the seed recreates only `admin@` and `it.personnel@`
> (note the dot), both with `ChangeMe@1234!`.

To switch roles, use **Sign out** in the sidebar. Just navigating to
`/login` will bounce you back to your current dashboard — the session is held
in an httpOnly refresh cookie, so it survives a page reload.

---

## 3. What is already in the database

Seeded on 2026-09-30 so the dashboards are not empty:

- **9 assets** — 5 ICT (IT Personnel's scope), 4 Fixed/Supplies (Property roles' scope)
- Statuses in play: 3 available, 1 issued (HP EliteBook → `CICC-EMP-001`), 1 under repair
- **1 requisition** `REQ-2026-0001`, walked all the way through
  submit → supervisor approve → IT fulfil
- A handful of generated COA forms (PAR, ICS, Sticker Card, IIRUP, Annex A.4)

This data lives in the Docker volume `capstone_postgres_data` and survives
restarts. It is only lost if you deliberately reset (§6).

### Roles see different assets — this is intended

`resolveAssetTypeScope()` (`Backend/src/common/utils/asset-type-scope.util.ts`)
restricts asset queries by role:

| Role | Can see / register |
|---|---|
| IT Personnel | `ICT` only |
| Property Custodian, Property Officer | `Fixed` + `Supplies` only |
| Admin, Management, Employee, Supervisor | no asset-type restriction |

So IT Personnel showing "Total assets 5" while 9 exist is correct, not a bug.
Registering a `Fixed` asset as IT Personnel returns **403** by design.

### Parts of the employee dashboard are mock data

Tiles badged **"PREVIEW DATA"** (assigned assets, acknowledgements, my property)
are not wired to the API yet — see `MOCK-DATA-WIRING.md`. Requisitions and the
asset registry are real.

---

## 4. Stopping

```powershell
# Servers: Ctrl+C in the `npm run dev` terminal.

# If Ctrl+C left something behind (it sometimes does on Windows),
# kill every node process belonging to this project:
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'CAPSTONE' -and $_.CommandLine -notmatch 'vscode' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Database (optional — fine to leave running; data is kept either way)
docker compose stop postgres
```

---

## 5. Troubleshooting

### `npm install` fails on `bcrypt` with `'"node"' is not recognized`

**Run it from PowerShell, not Git Bash.** Under Bash, npm hands a POSIX-style
`PATH` (`/c/Program Files/nodejs`) to the `cmd.exe` it spawns for native builds,
and `cmd.exe` cannot resolve `node` from it. PowerShell passes a Windows `PATH`
and the build succeeds. Same applies to any npm script that compiles native
code.

### Port 3000 already in use — frontend starts on 3002

A previous `next dev` did not die. The app half-works on 3002 but the backend's
`ALLOWED_ORIGIN` and the post-login redirect both assume 3000, so fix it rather
than using 3002:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <that PID> -Force
```

Then start again. The kill-everything snippet in §4 also clears this.

### `db: false` from the health endpoint, or the backend cannot connect

```powershell
docker ps --filter "name=aimrs_postgres"          # is it running?
docker logs aimrs_postgres --tail 30              # why did it stop?
docker compose --env-file .env.docker up -d postgres
```

Docker Desktop itself may not be up — `docker info` errors with
`failed to connect to the docker API at npipe:...` when the daemon is down.

### Login returns 400 `property email should not exist`

The login field is **`emailOrEmployeeId`**, not `email`. Only matters if you are
calling the API by hand:

```powershell
$b = @{ emailOrEmployeeId='admin@cicc.gov.ph'; password='ChangeMe@1234!' } | ConvertTo-Json
Invoke-RestMethod "http://localhost:3001/api/v1/auth/login" -Method Post -Body $b -ContentType "application/json"
```

### Suddenly logged out / 401 everywhere

Every successful login increments that user's `tokenVersion`, which invalidates
all of that user's earlier tokens (CLAUDE.md §11#14). Logging the same account
in from a script while it is open in the browser will kick the browser session.
Just log in again in the browser — and use one login per account per script run.

### Clicking "Sign In" reloads the page and clears the form

Next.js had not finished hydrating, so the browser did a native form submit.
Only happens on the very first compile of the login route after a cold start.
Wait a couple of seconds and click again.

### Changed an entity — schema errors like `invalid input value for enum ...`

`synchronize: false` (CLAUDE.md §11#11). TypeORM will **not** create columns or
enum values for you. Every entity change needs a SQL file in
`Database/schemas/`, and you must apply it yourself:

```powershell
docker cp "D:\Documents(D)\CAPSTONE\Database\schemas\00X_your_file.sql" aimrs_postgres:/tmp/m.sql
docker exec aimrs_postgres psql -v ON_ERROR_STOP=1 -U aimrs_user -d aimrs_dev -f /tmp/m.sql
```

Then add it to the `postgres.volumes` list in `docker-compose.yml` so fresh
bootstraps pick it up. **The files in `Database/schemas/` only run on the
FIRST boot of an empty volume** — adding one to the compose file does nothing
to a database that already exists.

Watch out: this drift does not fail CI. `docker-compose.e2e.yml` runs with
`NODE_ENV=test` and `synchronize: true`, so the e2e database is built from the
entities and never touches these SQL files.

---

## 6. Resetting the database

Destroys all local data and rebuilds from `Database/schemas/*.sql` +
`Database/seeds/001_dev_seed.sql`.

```powershell
cd "D:\Documents(D)\CAPSTONE"
docker compose down -v                                   # -v drops the volume
docker compose --env-file .env.docker up -d postgres
```

The plain seed only creates **two** users — `admin@cicc.gov.ph` and
`it.personnel@cicc.gov.ph` (both `ChangeMe@1234!`). The other five roles and all
the sample assets were created afterwards through the API, so after a reset you
get a working login but empty dashboards.

---

## 7. Environment files

All three are gitignored — **never commit them**. They exist on this machine
already; recreate from the templates only on a fresh clone.

| File | From template | Holds |
|---|---|---|
| `Backend/.env` | `Backend/.env.example` | `DATABASE_URL`, `DATABASE_SSL=disable`, JWT secrets |
| `Frontend/.env.local` | — | `BACKEND_INTERNAL_URL=http://127.0.0.1:3001` |
| `.env.docker` | `.env.docker.example` | `POSTGRES_PASSWORD` for the container |

Two deliberate choices worth not undoing:

- **`DATABASE_SSL=disable`** — the local Postgres container speaks no TLS.
  Leave it unset for Supabase or production, which require verified SSL.
- **`NEXT_PUBLIC_API_URL` is intentionally unset.** The axios client then falls
  back to a same-origin `/api`, which `next.config.ts` rewrites to the backend.
  Same-origin keeps the httpOnly refresh cookie working with no CORS setup.
  Setting it to `http://localhost:3001/api` makes the browser call the backend
  cross-origin and the refresh flow gets fragile.

New secrets, if you ever need them:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 8. Quality checks before marking work done

Full ordered list with pass conditions is in `CHECKS.md`. All of these must be
clean — run from PowerShell:

```powershell
cd Backend;  npx tsc --noEmit
cd Backend;  npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0
cd Backend;  npm run build
cd Backend;  npm run test:cov        # 310 tests, coverage gate 65%
cd Backend;  npm run audit:check
cd Frontend; npx tsc --noEmit
cd Frontend; npx eslint . --max-warnings 0
cd Frontend; npm run build
cd Frontend; npm test                # 40 vitest tests
cd Frontend; npm run audit:check
cd ..;       npm run secretlint
```

`cd Frontend && npm run build` writes to the same `.next/` the dev server uses —
**stop `npm run dev` first**, or the running dev server gets confused.

Backend e2e (spins its own throwaway Postgres on port 5433, needs Docker):

```powershell
cd Backend; npm run test:e2e:local
```

Plain `npm run test:e2e` points at Supabase and will not connect — use the
`:local` variant.

---

## 9. Full setup from a fresh clone

Only needed on a new machine.

```powershell
git clone https://github.com/jherome29/ITAM-System.git cicc
cd cicc
npm install                                  # PowerShell, not Bash — see §5

Copy-Item Backend\.env.example Backend\.env  # then fill in real values
Copy-Item .env.docker.example .env.docker    # then fill in real values
# Frontend\.env.local:  BACKEND_INTERNAL_URL=http://127.0.0.1:3001

docker compose --env-file .env.docker up -d postgres   # schemas + seed run now
npm run dev
```

Then create the five non-seeded roles through the API as `admin@cicc.gov.ph`
(`POST /api/v1/users`), or work with just the two seeded accounts.

Alternatively `docker compose up --build` runs all three services in
containers — slower to iterate on, but closest to the deployed topology.
Build context is the repo root, not `Backend/`, because this is an
npm-workspaces monorepo (CLAUDE.md §11#18).

---

## 10. Handy one-liners

```powershell
# Open a psql shell
docker exec -it aimrs_postgres psql -U aimrs_user -d aimrs_dev

# Who exists?
docker exec aimrs_postgres psql -U aimrs_user -d aimrs_dev -c "SELECT employee_id, email, role, is_active FROM users ORDER BY role;"

# Row counts
docker exec aimrs_postgres psql -U aimrs_user -d aimrs_dev -c "SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM assets) assets, (SELECT count(*) FROM requisitions) reqs, (SELECT count(*) FROM audit_logs) audit;"

# Unlock an account locked by failed logins (as admin)
# PATCH /api/v1/users/:id/unlock

# Backend logs, if started detached rather than in a visible terminal
docker logs aimrs_backend --tail 50
```
