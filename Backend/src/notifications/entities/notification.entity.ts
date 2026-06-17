import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { NotificationAlertType } from '../../../../packages/shared/src/enums';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient!: UserEntity;

  @Column({ type: 'enum', enum: NotificationAlertType })
  alertType!: NotificationAlertType;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ nullable: true, type: 'uuid' })
  relatedRecordId!: string;

  @Column({ nullable: true })
  relatedRecordType!: string;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
