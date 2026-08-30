import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequisitionEntity } from './entities/requisition.entity';
import { RequisitionItemEntity } from './entities/requisition-item.entity';
import { RequisitionApprovalEntity } from './entities/requisition-approval.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetsService } from '../assets/assets.service';
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
  RequisitionType,
  AuditAction,
  UserRole,
  NotificationAlertType,
  AssetType,
  AssetClass,
  AssetCondition,
} from '../../../packages/shared/src/enums';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';
import { SystemConfigService } from '../system-config/system-config.service';

// SVC: Engage & Design and Transition — multi-level approval workflow
// Approval routing (CLAUDE.md section 6, Module 2):
//   Submit → pending_supervisor
//   Supervisor approves → pending_fulfillment + notify IT Personnel
//   Asset unavailable → on_hold + notify IT Personnel
//   IT fulfills → fulfilled + update asset to 'issued'
//   SLA: >24h pending → SLA breach notification

@Injectable()
export class RequisitionsService {
  private readonly logger = new Logger(RequisitionsService.name);

  constructor(
    @InjectRepository(RequisitionEntity)
    private readonly reqRepo: Repository<RequisitionEntity>,
    @InjectRepository(RequisitionItemEntity)
    private readonly itemRepo: Repository<RequisitionItemEntity>,
    @InjectRepository(RequisitionApprovalEntity)
    private readonly approvalRepo: Repository<RequisitionApprovalEntity>,
    @Inject(forwardRef(() => AssetsService))
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly systemConfig: SystemConfigService,
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
  /**
   * Replacement requisitions must be justified before they enter the approval
   * queue (CLAUDE.md §17). The requester must be the current custodian of the
   * named asset, and the asset must meet at least one criterion: its condition
   * is no longer serviceable, or it has passed the useful-life age for its
   * class. Returns which criterion was met, for the audit trail.
   */
  private async validateReplacement(
    replacedAssetId: string | undefined,
    requestedById: string,
  ): Promise<'condition' | 'useful_life'> {
    if (!replacedAssetId) {
      throw new BadRequestException(
        'A replacement requisition must identify the asset being replaced.',
      );
    }

    const asset = await this.assetsService.findOne(replacedAssetId);

    if (asset.custodianId !== requestedById) {
      throw new ForbiddenException(
        'You can only request a replacement for an asset currently assigned to you.',
      );
    }

    if (asset.condition !== AssetCondition.SERVICEABLE) {
      return 'condition';
    }

    const usefulLife = this.systemConfig.getUsefulLifeYears()[asset.assetClass];
    const ageYears =
      (Date.now() - new Date(asset.acquisitionDate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1_000);
    if (ageYears >= usefulLife) {
      return 'useful_life';
    }

    const acquired = new Date(asset.acquisitionDate).toISOString().slice(0, 10);
    throw new BadRequestException(
      `Replacement not justified: "${asset.itemDescription}" is serviceable and ` +
        `within its useful life (acquired ${acquired}; ` +
        `${usefulLife}-year threshold for ${asset.assetClass}).`,
    );
  }

  async create(
    dto: CreateRequisitionDto,
    requestedById: string,
    userRole: UserRole,
    ipAddress: string,
  ): Promise<RequisitionEntity> {
    // A replacement requisition must name an asset the requester holds that has
    // actually met a replacement criterion, before anything else runs (§17).
    const replacementBasis =
      dto.requisitionType === RequisitionType.REPLACEMENT
        ? await this.validateReplacement(dto.replacedAssetId, requestedById)
        : null;

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

    // Alternate Approver (CLAUDE.md §5, §17) — if the resolved primary is
    // currently unavailable and has a usable designated backup, route to them.
    // One hop only: an unusable alternate falls back to the primary (the SLA
    // watcher is the backstop). "Usable" = active SUPERVISOR, not itself away.
    let approverId = supervisor.id;
    let routedToAlternate = false;
    if (
      this.usersService.isUnavailable(supervisor) &&
      supervisor.alternateApproverId
    ) {
      const alt = await this.usersService
        .findOne(supervisor.alternateApproverId)
        .catch(() => null);
      if (
        alt &&
        alt.isActive &&
        alt.role === UserRole.SUPERVISOR &&
        !this.usersService.isUnavailable(alt)
      ) {
        approverId = alt.id;
        routedToAlternate = true;
      }
    }

    // Generate request number: REQ-YYYY-NNNN
    const count = await this.reqRepo.count();
    const requestNumber = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const submittedAt = new Date();
    const slaHours = this.systemConfig.getSlaApprovalHours();
    const slaDeadline = new Date(
      submittedAt.getTime() + slaHours * 60 * 60 * 1_000,
    );

    const req = this.reqRepo.create({
      requestNumber,
      requestedById,
      requisitionType: dto.requisitionType,
      justification: dto.justification,
      requiredDate: new Date(dto.requiredDate),
      replacedAssetId:
        dto.requisitionType === RequisitionType.REPLACEMENT
          ? (dto.replacedAssetId ?? null)
          : null,
      supervisorId: approverId,
      ...(routedToAlternate ? { alternateRoutedAt: new Date() } : {}),
      status: RequisitionStatus.PENDING_SUPERVISOR,
      submittedAt,
      slaDeadline,
    });
    const saved = await this.reqRepo.save(req);

    // Save line items
    const items = dto.items.map((item) =>
      this.itemRepo.create({ ...item, requisitionId: saved.id }),
    );
    saved.items = await this.itemRepo.save(items);
    // Return shape must match findOne/findMine (both hydrate `items`) — callers
    // that render the freshly-created requisition rely on the relation being present.

    // Notify the approver. When routed to an alternate, ALTERNATE_APPROVER
    // replaces the ordinary pending-approval notice and explains the why.
    if (routedToAlternate) {
      await this.notificationsService.notify(
        approverId,
        NotificationAlertType.ALTERNATE_APPROVER,
        'Requisition Routed to You (Alternate Approver)',
        `Requisition ${requestNumber} has been routed to you because ${supervisor.firstName} ${supervisor.lastName} is unavailable. Please review it.`,
        saved.id,
        'requisition',
      );
    } else {
      await this.notificationsService.notify(
        approverId,
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
        ...(replacementBasis
          ? { replacedAssetId: dto.replacedAssetId, replacementBasis }
          : {}),
      },
    });

    if (routedToAlternate) {
      await this.auditService.log({
        userId: requestedById,
        userRole,
        action: AuditAction.REQUISITION_REASSIGNED,
        affectedRecordId: saved.id,
        affectedRecordType: 'requisition',
        ipAddress,
        metadata: {
          reason: 'primary_unavailable',
          primaryApproverId: supervisor.id,
          alternateApproverId: approverId,
        },
      });
    }

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

    // Item-linking + supply decrement + status flip run in one transaction:
    // an insufficient-stock throw on any IES line rolls the whole fulfillment
    // back (no partial link, no status change). stockDecrements is declared
    // outside the callback so the post-commit low-stock sweep and the audit
    // metadata can both read what was actually decremented.
    const stockDecrements: { assetId: string; from: number; to: number }[] = [];

    const saved = await this.reqRepo.manager.transaction(async (em) => {
      const itemRepo = em.getRepository(RequisitionItemEntity);
      const assetRepo = em.getRepository(AssetEntity);

      if (dto.fulfilledItems?.length) {
        for (const { requisitionItemId, assetId } of dto.fulfilledItems) {
          // Reject a fulfilledItems entry naming an id that is not on THIS
          // requisition before any write — otherwise the itemRepo.update below
          // would overwrite the fulfilledAssetId link on another requisition's
          // item. Thrown inside the transaction, so it rolls the whole
          // fulfillment back (consistent with the insufficient-stock 400).
          const reqItem = req.items.find((i) => i.id === requisitionItemId);
          if (!reqItem) {
            throw new BadRequestException(
              `Requisition item "${requisitionItemId}" does not belong to this requisition.`,
            );
          }

          await itemRepo.update(requisitionItemId, {
            fulfilledAssetId: assetId,
          });

          // Mutate the eager-loaded row too: RequisitionEntity.items is
          // { cascade: true, eager: true }, so the em.save(req) below
          // re-persists req.items — without this it would cascade the stale
          // fulfilledAssetId: null straight back over the update() above,
          // inside the same transaction.
          reqItem.fulfilledAssetId = assetId;

          // SVC: Deliver and Support — issuing a supply (IES) line draws down
          // its stock. PPE/SEP items are unit assets and are left untouched.
          if (reqItem.assetClass === AssetClass.IES) {
            // Pessimistic write lock (SELECT … FOR UPDATE): serialises
            // concurrent fulfillments drawing from the same supply row so the
            // insufficient-stock guard below cannot be bypassed by a
            // read-then-write race (two txns both reading the pre-decrement
            // quantity, both subtracting, last write wins).
            const supply = await assetRepo.findOne({
              where: { id: assetId },
              lock: { mode: 'pessimistic_write' },
            });
            if (!supply) {
              throw new BadRequestException(
                `Supply asset "${assetId}" not found.`,
              );
            }
            if (reqItem.quantity > supply.quantity) {
              throw new BadRequestException(
                `Insufficient stock: requested ${reqItem.quantity}, available ${supply.quantity}`,
              );
            }
            const from = supply.quantity;
            supply.quantity = from - reqItem.quantity;
            await assetRepo.save(supply);
            stockDecrements.push({ assetId, from, to: supply.quantity });
          }
        }
      }

      req.itPersonnelId = itPersonnelId;
      req.fulfilledAt = new Date();
      req.fulfillmentNotes = dto.notes ?? '';
      req.status = RequisitionStatus.FULFILLED;
      return em.getRepository(RequisitionEntity).save(req);
    });

    // After the transaction commits: give each decremented supply an immediate
    // low-stock check rather than waiting for the daily sweep. Runs outside the
    // txn, so a failure here (e.g. notify infra down inside _sendLowStockAlert)
    // must not reject fulfill() — the fulfillment is already committed and the
    // requester notification + audit log still need to run. Log and move on;
    // the daily checkLowStock cron is the backstop.
    for (const { assetId } of stockDecrements) {
      try {
        await this.assetsService.notifyLowStockIfBelowThreshold(assetId);
      } catch (e) {
        this.logger.error(
          `post-fulfillment low-stock check failed for asset ${assetId}`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

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
        stockDecrements,
      },
    });

    return saved;
  }

  // ── SLA breach check — called by a scheduled job (SchedulerService) ───────
  // SVC: Improve — audit-readiness: surface pending_supervisor requisitions that
  // have blown the configured SLA approval window. Fires exactly once per
  // requisition (dedup via slaBreachNotifiedAt) and reaches the Module 5 alert
  // recipient set: the nominated supervisor, the requester, and every
  // System Administrator + Management user for oversight. Returns the count of
  // requisitions newly notified (always non-negative — SchedulerService.runWatcher
  // owns the -1 "errored" sentinel).
  async checkSlaBreaches(): Promise<number> {
    const now = new Date();
    const slaHours = this.systemConfig.getSlaApprovalHours();
    const breached = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.status = :status', {
        status: RequisitionStatus.PENDING_SUPERVISOR,
      })
      .andWhere('r.slaDeadline < :now', { now })
      .andWhere('r.slaBreachNotifiedAt IS NULL')
      .getMany();

    if (breached.length === 0) return 0;

    const [admins, management] = await Promise.all([
      this.usersService.findByRole(UserRole.SYSTEM_ADMIN),
      this.usersService.findByRole(UserRole.MANAGEMENT),
    ]);
    const oversight = [...admins, ...management].map((u) => u.id);

    await Promise.all(
      breached.map(async (req) => {
        const targets = new Set<string>([req.requestedById, ...oversight]);
        if (req.supervisorId) targets.add(req.supervisorId);
        await Promise.all(
          [...targets].map((uid) =>
            this.notificationsService.notify(
              uid,
              NotificationAlertType.SLA_BREACH,
              'SLA Breach — Requisition Overdue',
              `Requisition ${req.requestNumber} has exceeded the ${slaHours}-hour approval SLA.`,
              req.id,
              'requisition',
            ),
          ),
        );
        // Alternate Approver (CLAUDE.md §5, §17) — resolve a usable alternate
        // BEFORE the stamp is written. The `slaBreachNotifiedAt` stamp is what
        // removes this row from the `slaBreachNotifiedAt IS NULL` query, so the
        // stamp and the reassignment MUST land in one write: a crash between two
        // separate writes would leave the requisition marked-as-handled yet
        // never reassigned. The breach notices above already reached the primary
        // (still `req.supervisorId` in memory), preserving spec §6.2 ordering.
        let current: UserEntity | null = null;
        let alt: UserEntity | null = null;
        if (req.alternateRoutedAt == null && req.supervisorId) {
          current = await this.usersService
            .findOne(req.supervisorId)
            .catch(() => null);
          const altId = current?.alternateApproverId ?? null;
          if (altId) {
            const candidate = await this.usersService
              .findOne(altId)
              .catch(() => null);
            if (
              candidate &&
              candidate.isActive &&
              candidate.role === UserRole.SUPERVISOR &&
              !this.usersService.isUnavailable(candidate)
            ) {
              alt = candidate;
            }
          }
        }

        await this.reqRepo.update(req.id, {
          slaBreachNotifiedAt: new Date(),
          ...(alt
            ? { supervisorId: alt.id, alternateRoutedAt: new Date() }
            : {}),
        });

        if (alt) {
          await this.notificationsService.notify(
            alt.id,
            NotificationAlertType.ALTERNATE_APPROVER,
            'Requisition Reassigned to You (Alternate Approver)',
            `Requisition ${req.requestNumber} was reassigned to you after its approval SLA passed with no decision from ${current!.firstName} ${current!.lastName}.`,
            req.id,
            'requisition',
          );
          const requester = await this.usersService
            .findOne(req.requestedById)
            .catch(() => null);
          await this.auditService.log({
            userId: req.requestedById,
            userRole: requester?.role ?? UserRole.EMPLOYEE,
            action: AuditAction.REQUISITION_REASSIGNED,
            affectedRecordId: req.id,
            affectedRecordType: 'requisition',
            ipAddress: '',
            metadata: {
              reason: 'sla_breach',
              primaryApproverId: current!.id,
              alternateApproverId: alt.id,
              systemInitiated: true,
            },
          });
        }
      }),
    );

    return breached.length;
  }

  // ── Pending-approval nudge — called by the same scheduled job ─────────────
  // SVC: Engage — Module 5 alert: a requisition still sitting in
  // pending_supervisor once it has burned through half the configured SLA
  // approval window — but before the deadline itself, since breached ones are
  // checkSlaBreaches' job — earns its nominated supervisor a single reminder.
  // Deduped via pendingNudgeNotifiedAt so a supervisor is nudged at most once
  // per requisition. Returns the count newly nudged (always non-negative —
  // SchedulerService.runWatcher owns the -1 "errored" sentinel).
  async checkPendingApprovalNudges(): Promise<number> {
    const now = new Date();
    const slaHours = this.systemConfig.getSlaApprovalHours();
    const nudgeThreshold = new Date(
      now.getTime() - (slaHours / 2) * 60 * 60 * 1000,
    );

    const pending = await this.reqRepo
      .createQueryBuilder('r')
      .where('r.status = :status', {
        status: RequisitionStatus.PENDING_SUPERVISOR,
      })
      .andWhere('r.submittedAt < :nudgeThreshold', { nudgeThreshold })
      .andWhere('r.slaDeadline >= :now', { now }) // breached ones: checkSlaBreaches
      .andWhere('r.pendingNudgeNotifiedAt IS NULL')
      .getMany();

    await Promise.all(
      pending.map(async (req) => {
        if (req.supervisorId) {
          await this.notificationsService.notify(
            req.supervisorId,
            NotificationAlertType.PENDING_APPROVAL,
            'Requisition Approaching its Approval SLA',
            `Requisition ${req.requestNumber} has been awaiting your approval for over ${Math.round(slaHours / 2)} hours.`,
            req.id,
            'requisition',
          );
        }
        await this.reqRepo.update(req.id, {
          pendingNudgeNotifiedAt: new Date(),
        });
      }),
    );

    return pending.length;
  }
}
