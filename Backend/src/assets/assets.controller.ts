import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthenticatedRequest {
  user: UserEntity;
  ip: string;
}

// SVC: Obtain/Build & Deliver and Support — asset registry and lifecycle management
// Primary role: IT Personnel. Read access: Admin, Management.

@Controller('v1/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  /**
   * GET /api/v1/assets
   * Full inventory list — paginated.
   * Roles: IT Personnel, System Admin, Management
   */
  @Get()
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    const result = await this.assetsService.findAll(+page, +limit);
    return { message: 'Assets retrieved successfully', data: result };
  }

  /**
   * GET /api/v1/assets/catalogue
   * Available assets only — for Employee/Supervisor browse.
   * Roles: Employee, Supervisor, IT Personnel
   */
  @Get('catalogue')
  @Roles(UserRole.EMPLOYEE, UserRole.SUPERVISOR, UserRole.IT_PERSONNEL)
  async findCatalogue(@Query('page') page = 1, @Query('limit') limit = 20) {
    const result = await this.assetsService.findCatalogue(+page, +limit);
    return { message: 'Available assets retrieved', data: result };
  }

  /**
   * GET /api/v1/assets/stats
   * Grouped asset counts by status, class, and type.
   * Powers the IT Personnel and Management dashboards.
   * Roles: IT Personnel, System Admin, Management
   */
  @Get('stats')
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async getStats() {
    const result = await this.assetsService.getStats();
    return { message: 'Asset statistics retrieved', data: result };
  }

  /**
   * GET /api/v1/assets/:id
   * Single asset with full lifecycle history.
   * Roles: IT Personnel, System Admin, Management
   */
  @Get(':id')
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const asset = await this.assetsService.findOne(id);
    return { message: 'Asset retrieved successfully', data: asset };
  }

  /**
   * POST /api/v1/assets
   * Register a new asset with all required CICC fields (section 5.3).
   * Roles: IT Personnel only
   * SVC: Obtain/Build
   */
  @Post()
  @Roles(UserRole.IT_PERSONNEL)
  async create(@Body() dto: CreateAssetDto, @Req() req: AuthenticatedRequest) {
    const asset = await this.assetsService.create(
      dto,
      req.user.id,
      req.user.role,
      req.ip,
    );
    return { message: 'Asset registered successfully', data: asset };
  }

  /**
   * PATCH /api/v1/assets/:id
   * Update editable asset fields. Does NOT change lifecycle status.
   * Roles: IT Personnel only
   */
  @Patch(':id')
  @Roles(UserRole.IT_PERSONNEL)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const asset = await this.assetsService.update(
      id,
      dto,
      req.user.id,
      req.user.role,
      req.ip,
    );
    return { message: 'Asset updated successfully', data: asset };
  }

  /**
   * PATCH /api/v1/assets/:id/lifecycle
   * Update asset lifecycle status.
   * State machine enforced — invalid transitions return 400.
   * Every change generates an audit log entry.
   * Roles: IT Personnel only
   * SVC: Deliver and Support
   *
   * Valid transitions (CLAUDE.md section 5.4):
   *   registered  → available
   *   available   → issued | transferred | under_repair | flagged_for_disposal
   *   issued      → returned | under_repair | flagged_for_disposal
   *   returned    → available | under_repair
   *   transferred → available
   *   under_repair→ available | flagged_for_disposal
   *   flagged_for_disposal → disposed
   *   disposed    → (terminal — no transitions)
   */
  @Patch(':id/lifecycle')
  @Roles(UserRole.IT_PERSONNEL)
  async updateLifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLifecycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const asset = await this.assetsService.updateLifecycle(
      id,
      dto,
      req.user.id,
      req.user.role,
      req.ip,
    );
    return {
      message: `Asset status updated to "${dto.status}"`,
      data: asset,
    };
  }

  /**
   * POST /api/v1/assets/:id/qr
   * Generate QR code and barcode identifiers for the asset.
   * Roles: IT Personnel only
   * SVC: Obtain/Build
   */
  @Post(':id/qr')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL)
  async generateQr(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.assetsService.generateQr(
      id,
      req.user.id,
      req.user.role,
      req.ip,
    );
    return { message: 'QR code generated successfully', data: result };
  }
}
