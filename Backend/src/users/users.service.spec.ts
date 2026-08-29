import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';

const makeUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
  ({
    id: 'u-1',
    employeeId: 'EMP-001',
    firstName: 'Ana',
    lastName: 'Santos',
    email: 'ana@cicc.gov.ph',
    role: UserRole.EMPLOYEE,
    division: 'CISD',
    officeOrSection: 'IT',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    unavailable: false,
    unavailableUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as UserEntity;

describe('UsersService', () => {
  let service: UsersService;

  const mockQb = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  // Stand-in actor for audit metadata — the System Admin performing the action
  const actorId = 'admin-1';
  const actorRole = UserRole.SYSTEM_ADMIN;
  const ipAddress = '127.0.0.1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('returns paginated users with correct metadata', async () => {
      const users = [makeUser(), makeUser({ id: 'u-2' })];
      mockQb.getManyAndCount.mockResolvedValue([users, 2]);

      const result = await service.findAll(1, 10);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('uses default pagination when page/limit omitted', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.limit).toBeGreaterThan(0); // default limit exists
    });

    it('applies search filter via where when search term provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 10, 'Ana');
      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({ q: '%Ana%' }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns user when found', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('u-1');
      expect(result.employeeId).toBe('EMP-001');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('no-such-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByRole()', () => {
    it('returns active users with the given role', async () => {
      const users = [makeUser({ role: UserRole.IT_PERSONNEL })];
      mockRepo.find.mockResolvedValue(users);

      const result = await service.findByRole(UserRole.IT_PERSONNEL);
      expect(result).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.IT_PERSONNEL, isActive: true },
        }),
      );
    });

    it('returns empty array when no users with that role', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findByRole(UserRole.MANAGEMENT);
      expect(result).toEqual([]);
    });
  });

  describe('findSupervisorForSection()', () => {
    it('returns the supervisor matching the exact officeOrSection', async () => {
      const supervisor = makeUser({
        id: 'sup-1',
        role: UserRole.SUPERVISOR,
        officeOrSection: 'Digital Forensics',
        division: 'Operations',
      });
      mockRepo.findOne.mockResolvedValueOnce(supervisor);

      const result = await service.findSupervisorForSection(
        'Digital Forensics',
        'Operations',
      );

      expect(result).toBe(supervisor);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          role: UserRole.SUPERVISOR,
          officeOrSection: 'Digital Forensics',
          isActive: true,
        },
      });
      // Section match found — division fallback query must not run
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('falls back to a division match when no exact section match exists', async () => {
      const supervisor = makeUser({
        id: 'sup-2',
        role: UserRole.SUPERVISOR,
        officeOrSection: 'Other Section',
        division: 'Operations',
      });
      mockRepo.findOne
        .mockResolvedValueOnce(null) // no section match
        .mockResolvedValueOnce(supervisor); // division fallback match

      const result = await service.findSupervisorForSection(
        'Digital Forensics',
        'Operations',
      );

      expect(result).toBe(supervisor);
      expect(mockRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: {
          role: UserRole.SUPERVISOR,
          division: 'Operations',
          isActive: true,
        },
      });
    });

    it('returns null when no supervisor matches either the section or division', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findSupervisorForSection(
        'Digital Forensics',
        'Operations',
      );

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('hashes the password before saving and returns created user', async () => {
      const { default: bcrypt } = await import('bcrypt');
      const user = makeUser();
      mockRepo.create.mockReturnValue(user);
      mockRepo.save.mockResolvedValue(user);

      await service.create(
        {
          employeeId: 'EMP-002',
          firstName: 'Jose',
          lastName: 'Rizal',
          email: 'jose@cicc.gov.ph',
          password: 'SecurePass123!',
          role: UserRole.EMPLOYEE,
          division: 'CISD',
          officeOrSection: 'Records',
        },
        actorId,
        actorRole,
        ipAddress,
      );

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.passwordHash).toBeDefined();
      expect(createArg).not.toHaveProperty('password'); // raw password never stored
      const valid = await bcrypt.compare(
        'SecurePass123!',
        createArg.passwordHash,
      );
      expect(valid).toBe(true);
    });

    it('logs a USER_CREATED audit entry with the new user as the affected record', async () => {
      const user = makeUser();
      mockRepo.create.mockReturnValue(user);
      mockRepo.save.mockResolvedValue(user);

      await service.create(
        {
          employeeId: 'EMP-002',
          firstName: 'Jose',
          lastName: 'Rizal',
          email: 'jose@cicc.gov.ph',
          password: 'SecurePass123!',
          role: UserRole.EMPLOYEE,
          division: 'CISD',
          officeOrSection: 'Records',
        },
        actorId,
        actorRole,
        ipAddress,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          action: AuditAction.USER_CREATED,
          affectedRecordId: user.id,
          affectedRecordType: 'user',
          ipAddress,
        }),
      );
    });
  });

  describe('update()', () => {
    it('updates allowed fields and returns the updated user', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);
      mockRepo.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce({
        ...user,
        firstName: 'Updated',
      });

      await service.update(
        'u-1',
        { firstName: 'Updated' },
        actorId,
        actorRole,
        ipAddress,
      );
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when updating a non-existent user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(
          'no-id',
          { firstName: 'X' },
          actorId,
          actorRole,
          ipAddress,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('logs a USER_UPDATED audit entry with the updated fields', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.update(
        'u-1',
        { firstName: 'Updated' },
        actorId,
        actorRole,
        ipAddress,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          action: AuditAction.USER_UPDATED,
          affectedRecordId: 'u-1',
          affectedRecordType: 'user',
          ipAddress,
          metadata: { updatedFields: ['firstName'] },
        }),
      );
    });
  });

  describe('update() — alternate approver & availability validation', () => {
    it('rejects alternate/availability fields on a non-supervisor row', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeUser({ id: 'u-1', role: UserRole.EMPLOYEE }));
      await expect(
        service.update('u-1', { unavailable: true } as never, actorId, actorRole, ipAddress),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a supervisor naming themselves as alternate', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }));
      await expect(
        service.update('sup-1', { alternateApproverId: 'sup-1' } as never, actorId, actorRole, ipAddress),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an alternate that is inactive or not a supervisor', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }))       // the row being edited
        .mockResolvedValueOnce(makeUser({ id: 'x', role: UserRole.EMPLOYEE }));            // the proposed alternate
      await expect(
        service.update('sup-1', { alternateApproverId: 'x' } as never, actorId, actorRole, ipAddress),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid alternate designation and writes it', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }))
        .mockResolvedValueOnce(makeUser({ id: 'sup-2', role: UserRole.SUPERVISOR, isActive: true }))
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR, alternateApproverId: 'sup-2' })); // refetch
      mockRepo.update.mockResolvedValue({ affected: 1 });
      const result = await service.update('sup-1', { alternateApproverId: 'sup-2' } as never, actorId, actorRole, ipAddress);
      expect(mockRepo.update).toHaveBeenCalledWith('sup-1', { alternateApproverId: 'sup-2' });
      expect(result.alternateApproverId).toBe('sup-2');
    });
  });

  describe('setOwnAvailability()', () => {
    it('writes only the availability fields on the caller row and audits with self=true', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }))                       // existence check
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR, unavailable: true }));   // refetch
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.setOwnAvailability(
        'sup-1',
        { unavailable: true, unavailableUntil: '2026-09-15T00:00:00.000Z' },
        UserRole.SUPERVISOR,
        ipAddress,
      );

      expect(mockRepo.update).toHaveBeenCalledWith('sup-1', {
        unavailable: true,
        unavailableUntil: new Date('2026-09-15T00:00:00.000Z'),
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_UPDATED,
          affectedRecordId: 'sup-1',
          metadata: expect.objectContaining({ self: true, unavailable: true }),
        }),
      );
    });

    it('clears the end date when unavailableUntil is null', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }))
        .mockResolvedValueOnce(makeUser({ id: 'sup-1', role: UserRole.SUPERVISOR }));
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.setOwnAvailability('sup-1', { unavailable: false, unavailableUntil: null }, UserRole.SUPERVISOR, ipAddress);

      expect(mockRepo.update).toHaveBeenCalledWith('sup-1', { unavailable: false, unavailableUntil: null });
    });
  });

  describe('assignRole()', () => {
    it('calls update with the new role', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.assignRole(
        'u-1',
        { role: UserRole.SUPERVISOR },
        actorId,
        actorRole,
        ipAddress,
      );
      expect(mockRepo.update).toHaveBeenCalledWith('u-1', {
        role: UserRole.SUPERVISOR,
      });
    });

    it('throws NotFoundException for unknown user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assignRole(
          'no-id',
          { role: UserRole.SUPERVISOR },
          actorId,
          actorRole,
          ipAddress,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('logs a ROLE_ASSIGNED audit entry with previous and new role', async () => {
      const user = makeUser({ role: UserRole.EMPLOYEE });
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.assignRole(
        'u-1',
        { role: UserRole.SUPERVISOR },
        actorId,
        actorRole,
        ipAddress,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          action: AuditAction.ROLE_ASSIGNED,
          affectedRecordId: 'u-1',
          affectedRecordType: 'user',
          ipAddress,
          metadata: {
            previousRole: UserRole.EMPLOYEE,
            newRole: UserRole.SUPERVISOR,
          },
        }),
      );
    });
  });

  describe('resetPassword()', () => {
    it('logs an audit entry for the password reset', async () => {
      const user = makeUser({ tokenVersion: 0 });
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.resetPassword(
        'u-1',
        { newPassword: 'AnotherSecurePass123!' },
        actorId,
        actorRole,
        ipAddress,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          affectedRecordId: 'u-1',
          affectedRecordType: 'user',
          ipAddress,
        }),
      );
    });
  });

  describe('unlock()', () => {
    it('logs an audit entry for the account unlock', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.unlock('u-1', actorId, actorRole, ipAddress);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          affectedRecordId: 'u-1',
          affectedRecordType: 'user',
          ipAddress,
        }),
      );
    });
  });

  describe('deactivate()', () => {
    it('sets isActive=false and returns success message', async () => {
      mockRepo.findOne.mockResolvedValue(makeUser({ isActive: true }));
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.deactivate(
        'u-1',
        actorId,
        actorRole,
        ipAddress,
      );
      expect(mockRepo.update).toHaveBeenCalledWith('u-1', { isActive: false });
      expect(result.message).toBeDefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deactivate('no-id', actorId, actorRole, ipAddress),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when user is already inactive', async () => {
      mockRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));
      await expect(
        service.deactivate('u-1', actorId, actorRole, ipAddress),
      ).rejects.toThrow();
    });

    it('logs a USER_DEACTIVATED audit entry', async () => {
      const user = makeUser({ isActive: true });
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.deactivate('u-1', actorId, actorRole, ipAddress);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          userRole: actorRole,
          action: AuditAction.USER_DEACTIVATED,
          affectedRecordId: 'u-1',
          affectedRecordType: 'user',
          ipAddress,
        }),
      );
    });
  });

  describe('isUnavailable()', () => {
    it('is false when the flag is off, regardless of the date', () => {
      expect(service.isUnavailable(makeUser({ unavailable: false, unavailableUntil: null }))).toBe(false);
      expect(
        service.isUnavailable(makeUser({ unavailable: false, unavailableUntil: new Date(Date.now() + 3.6e6) })),
      ).toBe(false);
    });

    it('is true when the flag is on with no end date', () => {
      expect(service.isUnavailable(makeUser({ unavailable: true, unavailableUntil: null }))).toBe(true);
    });

    it('is true when the flag is on and the end date is in the future', () => {
      expect(
        service.isUnavailable(makeUser({ unavailable: true, unavailableUntil: new Date(Date.now() + 3.6e6) })),
      ).toBe(true);
    });

    it('is false when the flag is on but the end date has passed', () => {
      expect(
        service.isUnavailable(makeUser({ unavailable: true, unavailableUntil: new Date(Date.now() - 3.6e6) })),
      ).toBe(false);
    });
  });
});
