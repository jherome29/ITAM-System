/**
 * Wrap an async call so callers that overlap share one in-flight invocation
 * (and its result or failure). Once it settles the next call starts a new one.
 *
 * Used for the token refresh: the refresh cookie is single-use, so two
 * refreshes in flight at once spend the same cookie twice and the server wipes
 * the session as a presumed replay.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
