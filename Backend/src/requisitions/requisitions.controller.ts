import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import {
  ApproveRequisitionDto,
  RejectRequisitionDto,
  FulfillRequisitionDto,
} from './dto/approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthReq {
  user: UserEntity;
  ip: string;
}

// SVC: Engage & Design and Transition — requisition lifecycle

@Controller('v1/requisitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequisitionsController {
  constructor(private readonly svc: RequisitionsService) {}

  /**
   * GET /api/v1/requisitions
   * Role-filtered:
   *   EMPLOYEE       → own requisitions
   *   SUPERVISOR     → pending_supervisor assigned to them
   *   IT_PERSONNEL   → pending_fulfillment + on_hold
   *   ADMIN/MGMT     → all
   */
  @Get()
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.SUPERVISOR,
    UserRole.IT_PERSONNEL,
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGEMENT,
  )
  async findAll(
    @Req() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    const result = await this.svc.findAll(
      req.user.id,
      req.user.role,
      +page,
      +limit,
      status,
    );
    return { message: 'Requisitions retrieved', data: result };
  }

  /**
   * GET /api/v1/requisitions/mine
   * All of the authenticated user's own requisitions (any role).
   */
  @Get('mine')
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.SUPERVISOR,
    UserRole.IT_PERSONNEL,
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGEMENT,
  )
  async findMine(
    @Req() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.svc.findMine(req.user.id, +page, +limit);
    return { message: 'My requisitions retrieved', data: result };
  }

  /**
   * GET /api/v1/requisitions/stats
   * Per-user counts by status + role-specific extras.
   * Employee → own counts. Supervisor → + pending queue. IT → + fulfillment queue.
   */
  @Get('stats')
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.SUPERVISOR,
    UserRole.IT_PERSONNEL,
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGEMENT,
  )
  async getStats(@Req() req: AuthReq) {
    const result = await this.svc.getStats(req.user.id, req.user.role);
    return { message: 'Requisition statistics retrieved', data: result };
  }

  /**
   * GET /api/v1/requisitions/:id
   * Full detail including approval timeline.
   */
  @Get(':id')
  @Roles(
    UserRole.EMPLOYEE,
    UserRole.SUPERVISOR,
    UserRole.IT_PERSONNEL,
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGEMENT,
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.svc.findOne(id);
    return { message: 'Requisition retrieved', data: result };
  }

  /**
   * POST /api/v1/requisitions
   * Submit a new requisition — Employee, Supervisor, IT Personnel
   * Status on creation: pending_supervisor
   */
  @Post()
  @Roles(UserRole.EMPLOYEE, UserRole.SUPERVISOR, UserRole.IT_PERSONNEL)
  async create(@Body() dto: CreateRequisitionDto, @Req() req: AuthReq) {
    const result = await this.svc.create(
      dto,
      req.user.id,
      req.user.role,
      req.ip,
    );
    return {
      message: `Requisition ${result.requestNumber} submitted successfully`,
      data: result,
    };
  }

  /**
   * POST /api/v1/requisitions/:id/approve
   * Supervisor approves → status: pending_fulfillment
   * Notifies requester + all IT Personnel
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRequisitionDto,
    @Req() req: AuthReq,
  ) {
    const result = await this.svc.approve(
      id,
      req.user.id,
      req.user.role,
      dto,
      req.ip,
    );
    return { message: 'Requisition approved', data: result };
  }

  /**
   * POST /api/v1/requisitions/:id/reject
   * Supervisor rejects → status: rejected
   * Comments required. Notifies requester.
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequisitionDto,
    @Req() req: AuthReq,
  ) {
    const result = await this.svc.reject(
      id,
      req.user.id,
      req.user.role,
      dto,
      req.ip,
    );
    return { message: 'Requisition rejected', data: result };
  }

  /**
   * POST /api/v1/requisitions/:id/hold
   * IT Personnel flags asset unavailable → status: on_hold
   * Notifies requester.
   */
  @Post(':id/hold')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL)
  async putOnHold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthReq,
  ) {
    const result = await this.svc.putOnHold(
      id,
      req.user.id,
      req.user.role,
      reason,
      req.ip,
    );
    return { message: 'Requisition placed on hold', data: result };
  }

  /**
   * POST /api/v1/requisitions/:id/fulfill
   * IT Personnel fulfills → status: fulfilled
   * Links asset IDs to line items. Notifies requester.
   */
  @Post(':id/fulfill')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL)
  async fulfill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfillRequisitionDto,
    @Req() req: AuthReq,
  ) {
    const result = await this.svc.fulfill(
      id,
      req.user.id,
      req.user.role,
      dto,
      req.ip,
    );
    return { message: 'Requisition fulfilled successfully', data: result };
  }
}
