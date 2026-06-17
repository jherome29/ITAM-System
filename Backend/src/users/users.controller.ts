import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
  ResetPasswordDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';

// SVC: Plan — user account management
// All routes: SYSTEM_ADMIN only (except GET list which also allows MANAGEMENT read)

@Controller('v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  /** GET /api/v1/users — All users paginated */
  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 50) {
    const result = await this.svc.findAll(+page, +limit);
    return { message: 'Users retrieved', data: result };
  }

  /** GET /api/v1/users/:id */
  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.svc.findOne(id);
    return { message: 'User retrieved', data: user };
  }

  /** POST /api/v1/users — Create user account (Admin only) */
  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.svc.create(dto);
    return { message: 'User account created', data: user };
  }

  /** PATCH /api/v1/users/:id — Update profile fields */
  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.svc.update(id, dto);
    return { message: 'User updated', data: user };
  }

  /** PATCH /api/v1/users/:id/role — Assign role */
  @Patch(':id/role')
  @Roles(UserRole.SYSTEM_ADMIN)
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    const user = await this.svc.assignRole(id, dto);
    return { message: `Role assigned: ${dto.role}`, data: user };
  }

  /** PATCH /api/v1/users/:id/reset-password — Reset password and unlock account */
  @Patch(':id/reset-password')
  @Roles(UserRole.SYSTEM_ADMIN)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    const result = await this.svc.resetPassword(id, dto);
    return { message: result.message, data: null };
  }

  /** PATCH /api/v1/users/:id/unlock — Unlock a locked account */
  @Patch(':id/unlock')
  @Roles(UserRole.SYSTEM_ADMIN)
  async unlock(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.svc.unlock(id);
    return { message: result.message, data: null };
  }

  /** PATCH /api/v1/users/:id/deactivate — Deactivate (no deletion) */
  @Patch(':id/deactivate')
  @Roles(UserRole.SYSTEM_ADMIN)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.svc.deactivate(id);
    return { message: result.message, data: null };
  }
}
