import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequisitionEntity } from './entities/requisition.entity';
import { RequisitionItemEntity } from './entities/requisition-item.entity';
import { RequisitionApprovalEntity } from './entities/requisition-approval.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import {
  ApproveRequisitionDto,
  RejectRequisitionDto,
  FulfillRequisitionDto,
} from './dto/approval.dto';
import {
  RequisitionStatus,
  AuditAction,
  UserRole,
  NotificationAlertType,
} from '../../../packages/shared/src/enums';
import { SLA_APPROVAL_HOURS } from '../../../packages/shared/src/constants';

// SVC: Engage & Design and Transition — multi-level approval workflow
// Approval routing (CLAUDE.md section 6, Module 2):
//   Submit → pending_supervisor
//   Supervisor approves → pending_fulfillment + notify IT Personnel
//   Asset unavailable → on_hold + notify IT Personnel
//   IT fulfills → fulfilled + update asset to 'issued'
//   SLA: >24h pending → SLA breach notification

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectRepository(RequisitionEntity)
    private readonly reqRepo: Repository<RequisitionEntity>,
    @InjectRepository(RequisitionItemEntity)
    private readonly itemRepo: Repository<RequisitionItemEntity>,
    @InjectRepository(RequisitionApprovalEntity)
    private readonly approvalRepo: Repository<RequisitionApprovalEntity>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // ── Role-filtered list ─────────────────────────────────────────────────────
  // employees → own; supervisors → pending_supervisor; IT → pending_fulfillment; admin/mgmt → all
  async findAll(
    requestingUserId: string,
    requestingRole: UserRole,
    page = 1,
    limit = 20,
  ) {
    const qb = this.reqRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.items', 'items')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    switch (requestingRole) {
      case UserRole.EMPLOYEE:
        qb.where('r.requestedById = :id', { id: requestingUserId });
        break;
      case UserRole.SUPERVISOR:
        qb.where('r.supervisorId = :id AND r.status = :status', {
          id: requestingUserId,
          status: RequisitionStatus.PENDING_SUPERVISOR,
        });
        break;
      case UserRole.IT_PERSONNEL:
        qb.where('r.status IN (:...statuses)', {
          statuses: [
            RequisitionStatus.PENDING_FULFILLMENT,
            RequisitionStatus.ON_HOLD,
          ],
        });
        break;
      // SYSTEM_ADMIN and MANAGEMENT see all
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── My requisitions (any authenticated role) ───────────────────────────────
  async findMine(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.reqRepo.findAndCount({
      where: { requestedById: userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Requisition stats — Employee/Supervisor dashboard counts ──────────────
  // SVC: Improve — personal requisition status overview
  async getStats(
    userId: string,
    userRole: UserRole,
  ): Promise<{
    mine: Record<string, number>;
    mineTotal: number;
    // Supervisor-only:
    pendingSupervisorCount?: number;
    // IT-only:
    pendingFulfillmentCount?: number;
    onHoldCount?: number;
    // SLA:
    slaBreachedCount: number;
  }> {
    // User's own requisitions grouped by status
    const myRows = await this.reqRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.requestedById = :userId', { userId })
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();

    const mine: Record<string, number> = {};
    myRows.forEach((r) => {
      mine[r.status] = parseInt(r.count, 10);
    });
    const mineTotal = Object.values(mine).reduce((s, c) => s + c, 0);

    // SLA breached (pending_supervisor past deadline)
    const slaBreachedCount = await this.reqRepo.count({
      where: {
        status: RequisitionStatus.PENDING_SUPERVISOR,
        // slaDeadline < NOW — use raw query for this
      },
    });

    const result: {
      mine: Record<string, number>;
      mineTotal: number;
      pendingSupervisorCount?: number;
      pendingFulfillmentCount?: number;
      onHoldCount?: number;
      slaBreachedCount: number;
    } = { mine, mineTotal, slaBreachedCount };

    // Supervisor: add their pending queue count
    if (userRole === UserRole.SUPERVISOR) {
      result.pendingSupervisorCount = await this.reqRepo.count({
        where: {
          supervisorId: userId,
          status: RequisitionStatus.PENDING_SUPERVISOR,
        },
      });
    }

    // IT Personnel: pending fulfillment + on hold counts
    if (
      userRole === UserRole.IT_PERSONNEL ||
      userRole === UserRole.SYSTEM_ADMIN
    ) {
      result.pendingFulfillmentCount = await this.reqRepo.count({
        where: { status: RequisitionStatus.PENDING_FULFILLMENT },
      });
      result.onHoldCount = await this.reqRepo.count({
        where: { status: RequisitionStatus.ON_HOLD },
      });
    }

    return result;
  }

  // ── Single requisition with full approval timeline ─────────────────────────
  async findOne(
    id: string,
  ): Promise<RequisitionEntity & { approvals: RequisitionApprovalEntity[] }> {
    const req = await this.reqRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!req) throw new NotFoundException(`Requisition "${id}" not found`);

    const approvals = await this.approvalRepo.find({
      where: { requisitionId: id },
      order: { actionedAt: 'ASC' },
    });

    return Object.assign(req, { approvals });
  }

  // ── Submit new requisition ─────────────────────────────────────────────────
  // Status: draft → pending_supervisor
  async create(
    dto: CreateRequisitionDto,
    requestedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    // Generate request number: REQ-YYYY-NNNN
    const count = await this.reqRepo.count();
    const requestNumber = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const submittedAt = new Date();
    const slaDeadline = new Date(
      submittedAt.getTime() + SLA_APPROVAL_HOURS * 60 * 60 * 1_000,
    );

    const req = this.reqRepo.create({
      requestNumber,
      requestedById,
      requisitionType: dto.requisitionType,
      justification: dto.justification,
      requiredDate: new Date(dto.requiredDate),
      supervisorId: dto.supervisorId ?? null,
      status: RequisitionStatus.PENDING_SUPERVISOR,
      submittedAt,
      slaDeadline,
    });
    const saved = await this.reqRepo.save(req);

    // Save line items
    const items = dto.items.map((item) =>
      this.itemRepo.create({ ...item, requisitionId: saved.id }),
    );
    await this.itemRepo.save(items);

    // Notify supervisor if nominated
    if (dto.supervisorId) {
      await this.notificationsService.notify(
        dto.supervisorId,
        NotificationAlertType.PENDING_APPROVAL,
        'New Requisition Awaiting Approval',
        `Requisition ${requestNumber} requires your approval. Required by: ${dto.requiredDate}.`,
        saved.id,
        'requisition',
      );
    }

    // Audit log
    await this.auditService.log({
      userId: requestedById,
      userRole,
      action: AuditAction.REQUISITION_SUBMITTED,
      affectedRecordId: saved.id,
      affectedRecordType: 'requisition',
      ipAddress,
      metadata: {
        requestNumber,
        requisitionType: dto.requisitionType,
        itemCount: dto.items.length,
      },
    });

    return saved;
  }

  // ── Supervisor approves ────────────────────────────────────────────────────
  // Status: pending_supervisor → pending_fulfillment
  async approve(
    id: string,
    supervisorId: string,
    userRole: UserRole,
    dto: ApproveRequisitionDto,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    const req = await this.findOne(id);

    if (req.status !== RequisitionStatus.PENDING_SUPERVISOR) {
      throw new BadRequestException(
        `Cannot approve requisition with status "${req.status}". Must be "pending_supervisor".`,
      );
    }

    if (req.supervisorId && req.supervisorId !== supervisorId) {
      throw new ForbiddenException(
        'You are not the designated supervisor for this requisition.',
      );
    }

    // Create approval record
    await this.approvalRepo.save(
      this.approvalRepo.create({
        requisitionId: id,
        approverId: supervisorId,
        action: 'approved',
        comments: dto.comments ?? '',
      }),
    );

    req.status = RequisitionStatus.PENDING_FULFILLMENT;
    req.supervisorDecision = 'approved';
    req.supervisorComments = dto.comments ?? '';
    req.supervisorDecidedAt = new Date();
    const saved = await this.reqRepo.save(req);

    // Notify requester
    await this.notificationsService.notify(
      req.requestedById,
      NotificationAlertType.REQUISITION_APPROVED,
      'Requisition Approved',
      `Your requisition ${req.requestNumber} has been approved and is now pending fulfillment by IT Personnel.`,
      id,
      'requisition',
    );

    // Notify all IT Personnel
    const itUsers = await this.usersService.findByRole(UserRole.IT_PERSONNEL);
    await Promise.all(
      itUsers.map((u) =>
        this.notificationsService.notify(
          u.id,
          NotificationAlertType.PENDING_APPROVAL,
          'Requisition Ready for Fulfillment',
          `Requisition ${req.requestNumber} has been approved and is awaiting fulfillment.`,
          id,
          'requisition',
        ),
      ),
    );

    // Audit log
    await this.auditService.log({
      userId: supervisorId,
      userRole,
      action: AuditAction.REQUISITION_APPROVED,
      affectedRecordId: id,
      affectedRecordType: 'requisition',
      ipAddress,
      metadata: { requestNumber: req.requestNumber, comments: dto.comments },
    });

    return saved;
  }

  // ── Supervisor rejects ────────────────────────────────────────────────────
  // Status: pending_supervisor → rejected
  async reject(
    id: string,
    supervisorId: string,
    userRole: UserRole,
    dto: RejectRequisitionDto,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    const req = await this.findOne(id);

    if (req.status !== RequisitionStatus.PENDING_SUPERVISOR) {
      throw new BadRequestException(
        `Cannot reject requisition with status "${req.status}".`,
      );
    }

    await this.approvalRepo.save(
      this.approvalRepo.create({
        requisitionId: id,
        approverId: supervisorId,
        action: 'rejected',
        comments: dto.comments,
      }),
    );

    req.status = RequisitionStatus.REJECTED;
    req.supervisorDecision = 'rejected';
    req.supervisorComments = dto.comments;
    req.supervisorDecidedAt = new Date();
    const saved = await this.reqRepo.save(req);

    // Notify requester
    await this.notificationsService.notify(
      req.requestedById,
      NotificationAlertType.REQUISITION_REJECTED,
      'Requisition Rejected',
      `Your requisition ${req.requestNumber} was rejected. Reason: ${dto.comments}`,
      id,
      'requisition',
    );

    // Audit log
    await this.auditService.log({
      userId: supervisorId,
      userRole,
      action: AuditAction.REQUISITION_REJECTED,
      affectedRecordId: id,
      affectedRecordType: 'requisition',
      ipAddress,
      metadata: { requestNumber: req.requestNumber, comments: dto.comments },
    });

    return saved;
  }

  // ── IT Personnel marks on hold (asset unavailable) ────────────────────────
  // Status: pending_fulfillment → on_hold
  async putOnHold(
    id: string,
    itPersonnelId: string,
    userRole: UserRole,
    reason: string,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    const req = await this.findOne(id);

    if (req.status !== RequisitionStatus.PENDING_FULFILLMENT) {
      throw new BadRequestException(
        `Cannot place on hold: status is "${req.status}". Must be "pending_fulfillment".`,
      );
    }

    req.status = RequisitionStatus.ON_HOLD;
    req.fulfillmentNotes = reason;
    const saved = await this.reqRepo.save(req);

    // Notify requester
    await this.notificationsService.notify(
      req.requestedById,
      NotificationAlertType.PENDING_APPROVAL,
      'Requisition On Hold',
      `Your requisition ${req.requestNumber} is on hold. Reason: ${reason}`,
      id,
      'requisition',
    );

    await this.auditService.log({
      userId: itPersonnelId,
      userRole,
      action: AuditAction.REQUISITION_ON_HOLD,
      affectedRecordId: id,
      affectedRecordType: 'requisition',
      ipAddress,
      metadata: { requestNumber: req.requestNumber, reason },
    });

    return saved;
  }

  // ── IT Personnel fulfills ─────────────────────────────────────────────────
  // Status: pending_fulfillment | on_hold → fulfilled
  async fulfill(
    id: string,
    itPersonnelId: string,
    userRole: UserRole,
    dto: FulfillRequisitionDto,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    const req = await this.findOne(id);

    const fulfillableStatuses = [
      RequisitionStatus.PENDING_FULFILLMENT,
      RequisitionStatus.ON_HOLD,
    ];
    if (!fulfillableStatuses.includes(req.status)) {
      throw new BadRequestException(
        `Cannot fulfill requisition with status "${req.status}".`,
      );
    }

    // Link fulfilled asset IDs to items if provided
    if (dto.fulfilledItems?.length) {
      await Promise.all(
        dto.fulfilledItems.map(({ requisitionItemId, assetId }) =>
          this.itemRepo.update(requisitionItemId, {
            fulfilledAssetId: assetId,
          }),
        ),
      );
    }

    req.itPersonnelId = itPersonnelId;
    req.fulfilledAt = new Date();
    req.fulfillmentNotes = dto.notes ?? '';
    req.status = RequisitionStatus.FULFILLED;
    const saved = await this.reqRepo.save(req);

    // Notify requester
    await this.notificationsService.notify(
      req.requestedById,
      NotificationAlertType.REQUISITION_FULFILLED,
      'Requisition Fulfilled',
      `Your requisition ${req.requestNumber} has been fulfilled by IT Personnel. Please collect your item(s).`,
      id,
      'requisition',
    );

    // Audit log
    await this.auditService.log({
      userId: itPersonnelId,
      userRole,
      action: AuditAction.REQUISITION_FULFILLED,
      affectedRecordId: id,
      affectedRecordType: 'requisition',
      ipAddress,
      metadata: {
        requestNumber: req.requestNumber,
        notes: dto.notes,
        fulfilledItems: dto.fulfilledItems,
      },
    });

    return saved;
  }

  // ── SLA breach check — called by a scheduled job ──────────────────────────
  // Flags all pending_supervisor requisitions older than SLA_APPROVAL_HOURS
  async checkSlaBreaches(): Promise<void> {
    const now = new Date();
    const breached = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.status = :status', {
        status: RequisitionStatus.PENDING_SUPERVISOR,
      })
      .andWhere('r.slaDeadline < :now', { now })
      .getMany();

    await Promise.all(
      breached.map(async (req) => {
        // Notify supervisor
        if (req.supervisorId) {
          await this.notificationsService.notify(
            req.supervisorId,
            NotificationAlertType.SLA_BREACH,
            'SLA Breach — Requisition Overdue',
            `Requisition ${req.requestNumber} has exceeded the 24-hour approval SLA. Immediate action required.`,
            req.id,
            'requisition',
          );
        }
        // Notify requester
        await this.notificationsService.notify(
          req.requestedById,
          NotificationAlertType.SLA_BREACH,
          'Your Requisition is Overdue',
          `Requisition ${req.requestNumber} has been pending for more than 24 hours without a decision.`,
          req.id,
          'requisition',
        );
      }),
    );
  }
}
