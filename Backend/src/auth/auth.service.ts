import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UserEntity } from '../users/entities/user.entity';
import {
  MAX_LOGIN_ATTEMPTS,
  BCRYPT_ROUNDS,
} from '../../../packages/shared/src/constants';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';
import { JwtPayload } from './guards/jwt.strategy';

// SVC: Design & Transition — authentication, account lockout, refresh tokens, Security by Design

// Dummy hash used for timing-safe rejection when user not found (SECURITY.md §4.2)
const DUMMY_HASH = '$2b$12$invalidhashfortimingnonce000000000000000000000';

// Refresh token cookie max-age: 7 days in ms
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Login — validates credentials, enforces lockout, issues tokens.
   *
   * Security controls (SECURITY.md §4):
   *   - Timing-safe rejection (dummy bcrypt when user not found)
   *   - bcrypt comparison (min 12 rounds via BCRYPT_ROUNDS)
   *   - Account lockout after MAX_LOGIN_ATTEMPTS (5) failed attempts
   *   - Vague error messages — no enumeration, no remaining-count, no exact lock time
   *   - All auth events written to audit log
   */
  async login(
    emailOrEmployeeId: string,
    password: string,
    ipAddress: string,
    res: Response,
  ): Promise<{
    accessToken: string;
    user: {
      id: string;
      employeeId: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      division: string;
      officeOrSection: string;
    };
  }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :id OR user.employeeId = :id', {
        id: emailOrEmployeeId,
      })
      .getOne();

    // Timing-safe rejection — always run bcrypt even if user not found
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Account lockout check — message does NOT reveal exact remaining time
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Please try again later.',
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const isNowLocked = attempts >= MAX_LOGIN_ATTEMPTS;
      const lockedUntil = isNowLocked
        ? new Date(Date.now() + 30 * 60 * 1000)
        : null;

      await this.userRepo.update(user.id, {
        failedLoginAttempts: attempts,
        lockedUntil,
      });

      // Audit: failed login (and lockout if applicable)
      void this.auditService.log({
        userId: user.id,
        userRole: user.role,
        action: AuditAction.USER_LOGIN_FAILED,
        affectedRecordId: user.id,
        affectedRecordType: 'users',
        ipAddress,
        metadata: { isNowLocked },
      });

      if (isNowLocked) {
        void this.auditService.log({
          userId: user.id,
          userRole: user.role,
          action: AuditAction.USER_LOCKED,
          affectedRecordId: user.id,
          affectedRecordType: 'users',
          ipAddress,
        });
        // Message does NOT reveal lock duration (SECURITY.md §4.2)
        throw new ForbiddenException(
          'Too many failed attempts. Account temporarily locked.',
        );
      }

      // Message does NOT reveal remaining attempt count (SECURITY.md §4.2)
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been deactivated. Contact your System Administrator.',
      );
    }

    // Successful login — reset lockout counters and bump tokenVersion.
    // Incrementing tokenVersion invalidates all JWTs issued before this login,
    // killing any concurrent sessions immediately (SECURITY.md §concurrent-session).
    const newTokenVersion = user.tokenVersion + 1;
    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: newTokenVersion,
    });

    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
      tokenVersion: newTokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);

    // Issue refresh token as httpOnly cookie (SECURITY.md §4.4)
    await this.generateRefreshToken(user.id, res);

    // Audit: successful login
    void this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: AuditAction.USER_LOGIN,
      affectedRecordId: user.id,
      affectedRecordType: 'users',
      ipAddress,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        division: user.division,
        officeOrSection: user.officeOrSection,
      },
    };
  }

  /**
   * generateRefreshToken — creates a random UUID token, stores its bcrypt hash
   * in the DB, and sends the raw token as an httpOnly cookie.
   *
   * The cookie value format is: `${userId}:${rawToken}` so /auth/refresh
   * can resolve the user without requiring a valid access token.
   */
  async generateRefreshToken(userId: string, res: Response): Promise<void> {
    const rawToken = randomUUID();
    const hashedToken = await bcrypt.hash(rawToken, 10);

    await this.userRepo.update(userId, {
      refreshTokenHash: hashedToken,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    // Cookie value carries userId prefix for lookup without a valid JWT
    res.cookie('refresh_token', `${userId}:${rawToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/api/v1/auth/refresh',
    });
  }

  /**
   * rotateRefreshToken — validates the incoming refresh cookie,
   * invalidates it (single-use), issues a new one, and returns a new access token.
   *
   * Token reuse detection: if the stored hash is null or doesn't match,
   * the entire session is invalidated.
   */
  async rotateRefreshToken(
    cookieValue: string,
    ipAddress: string,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const colonIdx = cookieValue.indexOf(':');
    if (colonIdx === -1) throw new UnauthorizedException();

    const userId = cookieValue.substring(0, colonIdx);
    const rawToken = cookieValue.substring(colonIdx + 1);

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      throw new UnauthorizedException();
    }

    if (user.refreshTokenExpiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    const isValid = await bcrypt.compare(rawToken, user.refreshTokenHash);
    if (!isValid) {
      // Token reuse detected — invalidate session entirely
      await this.userRepo.update(userId, {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      });
      void this.auditService.log({
        userId,
        userRole: user.role,
        action: AuditAction.USER_LOGIN_FAILED,
        affectedRecordId: userId,
        affectedRecordType: 'users',
        ipAddress,
        metadata: { reason: 'refresh_token_reuse_detected' },
      });
      throw new UnauthorizedException(
        'Session invalidated. Please log in again.',
      );
    }

    // Single-use: rotate to a new token immediately
    await this.generateRefreshToken(userId, res);

    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  /**
   * logout — clears the refresh token from DB and the cookie.
   */
  async logout(
    userId: string,
    userRole: UserRole,
    ipAddress: string,
    res: Response,
  ): Promise<void> {
    await this.userRepo.update(userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

    void this.auditService.log({
      userId,
      userRole,
      action: AuditAction.USER_LOGOUT,
      affectedRecordId: userId,
      affectedRecordType: 'users',
      ipAddress,
    });
  }

  /**
   * hashPassword — used by UsersService when creating or updating user accounts.
   * Always uses BCRYPT_ROUNDS (12) — never a lower value.
   */
  async hashPassword(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, BCRYPT_ROUNDS);
  }
}
