import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
  ResetPasswordDto,
} from './dto/user.dto';
import { UserRole } from '../../../packages/shared/src/enums';
import { BCRYPT_ROUNDS } from '../../../packages/shared/src/constants';

// SVC: Plan — user account management (System Admin only)

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findAll(page = 1, limit = 50, search?: string) {
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

  async create(dto: CreateUserDto): Promise<UserEntity> {
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
    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.findOne(id);
    await this.userRepo.update(id, dto);
    return this.findOne(id);
  }

  async assignRole(id: string, dto: AssignRoleDto): Promise<UserEntity> {
    await this.findOne(id);
    await this.userRepo.update(id, { role: dto.role });
    return this.findOne(id);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(id, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: user.tokenVersion + 1,
    });
    return { message: 'Password reset successfully' };
  }

  async unlock(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.userRepo.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return { message: `Account ${user.employeeId} unlocked` };
  }

  /**
   * Deactivate — NEVER delete.
   * Deletion would break the audit trail referencing this user.
   * SVC: Plan — account lifecycle management
   */
  async deactivate(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    if (!user.isActive) {
      throw new NotFoundException(`User "${id}" is already inactive`);
    }
    await this.userRepo.update(id, { isActive: false });
    return {
      message: `User ${user.employeeId} (${user.firstName} ${user.lastName}) deactivated`,
    };
  }
}
