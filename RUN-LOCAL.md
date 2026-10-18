# AIMRS — Local Development Runbook

How to get the stack running on this machine. Written 2026-09-30 against
Windows 11 / PowerShell, Node v25.2.1, npm 11.6.2, Docker Desktop 29.4.3;
reviewed 2026-10-18 (Next.js 16.4, schemas 001–018, test counts, and §11, how to
verify a screen or a PDF on a throwaway database). Folder paths below are the
original machine's (`D:\Documents(D)\CAPSTONE`): use your own clone's path.

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

Open http://localhost:3000/login. These are the dev accounts in `docs/guides/ROLES.md`
(the canonical list; keep this table in sync with it). They exist in the shared
Supabase dev database; your own local Docker database only has the accounts you
created there:

| Role | Email | Password | Lands on |
|---|---|---|---|
| System Administrator | `admin@cicc.gov.ph` | `Admin@CICC2026!` | `/master-admin/dashboard` |
| IT Personnel | `itpersonnel@cicc.gov.ph` | `CiccIT@2026!Sec` | `/it-asset-custodian/dashboard` |
| Employee | `employee@cicc.gov.ph` | `Employee@CICC2026!` | `/employee/dashboard` |
| Supervisor | `supervisor@cicc.gov.ph` | `Supervisor@CICC2026!` | `/approving-officer/dashboard` |
| Supervisor (IT Division — approves IT Personnel's requests) | `it.supervisor@cicc.gov.ph` | `ItSupervisor@CICC2026!` | `/approving-officer/dashboard` |
| Management | `management@cicc.gov.ph` | `Management@CICC2026!` | `/management-audit/dashboard` |
| Property Custodian | `property.custodian@cicc.gov.ph` | `PropertyCustodian@2026!` | `/property-custodian/dashboard` |
| Property Custodian (second account; was the Property Officer, `property.officer@cicc.gov.ph` until 2026-10-16) | `property.custodian2@cicc.gov.ph` | `PropertyOfficer@2026!` | `/property-custodian/dashboard` |
| Supervisor (Property and Supply Management, approves the Property Custodian) | `psm.approver@cicc.gov.ph` | `PSMApprover@2026!` | `/approving-officer/dashboard` |

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
| Property Custodian | `Fixed` + `Supplies` only |
| Admin, Management, Employee, Supervisor | no asset-type restriction |

So IT Personnel showing "Total assets 5" while 9 exist is correct, not a bug.
Registering a `Fixed` asset as IT Personnel returns **403** by design.

### There is no mock data in the frontend

Every screen reads real records and every button saves through the API (PR #106),
so an empty dashboard means an empty database, not a mock. To fill a *throwaway*
database with realistic data, use the demo seeder (`npm run seed:demo`, PR #107)
or §11 below.

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

### A second `next dev` refuses to start ("existing server at :3000")

Next 16 allows **one dev server per project folder**. To run a second frontend
against another backend (§11), stop the first, run the second, then start the first
again. `Get-NetTCPConnection -LocalPort 3000 -State Listen` gives the PID; the
`next dev` parent process must be stopped too.

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
The login route is also limited to **10 attempts per minute per IP**, so a script that
logs in a dozen accounts gets `429 Too Many Requests`: wait and retry.

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
bootstraps pick it up (`Database/schemas/` currently runs 001 to 018). **The files in `Database/schemas/` only run on the
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
cd Backend;  npm run test:cov        # 976 tests (2026-10-18), coverage gate 65%
cd Backend;  npm run audit:check
cd Frontend; npx tsc --noEmit
cd Frontend; npx eslint . --max-warnings 0
cd Frontend; npm run build
cd Frontend; npm test                # 503 vitest tests (2026-10-18)
cd Frontend; npm run audit:check
cd ..;       npm run secretlint
```

`cd Frontend && npm run build` writes to the same `.next/` the dev server uses —
**stop `npm run dev` first**, or the running dev server gets confused.

Backend e2e (spins its own throwaway Postgres on port 5433, needs Docker; 94 tests
in 12 suites as of 2026-10-16):

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

---

## 11. Verifying a screen or a PDF on a throwaway database

Use this when a change touches what a user sees or what gets printed: unit tests
do not catch an overprinted form number, a table running off the page, or an audit
log full of truncated ids. **Never do this against the shared Supabase database.**

```powershell
# 1. A throwaway Postgres on :5433 (tmpfs, gone with `down -v`). This is the same
#    container the e2e suite uses, so run it when no e2e run is in progress.
docker compose -p aimrs-e2e -f docker-compose.e2e.yml up -d --wait

# 2. A sandbox backend on :3101, started FROM A FOLDER WITH NO .env and with an
#    explicit DATABASE_URL, so it can never read Backend\.env (the Supabase string).
#    NODE_ENV=test makes it build the schema from the entities.
cd Backend; npm run build
$env:NODE_ENV='test'; $env:PORT='3101'; $env:DATABASE_SSL='disable'
# DATABASE_URL: the container's connection string. User, password and database are all
# `aimrs_test`, host `localhost`, port `5433`, with `?sslmode=disable` (it is spelled out
# in Backend/test/e2e-local.mjs, built from parts so secretlint does not flag it).
$env:DATABASE_URL = '<postgresql URL for that container>'
$env:JWT_SECRET='<32+ random chars>'; $env:JWT_REFRESH_SECRET='<32+ random chars>'
$env:ALLOWED_ORIGIN='http://localhost:3100'; $env:THROTTLE_LIMIT='5000'
cd $env:TEMP; node "<repo>\Backend\dist\main.js"

# 3. A sandbox frontend on :3100 against it. Stop your :3000 dev server first (one
#    `next dev` per folder) and start it again afterwards.
$env:NEXT_PUBLIC_API_URL='http://localhost:3101/api'
cd <repo>\Frontend; npx next dev -p 3100
```

Seed it: insert users straight into the `users` table (one shared dev password,
bcrypt with 12 rounds, the roles you need, and a supervisor per division so routing
works) and create everything else through the API as those users: assets, lifecycle
moves, requisitions, requests. Log in as few accounts as possible, because a login
bumps `tokenVersion` and the route is limited to 10 per minute (retry on 429).

Drive it with Playwright. Things that bite: wait about two seconds after the login
page loads and *type* into the fields (`fill()` before hydration submits a blank
login); move between pages with `window.next.router.push(path)` instead of a full
reload; close a drawer before clicking Sign out.

**Looking at a screen without stopping your `:3000` dev server** (the quick way, used for the UI-consistency work). Start only the throwaway Postgres and a sandbox backend (steps 1 and 2) with `ALLOWED_ORIGIN=http://localhost:3000`, seed it, then let the browser's requests to `:3001` be answered by the sandbox instead. In Playwright:

```js
const cors = { 'access-control-allow-origin': 'http://localhost:3000', 'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
await context.route('http://localhost:3001/api/**', async (route) => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const resp = await route.fetch({ url: req.url().replace('localhost:3001', 'localhost:3101') });
  await route.fulfill({ response: resp, headers: { ...resp.headers(), ...cors } });
});
// log in to the SANDBOX over HTTP, then hand the page the token the way the app does after a login:
await context.addInitScript((t) => sessionStorage.setItem('aimrs_at', t), token);
await page.goto('http://localhost:3000/it-asset-custodian/dashboard');
```

Three traps cost an hour each:
- **Do not use `route.continue({ url })` to redirect.** Chromium drops the `Authorization` header when a request is rewritten to another origin (as on a cross-origin redirect), so every call is a 401 "Session expired". `route.fetch` + `route.fulfill`, as above, keeps it.
- **`addInitScript` outlives everything.** A script from an earlier login keeps re-writing its (now stale) token on every navigation, and `unrouteAll` does not remove it. Scripts run in registration order, so register a new one with the fresh token each time and the last one wins; to start clean, open a new browser context.
- **The `response` event reports the original URL** (`:3001`) even when the sandbox answered. To see which backend answered, compare `GET /api/health` `uptime` from the page with the two servers'. A page-level `page.route` from an earlier session also beats a context-level one, so call `page.unrouteAll()` first.

Also check horizontal overflow (`document.documentElement.scrollWidth > clientWidth`) at 1366, 820 and 390 wide, and look at the screenshot: a green test does not tell you a toolbar looks right. **A table that scrolls inside its own panel does not trip that check** (the page itself does not overflow), yet its last column and its buttons are hidden. So also run this on every page that has a table, at 1440 and 1366, with data in it (seed the sandbox with `npm run seed:demo`, both rounds):

```js
document.querySelectorAll('*').forEach((e) => {
  const cs = getComputedStyle(e);
  if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 2)
    console.log('hidden by scroll:', e.scrollWidth - e.clientWidth, 'px', [...e.querySelectorAll('th')].map((t) => t.innerText).join('/'));
});
```

The same pass is worth doing for text under 14px, `undefined` / `NaN` in the page text, and the buttons on each queue (open the drawer behind every Review / Update / Manage button: the drawers are where the forms live). Remember that several things are `role="tab"` or a card-sized button, not a plain button, when you script the clicks.

**For PDFs**, generate each form through `POST /api/v1/reports/forms/generate` (and
the management reports through `POST /api/v1/reports/generate`), render the pages to
images and *read* them. Without poppler, a throwaway venv does it:
`python -m venv v; v\Scripts\pip install pymupdf`, then `page.get_pixmap()`. A
useful objective check: the rightmost ink on every page must stay within 555.3 pt
(A4 is 595.28 pt wide, margin 40).

Tear down: stop the :3100 and :3101 processes, run
`docker compose -p aimrs-e2e -f docker-compose.e2e.yml down -v`, restart
`npm run dev`, and confirm `http://localhost:3001/api/health`.

**Large and awkward data (added 2026-10-17).** A screen that is right with ten tidy rows can be wrong with hundreds of long ones, and nothing but driving it shows that. Fill the throwaway database with about 350 users, 800 assets, a few hundred requisitions and requests and a few thousand audit rows (there is no repo script for this yet: insert users with SQL, one shared bcrypt hash, and create the rest through the API six at a time with `THROTTLE_LIMIT` raised). Include "monster" records at the real column limits: a 600-character description, brand / serial / property number of exactly 100 characters (unbroken), supplier and office of 200, `components` of 2,000, a 196-character name, and strings like `<img src=x onerror="window.__xss=1">`, `{{7*7}}`, `${7*7}`, quotes and emoji in every text field. Then, per role and page, record: page overflow, scroll containers hiding columns (snippet above), clipped text, anything under 14px, "undefined" / "NaN", console errors and 4xx / 5xx, `window.__xss`, long tasks (`PerformanceObserver` on `longtask`) and **squeezed cells** (a `td` narrower than 56px holding six or more characters, or a button taller than two lines with no space in its label). Open the drawers of the monster records. **Look at the screenshots anyway:** every probe passed on a screen whose "Requested by" column had been squeezed to one letter wide.

**Check the API against the real schema, not only the entity-built one.** The sandbox and e2e databases build their tables from the entities (`synchronize` under `NODE_ENV=test`), so every text column is unbounded and the `VARCHAR(100)` limits of `Database/schemas/001_initial_schema.sql` never bite. Build a second database the way production is built and run a backend over it:

```powershell
docker exec aimrs_e2e_postgres psql -U aimrs_test -d postgres -c "create database aimrs_real"
Get-ChildItem Database\schemas\*.sql | Sort-Object Name | ForEach-Object { Get-Content $_ -Raw | docker exec -i aimrs_e2e_postgres psql -U aimrs_test -d aimrs_real -v ON_ERROR_STOP=1 -q }
Get-Content Database\seeds\001_dev_seed.sql -Raw | docker exec -i aimrs_e2e_postgres psql -U aimrs_test -d aimrs_real -q
# Set the dev-seed users' password_hash to a hash you know, then start a backend as in step 2 but with
# PORT=3102, DATABASE_URL pointing at aimrs_real and NODE_ENV=development (NOT test: under test the
# backend synchronises the entities over this schema and the limits disappear).
```

Send it a value one character over each limit, an oversized body and a duplicate property number / employee ID (`POST /v1/assets`, `/v1/users`, `/v1/reports/forms/generate`): each must be a 400 that names the field, a 413 or a 409, never a 500. For the PDFs, generate every form and report against the volume data and check the page count, any text past the right margin and any page with fewer than three words (a row that spilled over its page); then render and look at the first and a middle page.

Two more traps: a rebuilt `Backend\dist` is not picked up by a backend that is already running (restart it; a sandbox, never your `:3001` unless you mean to), and a backend started from the repo folder reads `Backend\.env` (the Supabase string), so start sandboxes from `$env:TEMP`.

