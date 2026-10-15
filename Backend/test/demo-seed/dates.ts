/** `YYYY-MM-DD` for today plus `days` (negative = in the past). */
export const dayOffset = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
