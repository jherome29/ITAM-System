/**
 * Run the backend e2e suite locally against a throwaway Postgres, exactly the
 * way CI's `backend-e2e` job does — so `.e2e-spec.ts` files can be verified
 * before pushing instead of only in CI.
 *
 *   cd Backend && npm run test:e2e:local
 *   cd Backend && npm run test:e2e:local -- security.e2e-spec   # one file
 *
 * Needs Docker. Brings `docker-compose.e2e.yml` up (tmpfs, ephemeral), waits
 * for health, runs jest with NODE_ENV=test + the container's DATABASE_URL, then
 * tears the container down whatever the outcome.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const backendDir = join(repoRoot, 'Backend');
const compose = ['compose', '-f', join(repoRoot, 'docker-compose.e2e.yml')];
// shell:true so `npm`/`docker` resolve their .cmd shims on Windows
const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });

const down = () => run('docker', [...compose, 'down', '-v', '--remove-orphans']);

console.log('▶ starting throwaway Postgres (docker-compose.e2e.yml)…');
const up = run('docker', [...compose, 'up', '-d', '--wait']);
if (up.status !== 0) {
  console.error('✖ could not start the e2e Postgres container. Is Docker running?');
  process.exit(up.status ?? 1);
}

let code = 1;
try {
  const passthrough = process.argv.slice(2); // e.g. a test-path filter
  const jest = run('npm', ['run', 'test:e2e', '--', ...passthrough], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://aimrs_test:aimrs_test@localhost:5433/aimrs_test?sslmode=disable',
      JWT_SECRET:
        process.env.JWT_SECRET ?? 'local-e2e-jwt-secret-32-chars-minimum-xx',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '8h',
    },
  });
  code = jest.status ?? 1;
} finally {
  console.log('▶ tearing down the e2e Postgres…');
  down();
}
process.exit(code);
