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
  AssetType,
} from '../../../packages/shared/src/enums';
import { SLA_APPROVAL_HOURS } from '../../../packages/shared/src/constants';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';

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
  // Optional `statusFilter` narrows within the role-allowed set.
  async findAll(
    requestingUserId: string,
    requestingRole: UserRole,
    page = 1,
    limit = 20,
    statusFilter?: string,
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
        }).andWhere(
          // Filtering the joined `items` alias directly would constrain what
          // leftJoinAndSelect('r.items', 'items') hydrates (silently hiding
          // non-matching sibling items) and would skew skip/take pagination,
          // since a multi-item requisition yields multiple raw rows before
          // TypeORM re-collapses them. An EXISTS subquery instead filters
          // which requisitions (the `r` side) match, leaving `items` hydration
          // and pagination untouched — same shape as the `r.status` filter above.
          'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type = :itScope)',
          { itScope: AssetType.ICT },
        );
        break;
      case UserRole.PROPERTY_CUSTODIAN:
        qb.where('r.status IN (:...statuses)', {
          statuses: [
            RequisitionStatus.PENDING_FULFILLMENT,
            RequisitionStatus.ON_HOLD,
          ],
        }).andWhere(
          'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type IN (:...pcScope))',
          { pcScope: resolveAssetTypeScope(UserRole.PROPERTY_CUSTODIAN) },
        );
        break;
      case UserRole.PROPERTY_OFFICER:
        qb.andWhere(
          'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type IN (:...poScope))',
          { poScope: resolveAssetTypeScope(UserRole.PROPERTY_OFFICER) },
        );
        break;
      // SYSTEM_ADMIN and MANAGEMENT see all
    }

    if (statusFilter) {
      qb.andWhere('r.status = :sf', { sf: statusFilter.toLowerCase() });
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

  // ── Requisition stats — dashboard counts in flat shape matching frontend ────
  // SVC: Improve — personal requisition status overview
  async getStats(
    userId: string,
    userRole: UserRole,
  ): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    fulfilled: number;
    onHold: number;
  }> {
    // For employees/supervisors: count their own requisitions by status
    // For IT/Admin/Mgmt: count all requisitions by status
    const qb = this.reqRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status');

    if (userRole === UserRole.EMPLOYEE || userRole === UserRole.SUPERVISOR) {
      qb.where('r.requestedById = :userId', { userId });
    }

    // Scope to the caller's asset-type custody, mirroring findAll()'s
    // EXISTS-subquery pattern (same join shape used there for
    // IT_PERSONNEL/PROPERTY_CUSTODIAN/PROPERTY_OFFICER). SYSTEM_ADMIN and
    // MANAGEMENT get undefined back from resolveAssetTypeScope and stay
    // unscoped, matching findAll()'s "see all" behavior for those roles.
    const assetTypeScope = resolveAssetTypeScope(userRole);
    if (assetTypeScope && assetTypeScope.length > 0) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM requisition_items ri WHERE ri.requisition_id = r.id AND ri.asset_type IN (:...statsScope))',
        { statsScope: assetTypeScope },
      );
    }

    const rows = await qb.getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    rows.forEach((r) => {
      byStatus[r.status] = Number.parseInt(r.count, 10);
    });

    const total = Object.values(byStatus).reduce((s, c) => s + c, 0);

    return {
      total,
      pending:
        (byStatus[RequisitionStatus.PENDING_SUPERVISOR] ?? 0) +
        (byStatus[RequisitionStatus.PENDING_FULFILLMENT] ?? 0),
      approved: byStatus[RequisitionStatus.PENDING_FULFILLMENT] ?? 0,
      rejected: byStatus[RequisitionStatus.REJECTED] ?? 0,
      fulfilled: byStatus[RequisitionStatus.FULFILLED] ?? 0,
      onHold: byStatus[RequisitionStatus.ON_HOLD] ?? 0,
    };
  }

  // ── Single requisition with full approval timeline ─────────────────────────
  async findOne(
    id: string,
    requestingUserId?: string,
    requestingRole?: UserRole,
  ): Promise<RequisitionEntity & { approvals: RequisitionApprovalEntity[] }> {
    const req = await this.reqRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!req) throw new NotFoundException(`Requisition "${id}" not found`);

    // IDOR guard — Employees may only view their own requisitions (OWASP ASVS 4.2.1)
    if (
      requestingRole === UserRole.EMPLOYEE &&
      req.requestedById !== requestingUserId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this requisition',
      );
    }

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
    // Resolve the requester's own Supervisor server-side — per CLAUDE.md §6
    // requesters do not nominate an approver, the org chart (division /
    // officeOrSection) determines it. Without this, supervisorId stays null
    // forever and the Supervisor's pending-approvals queue is always empty
    // (findAll() filters on r.supervisorId = :id).
    const requester = await this.usersService.findOne(requestedById);
    const supervisor = await this.usersService.findSupervisorForSection(
      requester.officeOrSection,
      requester.division,
    );
    if (!supervisor) {
      throw new BadRequestException(
        'No supervisor is configured for your section — contact your System Administrator.',
      );
    }

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
      supervisorId: supervisor.id,
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

    // Notify the resolved supervisor
    await this.notificationsService.notify(
      supervisor.id,
      NotificationAlertType.PENDING_APPROVAL,
      'New Requisition Awaiting Approval',
      `Requisition ${requestNumber} requires your approval. Required by: ${dto.requiredDate}.`,
      saved.id,
      'requisition',
    );

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

    // SYSTEM_ADMIN is permitted by the controller's @Roles guard to approve
    // on any supervisor's behalf — skip the ownership check for that role.
    if (
      userRole !== UserRole.SYSTEM_ADMIN &&
      req.supervisorId &&
      req.supervisorId !== supervisorId
    ) {
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

    // Same ownership guard as approve() — a Supervisor may only reject the
    // requisitions nominated to them; SYSTEM_ADMIN bypasses per the
    // controller's @Roles guard.
    if (
      userRole !== UserRole.SYSTEM_ADMIN &&
      req.supervisorId &&
      req.supervisorId !== supervisorId
    ) {
      throw new ForbiddenException(
        'You are not the designated supervisor for this requisition.',
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

  // ── Scope guard for whole-requisition status transitions (fulfill/hold) ───
  // NOTE — this is deliberately STRICTER than findAll()'s visibility rule,
  // and deliberately asymmetric with it. Do not "harmonize" the two:
  //   - findAll() is read-only and uses an inclusive "ANY item matches scope"
  //     rule, so a caller with a partial interest in a mixed requisition can
  //     still see it in their queue.
  //   - fulfill()/putOnHold() perform a whole-requisition status transition —
  //     RequisitionStatus has no partial-fulfillment state — so authorization
  //     here must be conjunctive: EVERY item on the requisition must be
  //     within the caller's asset-type scope, or the transition is rejected.
  //     Otherwise a caller could fulfill/hold (and thus control the fate of)
  //     line items outside their custodial authority just because one item
  //     on the same requisition happened to be in scope.
  //
  // Known, accepted, currently-dormant limitation: under this rule a
  // genuinely mixed-assetType requisition (e.g. one ICT item + one Fixed
  // item) becomes fulfillable by no one, since SYSTEM_ADMIN/MANAGEMENT are
  // not on the fulfill/hold guard lists either. This is unreachable today —
  // the real requisition-submission form only ever submits a single line
  // item — so it's a real but dormant gap, not fixed here. Candidate future
  // fixes: a partial-fulfillment status, per-item fulfillment, or create-time
  // validation that all items on one requisition share a single custodial
  // scope.
  private assertItemsInScope(req: RequisitionEntity, userRole: UserRole): void {
    const scope = resolveAssetTypeScope(userRole);
    if (!scope) return; // unscoped role — nothing to enforce
    const outOfScope = req.items.filter(
      (item) => !scope.includes(item.assetType),
    );
    if (outOfScope.length > 0) {
      throw new ForbiddenException(
        `Cannot act on requisition "${req.requestNumber}": item(s) ` +
          `[${outOfScope.map((item) => item.itemDescription).join(', ')}] ` +
          `fall outside your permitted asset-type scope [${scope.join(', ')}]`,
      );
    }
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
    this.assertItemsInScope(req, userRole);

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
    this.assertItemsInScope(req, userRole);

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
