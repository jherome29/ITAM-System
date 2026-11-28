import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

/**
 * The visitor's address when the request came through the UAT password gate (a Cloudflare Worker).
 * The Worker sends it in X-UAT-Client-IP with X-UAT-Gate-Secret; Railway discards X-Forwarded-For, so
 * without this the audit log records a Cloudflare address for every officer.
 *
 * The header is believed only when the secret matches (constant-time) and the value is one valid address:
 * the backend can also be reached directly, and a header anyone could set would let anyone choose what the
 * audit trail records. Install it only when CLIENT_IP_SECRET is set (see main.ts).
 */
export function trustedClientIp(secret: string) {
  const expected = Buffer.from(secret);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const given = req.headers['x-uat-gate-secret'];
    const address = req.headers['x-uat-client-ip'];
    if (
      typeof given === 'string' &&
      typeof address === 'string' &&
      given.length === secret.length &&
      timingSafeEqual(Buffer.from(given), expected) &&
      isIP(address) !== 0
    ) {
      // `ip` is a getter on Express's request: an own property overrides it for this request only.
      Object.defineProperty(req, 'ip', { value: address, configurable: true });
    }
    next();
  };
}
