import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationAlertType } from '../../../packages/shared/src/enums';

// SVC: Engage — automated alert system

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifRepo: Repository<NotificationEntity>,
  ) {}

  async findForUser(recipientId: string) {
    return this.notifRepo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(id: string, recipientId: string) {
    const result = await this.notifRepo.update(
      { id, recipientId },
      { isRead: true },
    );
    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  async markAllRead(recipientId: string) {
    await this.notifRepo.update(
      { recipientId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  /** Called by other services to trigger notifications */
  async notify(
    recipientId: string,
    alertType: NotificationAlertType,
    title: string,
    message: string,
    relatedRecordId?: string,
    relatedRecordType?: string,
  ) {
    const notif = this.notifRepo.create({
      recipientId,
      alertType,
      title,
      message,
      relatedRecordId,
      relatedRecordType,
    });
    return this.notifRepo.save(notif);
  }
}
