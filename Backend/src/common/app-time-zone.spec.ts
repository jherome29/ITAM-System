import { applyDefaultTimeZone } from './app-time-zone';
import { APP_TIME_ZONE } from '../../../packages/shared/src/constants';

// A container's clock is UTC unless told otherwise. Everything that cuts the
// calendar with local-time Date methods ("failed logins today", "fulfilled this
// month", the daily 7:00 jobs) then runs on UTC days: "today" starts at 08:00
// Manila, and the 7:00 jobs fire at 15:00.
//
// These tests pass an env object instead of touching process.env: Jest gives
// each test file a *copy* of process.env, so assigning TZ here never reaches the
// real process and `Date` would not change. (That Node honours a runtime TZ
// assignment was checked directly in plain Node.)
describe('applyDefaultTimeZone', () => {
  it('defaults an unset TZ to the CICC time zone', () => {
    const env: NodeJS.ProcessEnv = {};

    applyDefaultTimeZone(env);

    expect(env.TZ).toBe(APP_TIME_ZONE);
  });

  it('leaves an explicitly configured TZ alone, so a deployment can override it', () => {
    const env: NodeJS.ProcessEnv = { TZ: 'UTC' };

    applyDefaultTimeZone(env);

    expect(env.TZ).toBe('UTC');
  });

  it('treats a blank TZ like an unset one (a template\'s empty "TZ=" must not silently mean UTC)', () => {
    for (const blank of ['', '   ']) {
      const env: NodeJS.ProcessEnv = { TZ: blank };

      applyDefaultTimeZone(env);

      expect(env.TZ).toBe(APP_TIME_ZONE);
    }
  });
});
