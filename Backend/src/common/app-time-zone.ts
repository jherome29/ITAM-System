import { APP_TIME_ZONE } from '../../../packages/shared/src/constants';

/**
 * Default the process time zone to CICC's (Asia/Manila) when TZ is unset or
 * blank.
 *
 * A container's clock is UTC unless told otherwise, and local-time Date methods
 * (`setHours(0,0,0,0)`, `toLocale…String`) and cron schedules follow it — so
 * "today" and "this month" on the dashboards begin at 08:00 Manila and the
 * daily 7:00 watchers fire at 15:00. A blank `TZ=` (an unfilled template) would
 * silently mean UTC, so it counts as unset. An explicit TZ still wins, so a
 * deployment can override it. Call before anything reads the clock.
 */
export function applyDefaultTimeZone(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!env.TZ?.trim()) env.TZ = APP_TIME_ZONE;
}
