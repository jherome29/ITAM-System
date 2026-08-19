import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '../../../packages/shared/src/enums';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo },
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

      await service.create({
        employeeId: 'EMP-002',
        firstName: 'Jose',
        lastName: 'Rizal',
        email: 'jose@cicc.gov.ph',
        password: 'SecurePass123!',
        role: UserRole.EMPLOYEE,
        division: 'CISD',
        officeOrSection: 'Records',
      });

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.passwordHash).toBeDefined();
      expect(createArg).not.toHaveProperty('password'); // raw password never stored
      const valid = await bcrypt.compare(
        'SecurePass123!',
        createArg.passwordHash,
      );
      expect(valid).toBe(true);
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

      await service.update('u-1', { firstName: 'Updated' });
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when updating a non-existent user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('no-id', { firstName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignRole()', () => {
    it('calls update with the new role', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue(undefined);

      await service.assignRole('u-1', { role: UserRole.SUPERVISOR });
      expect(mockRepo.update).toHaveBeenCalledWith('u-1', {
        role: UserRole.SUPERVISOR,
      });
    });

    it('throws NotFoundException for unknown user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assignRole('no-id', { role: UserRole.SUPERVISOR }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive=false and returns success message', async () => {
      mockRepo.findOne.mockResolvedValue(makeUser({ isActive: true }));
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.deactivate('u-1');
      expect(mockRepo.update).toHaveBeenCalledWith('u-1', { isActive: false });
      expect(result.message).toBeDefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('no-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is already inactive', async () => {
      mockRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));
      await expect(service.deactivate('u-1')).rejects.toThrow();
    });
  });
});
