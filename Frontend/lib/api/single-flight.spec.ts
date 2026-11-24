import { describe, expect, it, vi } from 'vitest';
import { singleFlight } from './single-flight';

// The refresh cookie is single-use: the server rotates it on every call and
// treats a second use of the old one as token theft, wiping the whole session.
// So two refreshes in flight at once (React Strict Mode runs the session-restore
// effect twice in dev; the 401 handler can overlap it) leave the browser and the
// database holding different tokens, and the NEXT page load logs the user out.
// singleFlight makes concurrent callers share one call.
describe('singleFlight', () => {
  const deferred = <T>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('runs the underlying call once for callers that overlap, and hands them all the same result', async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);
    const refresh = singleFlight(fn);

    const a = refresh();
    const b = refresh();
    const c = refresh();
    d.resolve('token-1');

    await expect(Promise.all([a, b, c])).resolves.toEqual(['token-1', 'token-1', 'token-1']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh call once the previous one has settled', async () => {
    const fn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const refresh = singleFlight(fn);

    await expect(refresh()).resolves.toBe('first');
    await expect(refresh()).resolves.toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shares a failure between overlapping callers without poisoning the next call', async () => {
    const d = deferred<string>();
    const fn = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce('recovered');
    const refresh = singleFlight(fn);

    const a = refresh();
    const b = refresh();
    d.reject(new Error('401'));

    await expect(a).rejects.toThrow('401');
    await expect(b).rejects.toThrow('401');
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(refresh()).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
