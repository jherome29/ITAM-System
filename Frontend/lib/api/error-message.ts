/**
 * The human-readable reason an API call failed, or `fallback` when the server
 * did not give one.
 *
 * Handles the three shapes seen here: a string message, a list of validation
 * messages, and either of those inside a Blob - which is how axios delivers an
 * error body when the request asked for `responseType: 'blob'` (every PDF/Excel
 * download), so a plain `response.data.message` finds nothing there.
 */
export async function apiErrorMessage(err: unknown, fallback: string): Promise<string> {
  let data = (err as { response?: { data?: unknown } } | undefined)?.response?.data;

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      data = JSON.parse(await data.text()) as unknown;
    } catch {
      return fallback;
    }
  }

  const message = (data as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) {
    const text = message.filter((m): m is string => typeof m === 'string').join('; ');
    return text || fallback;
  }
  return typeof message === 'string' && message.trim() ? message : fallback;
}
