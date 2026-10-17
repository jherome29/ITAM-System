# UAT deployment (Railway + Cloudflare)

A temporary hosted environment so CICC officers can test. The system is handed over to CICC IT
afterwards (see `docker-compose.prod.yml`); this setup is a rehearsal of that, with synthetic data only.

## Shape

One Railway project in **Southeast Asia (Singapore)** with three services:

| Service | Built from | Public? |
|---|---|---|
| `Postgres` | Railway database | no (the public TCP address is switched on only to load the schema or create the admin, then removed) |
| `backend` | `Backend/Dockerfile` (set Builder = Dockerfile, path `Backend/Dockerfile`) | **no**: reached only by the frontend over `backend.railway.internal` |
| `frontend` | `Frontend/Dockerfile` | yes, behind Cloudflare Access |

The browser only ever talks to the frontend's own address. Next forwards `/api/*` to the backend
(`BACKEND_INTERNAL_URL`, baked in at build). Why not a public API address: the refresh cookie is
`SameSite=Strict`, so a separate API site would break the silent token refresh, and one address is one
Cloudflare Access gate with no CORS.

## Variables

`backend` (set in Railway, never in the repo; generate the two secrets with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`, run twice):

```
NODE_ENV=production            PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}   DATABASE_SSL=no-verify   (disable if the log says the server has no SSL)
JWT_SECRET=<secret 1>          JWT_REFRESH_SECRET=<secret 2>
ALLOWED_ORIGIN=https://<site>  TRUST_PROXY=3   (verify: the audit log must show the real client IP)
THROTTLE_LIMIT=600             DB_POOL_MAX=10
```

`frontend`: build variables `BACKEND_INTERNAL_URL=http://backend.railway.internal:3001` and
`NEXT_PUBLIC_APP_NAME=AIMRS`. Leave `NEXT_PUBLIC_API_URL` unset (it defaults to `/api`).

## First-time setup (in order)

1. Postgres service, region Singapore. Turn on public networking, then load the schema once:
   `docker run --rm -e DBURL -v "${PWD}\Database\schemas:/s" postgres:16 sh -c 'for f in /s/*.sql; do psql "$DBURL" -v ON_ERROR_STOP=1 -q -f "$f" || exit 1; done'`
   Never run the dev seed: its passwords are published in the repo.
2. Create the first administrator: `BOOTSTRAP_DB_URL=<public URL> BOOTSTRAP_DB_SSL=no-verify ADMIN_EMAIL=<email> node Backend/scripts/bootstrap-admin.mjs`.
   The password goes to `.env.admin.local` (git-ignored) and is never printed. Then remove the public address.
3. `backend` and `frontend` services from the GitHub repo (install the Railway GitHub app on the owning account first:
   pasting a repo URL clones it read-only and sees only `main`). Set the branch and turn on Wait for CI.
4. Cloudflare: the domain's DNS on Cloudflare, SSL/TLS mode **Full** (not Full strict; Railway cannot do it),
   a proxied CNAME to the frontend's Railway domain, and an Access application (one-time PIN, officers' emails only).
5. In the admin screen create one account per role, each with its own password.

## Things that went wrong once, so they do not again

- Builder left on **Railpack** fails: the Dockerfile is not at the repo root.
- Railway's "Suggested Variables" panel offers placeholders scraped from `.env.example` files
  (`aimrs_dev`, "replace_with..."): never click Add on them.
- The Postgres service name in `${{Postgres.DATABASE_URL}}` must match the service's name exactly.
- Put the backend in the same region as the database, or every query crosses an ocean.

## Still to verify after the first full deploy

The audit log shows the real client IP (`TRUST_PROXY`); a 15 MB attachment upload and a PDF download work
through the Next proxy; the session refreshes after the access token expires; testers behind one office
address are not throttled (login is limited to 10 a minute per address).
