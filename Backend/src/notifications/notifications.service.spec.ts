import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationAlertType } from '../../../packages/shared/src/enums';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockRepo = {
    find: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(NotificationEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findForUser()', () => {
    it('returns last 50 notifications for a user, newest first', async () => {
      const notifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ];
      mockRepo.find.mockResolvedValue(notifications);

      const result = await service.findForUser('user-1');
      expect(result).toEqual(notifications);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientId: 'user-1' } }),
      );
    });
  });

  describe('markRead()', () => {
    it('sets isRead=true for the given notification ID, scoped to the owning recipient', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });
      await service.markRead('notif-uuid-1', 'user-1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'notif-uuid-1', recipientId: 'user-1' },
        { isRead: true },
      );
    });

    it('throws NotFoundException when the notification does not belong to the caller', async () => {
      mockRepo.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.markRead('notif-uuid-1', 'someone-elses-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead()', () => {
    it('marks all unread notifications for a user as read', async () => {
      mockRepo.update.mockResolvedValue(undefined);
      await service.markAllRead('user-1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { recipientId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });

  describe('notify()', () => {
    it('creates and saves a notification record', async () => {
      const notif = { id: 'n-new', recipientId: 'user-2' };
      mockRepo.create.mockReturnValue(notif);
      mockRepo.save.mockResolvedValue(notif);

      const result = await service.notify(
        'user-2',
        NotificationAlertType.PENDING_APPROVAL,
        'Action Required',
        'A requisition needs your approval',
        'req-uuid-1',
        'requisition',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-2',
          alertType: NotificationAlertType.PENDING_APPROVAL,
          title: 'Action Required',
        }),
      );
      expect(result).toEqual(notif);
    });
  });
});
