import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
  ResetPasswordDto,
  AvailabilityDto,
} from './dto/user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../../packages/shared/src/constants';

// SVC: Plan — user account management (System Admin only)

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(page = 1, limit = 50, search?: string, role?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('u.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      const q = `%${search}%`;
      qb.where(
        '(LOWER(u.firstName) LIKE LOWER(:q) OR LOWER(u.lastName) LIKE LOWER(:q) OR LOWER(u.email) LIKE LOWER(:q) OR LOWER(u.employeeId) LIKE LOWER(:q))',
        { q },
      );
    }

    // Server-side role filter — callers that only want one role (e.g. the
    // alternate-approver picker fetching supervisors) must not paginate past
    // CICC's ~362 personnel to find them.
    if (role) {
      qb.andWhere('u.role = :role', { role });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User "${id}" not found`);
    return user;
  }

  async findByEmployeeId(employeeId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { employeeId } });
  }

  async findByRole(role: UserRole): Promise<UserEntity[]> {
    return this.userRepo.find({
      where: { role, isActive: true },
      order: { lastName: 'ASC' },
    });
  }

  /**
   * "Currently unavailable" — the flag is on AND (there is no end date, or the
   * end date is still in the future). Read-time computation: nothing clears the
   * flag automatically. Used by requisition routing (create + SLA watcher).
   */
  isUnavailable(user: UserEntity): boolean {
    if (!user.unavailable) return false;
    if (user.unavailableUntil === null || user.unavailableUntil === undefined) {
      return true;
    }
    return user.unavailableUntil.getTime() > Date.now();
  }

  /**
   * Resolve the Supervisor accountable for a requester's section, per
   * CLAUDE.md §6 ("Supervisor — reviews and approves/rejects requests from
   * their section"). Requesters never nominate their own approver — the org
   * chart determines it. Prefers an exact officeOrSection match; falls back
   * to any active Supervisor in the same division if no section match exists.
   */
  async findSupervisorForSection(
    officeOrSection: string,
    division: string,
  ): Promise<UserEntity | null> {
    const bySection = await this.userRepo.findOne({
      where: {
        role: UserRole.SUPERVISOR,
        officeOrSection,
        isActive: true,
      },
    });
    if (bySection) return bySection;

    return this.userRepo.findOne({
      where: {
        role: UserRole.SUPERVISOR,
        division,
        isActive: true,
      },
    });
  }

  async create(
    dto: CreateUserDto,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      employeeId: dto.employeeId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      role: dto.role,
      division: dto.division,
      officeOrSection: dto.officeOrSection,
    });
    const saved = await this.userRepo.save(user);

    // Every account creation must generate an audit log entry (CLAUDE.md section 8.3)
    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.USER_CREATED,
      affectedRecordId: saved.id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: {
        employeeId: saved.employeeId,
        role: saved.role,
      },
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<UserEntity> {
    const target = await this.findOne(id);

    const touchesApproval =
      dto.alternateApproverId !== undefined ||
      dto.unavailable !== undefined ||
      dto.unavailableUntil !== undefined;

    if (touchesApproval && target.role !== UserRole.SUPERVISOR) {
      throw new BadRequestException(
        'Alternate approver and availability apply only to supervisors.',
      );
    }

    if (dto.alternateApproverId != null) {
      if (dto.alternateApproverId === id) {
        throw new BadRequestException(
          'A supervisor cannot be their own alternate.',
        );
      }
      const alt = await this.userRepo.findOne({
        where: { id: dto.alternateApproverId },
      });
      if (!alt || !alt.isActive || alt.role !== UserRole.SUPERVISOR) {
        throw new BadRequestException(
          'Alternate approver must be an active supervisor.',
        );
      }
    }

    // Build the write set field-by-field — never spread the whole DTO.
    // `@IsOptional()` lets `null` past validation for `unavailable`, and a
    // spread would carry that `null` into the NOT NULL column (Postgres 500).
    // Copying only present-and-valid keys turns that into a clean 400.
    const patch: Record<string, unknown> = {};
    for (const k of [
      'firstName',
      'lastName',
      'email',
      'division',
      'officeOrSection',
      'alternateApproverId',
    ] as const) {
      if (dto[k] !== undefined) patch[k] = dto[k];
    }
    if (dto.unavailable !== undefined) {
      if (typeof dto.unavailable !== 'boolean') {
        throw new BadRequestException('unavailable must be true or false');
      }
      patch.unavailable = dto.unavailable;
    }
    if (dto.unavailableUntil !== undefined) {
      patch.unavailableUntil =
        dto.unavailableUntil === null ? null : new Date(dto.unavailableUntil);
    }
    await this.userRepo.update(id, patch);

    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.USER_UPDATED,
      affectedRecordId: id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: { updatedFields: Object.keys(dto) },
    });

    return this.findOne(id);
  }

  /**
   * Supervisor self-service availability toggle. Writes ONLY the availability
   * fields, ONLY on the caller's own row — it cannot reach alternateApproverId
   * or any other user. Audited as USER_UPDATED with a self marker.
   */
  async setOwnAvailability(
    userId: string,
    dto: AvailabilityDto,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<UserEntity> {
    await this.findOne(userId);

    await this.userRepo.update(userId, {
      unavailable: dto.unavailable,
      unavailableUntil:
        dto.unavailableUntil == null ? null : new Date(dto.unavailableUntil),
    });

    await this.auditService.log({
      userId,
      userRole,
      action: AuditAction.USER_UPDATED,
      affectedRecordId: userId,
      affectedRecordType: 'user',
      ipAddress,
      metadata: {
        self: true,
        unavailable: dto.unavailable,
        unavailableUntil: dto.unavailableUntil ?? null,
      },
    });

    return this.findOne(userId);
  }

  async assignRole(
    id: string,
    dto: AssignRoleDto,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<UserEntity> {
    const user = await this.findOne(id);
    const previousRole = user.role;
    await this.userRepo.update(id, { role: dto.role });

    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.ROLE_ASSIGNED,
      affectedRecordId: id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: { previousRole, newRole: dto.role },
    });

    return this.findOne(id);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const user = await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(id, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: user.tokenVersion + 1,
    });

    // NOTE: No dedicated AuditAction exists for password resets — reusing
    // USER_UPDATED with a metadata marker. Flagged for the team: consider
    // adding a PASSWORD_RESET value to AuditAction (packages/shared).
    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.USER_UPDATED,
      affectedRecordId: id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: { action: 'password_reset' },
    });

    return { message: 'Password reset successfully' };
  }

  async unlock(
    id: string,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.userRepo.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    // NOTE: No dedicated AuditAction exists for account unlocks — reusing
    // USER_UPDATED with a metadata marker. Flagged for the team: consider
    // adding an ACCOUNT_UNLOCKED value to AuditAction (packages/shared).
    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.USER_UPDATED,
      affectedRecordId: id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: { action: 'account_unlocked' },
    });

    return { message: `Account ${user.employeeId} unlocked` };
  }

  /**
   * Deactivate — NEVER delete.
   * Deletion would break the audit trail referencing this user.
   * SVC: Plan — account lifecycle management
   */
  async deactivate(
    id: string,
    performedById: string,
    performedByRole: UserRole,
    ipAddress: string,
  ): Promise<{ message: string }> {
    const user = await this.findOne(id);
    if (!user.isActive) {
      throw new NotFoundException(`User "${id}" is already inactive`);
    }
    await this.userRepo.update(id, { isActive: false });

    await this.auditService.log({
      userId: performedById,
      userRole: performedByRole,
      action: AuditAction.USER_DEACTIVATED,
      affectedRecordId: id,
      affectedRecordType: 'user',
      ipAddress,
      metadata: { employeeId: user.employeeId },
    });

    return {
      message: `User ${user.employeeId} (${user.firstName} ${user.lastName}) deactivated`,
    };
  }
}
