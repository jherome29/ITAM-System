/** `YYYY-MM-DD` for today plus `days` (negative = in the past). */
export const dayOffset = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const RETURN = 'return';

/**
 * The date to file a return or incident request with. The API takes an incident
 * (repair, damage, loss, theft) only if it has already happened, and a return
 * only if it is still to come, so the scenario's offset gives the distance and
 * the type gives the direction. A return is always at least a day ahead: the
 * server's "today" is the Manila day, which runs ahead of this UTC one.
 */
export const requestDate = (type: string, days: number): string => {
  const distance = Math.abs(days);
  return type === RETURN
    ? dayOffset(Math.max(1, distance))
    : dayOffset(-distance);
};
