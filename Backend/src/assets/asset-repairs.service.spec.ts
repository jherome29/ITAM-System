import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AssetRepairsService, repairDueDate } from './asset-repairs.service';
import { AssetRepairEntity } from './entities/asset-repair.entity';
import { AssetEntity } from './entities/asset.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import {
  AssetClass,
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  RepairOutcome,
  RepairServiceType,
  UserRole,
} from '../../../packages/shared/src/enums';

const user = (id: string, role: UserRole) =>
  ({
    id,
    role,
    firstName: 'U',
    lastName: id,
    employeeId: `E-${id}`,
  }) as UserEntity;

const EMP = user('emp-1', UserRole.EMPLOYEE);
const IT = user('it-1', UserRole.IT_PERSONNEL);
const IT2 = user('it-2', UserRole.IT_PERSONNEL);
const PC = user('pc-1', UserRole.PROPERTY_CUSTODIAN);
const ADMIN = user('ad-1', UserRole.SYSTEM_ADMIN);

const laptop = (over: Partial<AssetEntity> = {}) =>
  ({
    id: 'asset-1',
    itemDescription: 'Dell Latitude',
    propertyNumber: 'PROP-1',
    assetType: AssetType.ICT,
    assetClass: AssetClass.PPE,
    status: AssetStatus.UNDER_REPAIR,
    ...over,
  }) as AssetEntity;

const repair = (over: Partial<AssetRepairEntity> = {}) =>
  ({
    id: 'rep-1',
    assetId: 'asset-1',
    asset: laptop(),
    holderId: EMP.id,
    holder: EMP,
    openedAt: new Date('2026-10-01T00:00:00Z'),
    expectedCompletionDate: null,
    serviceType: RepairServiceType.IN_HOUSE,
    completedAt: null,
    ...over,
  }) as AssetRepairEntity;

describe('repairDueDate', () => {
  it('uses the expected completion date when set', () => {
    expect(
      repairDueDate({
        expectedCompletionDate: '2026-10-20',
        openedAt: new Date(),
      }),
    ).toBe('2026-10-20');
  });

  it('falls back to the default turnaround from when it was opened', () => {
    expect(
      repairDueDate({
        expectedCompletionDate: null,
        openedAt: new Date('2026-10-01T00:00:00Z'),
      }),
    ).toBe('2026-10-15');
  });
});

describe('AssetRepairsService', () => {
  let service: AssetRepairsService;
  let current: AssetRepairEntity | null;

  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve(current)),
    getMany: jest.fn(() => Promise.resolve(current ? [current] : [])),
  };
  const mockRepo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve({ id: 'rep-new', ...x })),
    update: jest.fn(),
    manager: { update: jest.fn() },
  };
  const mockAudit = { log: jest.fn() };
  const mockNotify = { notify: jest.fn() };
  const mockUsers = {
    findOne: jest.fn((id: string) =>
      Promise.resolve(
        [EMP, IT, IT2, PC, ADMIN].find((u) => u.id === id) ?? null,
      ),
    ),
    findByRole: jest.fn((role: UserRole) =>
      Promise.resolve(
        role === UserRole.IT_PERSONNEL
          ? [IT, IT2]
          : role === UserRole.PROPERTY_CUSTODIAN
            ? [PC]
            : [],
      ),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    current = repair();
    const module = await Test.createTestingModule({
      providers: [
        AssetRepairsService,
        { provide: getRepositoryToken(AssetRepairEntity), useValue: mockRepo },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotify },
        { provide: UsersService, useValue: mockUsers },
      ],
    }).compile();
    service = module.get(AssetRepairsService);
  });

  describe('who may act', () => {
    it('the custodian role for the asset type, not another scope, not the holder', () => {
      expect(service.canAct(repair(), IT)).toBe(true);
      expect(service.canAct(repair(), PC)).toBe(false);
      expect(service.canAct(repair(), EMP)).toBe(false);
      expect(service.canAct(repair(), ADMIN)).toBe(false);
    });

    it("a custodian's own item: another custodian or the System Admin, never themself", () => {
      const own = repair({ holderId: IT.id, holder: IT });
      expect(service.canAct(own, IT)).toBe(false);
      expect(service.canAct(own, IT2)).toBe(true);
      expect(service.canAct(own, ADMIN)).toBe(true);
    });

    it('nobody acts on a closed repair', () => {
      const closed = repair({ completedAt: new Date() });
      expect(service.canAct(closed, IT)).toBe(false);
      expect(() => service.assertCanAct(closed, IT)).toThrow(
        BadRequestException,
      );
    });

    it('explains a refusal', () => {
      expect(() => service.assertCanAct(repair(), PC)).toThrow(
        /IT Asset Custodian/,
      );
      expect(() =>
        service.assertCanAct(repair({ holderId: IT.id, holder: IT }), IT),
      ).toThrow(ForbiddenException);
    });
  });

  describe('reads', () => {
    it('scopes the queue by asset type and status', async () => {
      await service.list(PC, 'open');
      expect(qb.where).toHaveBeenCalledWith('asset.assetType IN (:...scope)', {
        scope: [AssetType.FIXED, AssetType.SUPPLIES],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('r.completedAt IS NULL');
    });

    it('hides an ICT repair from the Property Custodian', async () => {
      await expect(service.findOneForUser('rep-1', PC)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marks a repair overdue once past its due date', async () => {
      current = repair({ expectedCompletionDate: '2020-01-01' });
      const view = await service.findOneForUser('rep-1', IT);
      expect(view).toMatchObject({
        overdue: true,
        dueDate: '2020-01-01',
        canAct: true,
      });
    });
  });

  describe('update()', () => {
    it('records service details and re-arms the overdue alert on a new date', async () => {
      await service.update(
        'rep-1',
        {
          serviceType: RepairServiceType.EXTERNAL,
          serviceProvider: ' Dell Service Center ',
          expectedCompletionDate: '2026-10-25',
        },
        IT,
        'ip',
      );
      expect(mockRepo.update).toHaveBeenCalledWith('rep-1', {
        serviceType: RepairServiceType.EXTERNAL,
        serviceProvider: 'Dell Service Center',
        expectedCompletionDate: '2026-10-25',
        overdueNotifiedAt: null,
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REPAIR_UPDATED }),
      );
    });

    it('refuses the holder', async () => {
      await expect(service.update('rep-1', {}, EMP, 'ip')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('lifecycle hooks', () => {
    it('opens one record per stay — reuses an open one', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await service.open(laptop(), EMP.id, IT.id, {
        assetRequestId: 'ar-1',
        problem: ' No power ',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'asset-1',
          holderId: EMP.id,
          assetRequestId: 'ar-1',
          reportedProblem: 'No power',
        }),
      );

      mockRepo.findOne.mockResolvedValueOnce(repair());
      mockRepo.save.mockClear();
      await service.open(laptop(), EMP.id, IT.id);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('closes as repaired and tells the holder to collect it', async () => {
      mockRepo.findOne.mockResolvedValue(repair());
      await service.close(
        laptop({ status: AssetStatus.ISSUED }),
        AssetStatus.ISSUED,
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
        {
          actionTaken: 'Replaced DC jack',
        },
      );
      expect(mockRepo.update).toHaveBeenCalledWith(
        'rep-1',
        expect.objectContaining({
          outcome: RepairOutcome.REPAIRED,
          actionTaken: 'Replaced DC jack',
        }),
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.REPAIR_UPDATE,
        'Repair Completed',
        expect.stringMatching(
          /back under your custody.*Work done: Replaced DC jack/,
        ),
        'rep-1',
        'asset_repair',
      );
    });

    it('closes as unrepairable and offers a replacement to a role that can requisition', async () => {
      mockRepo.findOne.mockResolvedValue(repair());
      await service.close(
        laptop(),
        AssetStatus.FLAGGED_FOR_DISPOSAL,
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
        {
          findings: 'Motherboard burnt',
        },
      );
      expect(mockNotify.notify).toHaveBeenCalledWith(
        EMP.id,
        NotificationAlertType.REPAIR_UPDATE,
        'Repair Not Possible',
        expect.stringMatching(/Motherboard burnt.*request a replacement/),
        'rep-1',
        'asset_repair',
      );
    });

    it('a stock item has nobody to tell', async () => {
      mockRepo.findOne.mockResolvedValue(
        repair({ holderId: null, holder: null }),
      );
      await service.close(
        laptop(),
        AssetStatus.AVAILABLE,
        IT.id,
        UserRole.IT_PERSONNEL,
        'ip',
      );
      expect(mockNotify.notify).not.toHaveBeenCalled();
    });

    describe('with a loaner out', () => {
      const loaner = (over: Partial<AssetEntity> = {}) =>
        laptop({
          id: 'loan-1',
          itemDescription: 'HP ProBook',
          status: AssetStatus.ISSUED,
          custodianId: EMP.id,
          expectedReturnDate: '2099-01-01' as unknown as Date,
          ...over,
        });

      it('brings its return date forward to today and asks the holder to bring it back', async () => {
        mockRepo.findOne.mockResolvedValue(
          repair({ loanerAssetId: 'loan-1', loaner: loaner() }),
        );
        await service.close(
          laptop({ status: AssetStatus.ISSUED }),
          AssetStatus.ISSUED,
          IT.id,
          UserRole.IT_PERSONNEL,
          'ip',
          { actionTaken: 'Replaced fan' },
        );
        const today = new Date().toISOString().slice(0, 10);
        expect(mockRepo.manager.update).toHaveBeenCalledWith(
          AssetEntity,
          'loan-1',
          { expectedReturnDate: today, overdueNotifiedAt: null },
        );
        expect(mockNotify.notify).toHaveBeenCalledWith(
          EMP.id,
          NotificationAlertType.REPAIR_UPDATE,
          'Repair Completed',
          expect.stringContaining('return the loaner "HP ProBook"'),
          'rep-1',
          'asset_repair',
        );
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.REPAIR_COMPLETED,
            metadata: expect.objectContaining({
              loanerAssetId: 'loan-1',
              loanerDueBy: today,
            }),
          }),
        );
      });

      it('leaves a loaner that is already back alone', async () => {
        mockRepo.findOne.mockResolvedValue(
          repair({
            loanerAssetId: 'loan-1',
            loaner: loaner({ status: AssetStatus.RETURNED, custodianId: null }),
          }),
        );
        await service.close(
          laptop({ status: AssetStatus.ISSUED }),
          AssetStatus.ISSUED,
          IT.id,
          UserRole.IT_PERSONNEL,
          'ip',
        );
        expect(mockRepo.manager.update).not.toHaveBeenCalled();
        expect(mockNotify.notify).toHaveBeenCalledWith(
          EMP.id,
          NotificationAlertType.REPAIR_UPDATE,
          'Repair Completed',
          expect.not.stringContaining('loaner'),
          'rep-1',
          'asset_repair',
        );
      });

      it('shows the loaner on the repair view, flagged while still with the holder', async () => {
        current = repair({ loanerAssetId: 'loan-1', loaner: loaner() });
        const view = await service.findOneForUser('rep-1', IT);
        expect(view.loaner).toMatchObject({
          id: 'loan-1',
          itemDescription: 'HP ProBook',
          withHolder: true,
        });
      });

      it('attachLoaner() links it, audits it and tells the holder when it is due', async () => {
        await service.attachLoaner(repair(), loaner(), '2026-10-20', IT, 'ip');
        expect(mockRepo.update).toHaveBeenCalledWith('rep-1', {
          loanerAssetId: 'loan-1',
        });
        expect(mockAudit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.REPAIR_UPDATED,
            metadata: expect.objectContaining({
              loanerAssetId: 'loan-1',
              loanerReturnBy: '2026-10-20',
            }),
          }),
        );
        expect(mockNotify.notify).toHaveBeenCalledWith(
          EMP.id,
          NotificationAlertType.REPAIR_UPDATE,
          'Loaner Issued',
          expect.stringContaining('return it by 2026-10-20'),
          'rep-1',
          'asset_repair',
        );
      });
    });

    it('nothing to close when no record is open', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.close(
          laptop(),
          AssetStatus.AVAILABLE,
          IT.id,
          UserRole.IT_PERSONNEL,
          'ip',
        ),
      ).resolves.toBeNull();
    });
  });

  describe('checkOverdue()', () => {
    it('alerts the custodians (not the holder) once, then stamps it', async () => {
      current = repair({
        holderId: IT.id,
        holder: IT,
        expectedCompletionDate: '2020-01-01',
      });
      await expect(service.checkOverdue()).resolves.toBe(1);
      const recipients = mockNotify.notify.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(recipients).toEqual([IT2.id]);
      expect(mockNotify.notify.mock.calls[0][1]).toBe(
        NotificationAlertType.REPAIR_OVERDUE,
      );
      expect(mockRepo.update).toHaveBeenCalledWith('rep-1', {
        overdueNotifiedAt: expect.any(Date),
      });
    });

    it('ignores repairs that are not yet due', async () => {
      current = repair({ expectedCompletionDate: '2999-01-01' });
      await expect(service.checkOverdue()).resolves.toBe(0);
      expect(mockNotify.notify).not.toHaveBeenCalled();
    });
  });
});
