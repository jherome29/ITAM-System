import type { NextFunction, Request, Response } from 'express';
import { trustedClientIp } from './trusted-client-ip';

// Behind the UAT password gate (a Cloudflare Worker) every request reaches the backend from a Cloudflare
// address, and Railway discards the X-Forwarded-For the Worker sends, so the audit log recorded Cloudflare
// instead of the officer. The Worker now sends the visitor's address in its own header together with a
// shared secret; the backend believes that header only when the secret matches, because anyone who can
// reach the backend directly could otherwise write any address into the audit trail.

const SECRET = 's'.repeat(32);

function run(headers: Record<string, string>, secret = SECRET) {
  const req = { headers, ip: '104.22.188.139' } as unknown as Request;
  const next = jest.fn() as unknown as NextFunction;
  trustedClientIp(secret)(req, {} as Response, next);
  return { req, next: next as unknown as jest.Mock };
}

describe('trustedClientIp', () => {
  it('uses the visitor address the gate sends when the shared secret matches', () => {
    const { req, next } = run({
      'x-uat-gate-secret': SECRET,
      'x-uat-client-ip': '113.19.57.132',
    });

    expect(req.ip).toBe('113.19.57.132');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts an IPv6 visitor too', () => {
    expect(
      run({ 'x-uat-gate-secret': SECRET, 'x-uat-client-ip': '2001:db8::7' }).req
        .ip,
    ).toBe('2001:db8::7');
  });

  it('ignores the address when the secret is wrong, and still carries on', () => {
    const { req, next } = run({
      'x-uat-gate-secret': 'x'.repeat(32),
      'x-uat-client-ip': '203.0.113.7',
    });

    expect(req.ip).toBe('104.22.188.139');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores the address when there is no secret, or one of a different length', () => {
    expect(run({ 'x-uat-client-ip': '203.0.113.7' }).req.ip).toBe(
      '104.22.188.139',
    );
    expect(
      run({ 'x-uat-gate-secret': 'short', 'x-uat-client-ip': '203.0.113.7' })
        .req.ip,
    ).toBe('104.22.188.139');
  });

  it.each(['not-an-ip', '1.2.3.4, 5.6.7.8', '', '<script>', '999.1.1.1'])(
    'ignores %j: only a single valid address is believed',
    (value) => {
      expect(
        run({ 'x-uat-gate-secret': SECRET, 'x-uat-client-ip': value }).req.ip,
      ).toBe('104.22.188.139');
    },
  );

  it('leaves the request alone when the gate sent no address', () => {
    expect(run({ 'x-uat-gate-secret': SECRET }).req.ip).toBe('104.22.188.139');
  });
});
