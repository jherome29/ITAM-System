import { dayOffset, requestDate } from './dates';

// The API only accepts an incident (repair, damage, loss, theft) dated today or
// earlier - it describes when it happened - and a return dated today or later -
// it is the day the holder proposes to hand the item in. The scenario writes one
// size of offset for every request, so the date is decided here, by type.
describe('requestDate', () => {
  const today = dayOffset(0);

  it.each(['repair', 'damage', 'loss', 'theft'])(
    'puts a %s in the past, where it has already happened',
    (type) => {
      expect(requestDate(type, 3) < today).toBe(true);
    },
  );

  it('puts a return in the future, where it can still be handed in', () => {
    expect(requestDate('return', 3) > today).toBe(true);
  });

  it('uses the size of the offset, not its sign', () => {
    expect(requestDate('repair', 4)).toBe(requestDate('repair', -4));
    expect(requestDate('return', 4)).toBe(requestDate('return', -4));
  });

  it('keeps an incident with no offset on today', () => {
    expect(requestDate('loss', 0)).toBe(today);
  });

  // The server's "today" is the Manila day, which runs ahead of the UTC day this
  // helper uses for part of every day - so a return dated "today" could already
  // be in its past. A return is always at least a day ahead.
  it('never dates a return on the day it is filed', () => {
    expect(requestDate('return', 0) > today).toBe(true);
  });
});
