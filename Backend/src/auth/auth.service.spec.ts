import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { UserEntity } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../../packages/shared/src/enums';

// ── Helper — build a mock UserEntity ─────────────────────────────────────────
const makeUser = (overrides: Partial<UserEntity> = {}): UserEntity => ({
  id: 'user-uuid-1',
  employeeId: 'EMP-001',
  firstName: 'Juan',
  lastName: 'dela Cruz',
  email: 'juan@cicc.gov.ph',
  passwordHash: '',
  role: UserRole.EMPLOYEE,
  division: 'CISD',
  officeOrSection: 'IT',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  tokenVersion: 0,
  refreshTokenHash: null,
  refreshTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── Build the QB chain mock that AuthService uses ────────────────────────────
const makeQb = (resolvedUser: UserEntity | null) => ({
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(resolvedUser),
});

// ── Mock express Response (needed for refresh token cookie) ──────────────────
const mockRes = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response;

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepo = {
    createQueryBuilder: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
  };

  // Defaults to the shared-constant value (5) so every existing test is
  // unchanged; one test overrides it to prove the value is read from config.
  const mockSystemConfig = {
    getMaxLoginAttempts: jest.fn(() => 5),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SystemConfigService, useValue: mockSystemConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockUserRepo.update.mockResolvedValue(undefined);
    // clearAllMocks() keeps implementations but a per-test mockReturnValue
    // override would leak; re-assert the default each time.
    mockSystemConfig.getMaxLoginAttempts.mockReturnValue(5);
  });

  // ── Successful login ───────────────────────────────────────────────────────
  describe('login() — success', () => {
    it('returns accessToken + sanitized user on valid credentials', async () => {
      const hash = await bcrypt.hash('Password123!', 12);
      const user = makeUser({ passwordHash: hash });
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

      const result = await service.login(
        'juan@cicc.gov.ph',
        'Password123!',
        '127.0.0.1',
        mockRes,
      );

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.id).toBe('user-uuid-1');
      expect(result.user).not.toHaveProperty('passwordHash'); // never expose hash
      // Counters reset on success
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
      );
      // Refresh token cookie must be set
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.stringContaining(user.id),
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
    });

    it('accepts login by employeeId', async () => {
      const hash = await bcrypt.hash('Pass!', 12);
      const user = makeUser({ passwordHash: hash });
      mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

      const result = await service.login(
        'EMP-001',
        'Pass!',
        '192.168.1.1',
        mockRes,
      );
      expect(result.user.employeeId).toBe('EMP-001');
    });
  });

  // ── Unknown user ──────────────────────────────────────────────────────────
  it('throws UnauthorizedException for unknown email/ID', async () => {
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(null));
    await expect(
      service.login('nobody@cicc.gov.ph', 'anything', '127.0.0.1', mockRes),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  // ── Wrong password — increments attempt counter ───────────────────────────
  it('increments failedLoginAttempts on wrong password', async () => {
    const hash = await bcrypt.hash('CorrectPass!', 12);
    const user = makeUser({ passwordHash: hash, failedLoginAttempts: 0 });
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

    await expect(
      service.login('juan@cicc.gov.ph', 'WrongPass!', '127.0.0.1', mockRes),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockUserRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ failedLoginAttempts: 1 }),
    );
  });

  // ── Account lockout after 5 failures ─────────────────────────────────────
  it('locks account (sets lockedUntil) on the 5th failed attempt', async () => {
    const hash = await bcrypt.hash('CorrectPass!', 12);
    const user = makeUser({ passwordHash: hash, failedLoginAttempts: 4 });
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

    await expect(
      service.login('juan@cicc.gov.ph', 'WrongPass!', '127.0.0.1', mockRes),
    ).rejects.toThrow(ForbiddenException);

    expect(mockUserRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      }),
    );
  });

  // ── Lockout threshold is read from SystemConfig, not the constant ────────
  it('locks after the Nth failed attempt where N comes from SystemConfig', async () => {
    // Config says 3. With the hardcoded MAX_LOGIN_ATTEMPTS (5) still in force,
    // a 3rd failed attempt would be a plain UnauthorizedException with
    // lockedUntil left null — not a lockout.
    mockSystemConfig.getMaxLoginAttempts.mockReturnValue(3);
    const hash = await bcrypt.hash('CorrectPass!', 12);
    const user = makeUser({ passwordHash: hash, failedLoginAttempts: 2 });
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

    await expect(
      service.login('juan@cicc.gov.ph', 'WrongPass!', '127.0.0.1', mockRes),
    ).rejects.toThrow(ForbiddenException);

    expect(mockSystemConfig.getMaxLoginAttempts).toHaveBeenCalled();
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        failedLoginAttempts: 3,
        lockedUntil: expect.any(Date),
      }),
    );
  });

  // ── Locked account blocked immediately ───────────────────────────────────
  it('throws ForbiddenException (not UnauthorizedException) for a locked account', async () => {
    const lockExpiry = new Date(Date.now() + 15 * 60_000);
    const user = makeUser({ failedLoginAttempts: 5, lockedUntil: lockExpiry });
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

    await expect(
      service.login('juan@cicc.gov.ph', 'AnyPass!', '127.0.0.1', mockRes),
    ).rejects.toThrow(ForbiddenException);

    // Must NOT call update — reject before bcrypt compare
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  // ── Inactive account ──────────────────────────────────────────────────────
  it('throws ForbiddenException for an inactive account', async () => {
    const hash = await bcrypt.hash('Pass123!', 12);
    const user = makeUser({ passwordHash: hash, isActive: false });
    mockUserRepo.createQueryBuilder.mockReturnValue(makeQb(user));

    await expect(
      service.login('juan@cicc.gov.ph', 'Pass123!', '127.0.0.1', mockRes),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── hashPassword utility ──────────────────────────────────────────────────
  it('hashPassword() produces a valid bcrypt hash', async () => {
    const hash = await service.hashPassword('MySecurePassword!');
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    const isValid = await bcrypt.compare('MySecurePassword!', hash);
    expect(isValid).toBe(true);
  });
});
