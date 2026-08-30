import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../../packages/shared/src/enums';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  employeeId!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column()
  division!: string;

  @Column()
  officeOrSection!: string;

  @Column({ default: 0 })
  failedLoginAttempts!: number;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  lockedUntil!: Date | null;

  @Column({ default: true })
  isActive!: boolean;

  // Incremented on every successful login — invalidates all previously issued JWTs
  @Column({ default: 0 })
  tokenVersion!: number;

  // Alternate Approver (CLAUDE.md §5, §17). Only meaningful on SUPERVISOR rows.
  // Points at another active SUPERVISOR who receives this supervisor's approvals
  // while they are unavailable. Plain uuid, resolved via UsersService.findOne
  // (UserEntity carries no relations by design).
  @Column({ type: 'uuid', nullable: true })
  alternateApproverId!: string | null;

  // Manual availability switch. "Currently unavailable" is computed at read time
  // by UsersService.isUnavailable() — no cron clears the flag.
  @Column({ type: 'boolean', default: false })
  unavailable!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  unavailableUntil!: Date | null;

  // Refresh token — stored as bcrypt hash, single-use rotation (SECURITY.md §4.4)
  @Column({ type: 'varchar', nullable: true, select: false })
  refreshTokenHash!: string | null;

  @Column({ nullable: true, type: 'timestamp with time zone' })
  refreshTokenExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
