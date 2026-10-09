import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GeneratedFormEntity } from '../reports/entities/generated-form.entity';
import { ReportsService } from '../reports/reports.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssetRequestEntity } from './entities/asset-request.entity';
import { AssetRequestAttachmentEntity } from './entities/asset-request-attachment.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  ApproveAssetRequestDto,
  CompleteAssetRequestDto,
  CreateAssetRequestDto,
  RejectAssetRequestDto,
} from './dto/asset-request.dto';
import { checkAttachments, UploadedAttachment } from './attachment-files';
import {
  AssetClass,
  AssetRequestStatus,
  AssetRequestType,
  AssetStatus,
  AssetType,
  AuditAction,
  NotificationAlertType,
  OfficialFormType,
  UserRole,
} from '../../../packages/shared/src/enums';
import { resolveAssetTypeScope } from '../common/utils/asset-type-scope.util';

// SVC: Deliver & Support — returns, repairs and incident reporting.
// Flow: holder submits → custodian approves (schedules hand-over) → custodian
// marks it received/processed, which drives the asset lifecycle transition.
// Routed by asset type: ICT → IT Personnel, Fixed/Supplies → Property Custodian.

const OPEN_STATUSES = [
  AssetRequestStatus.SUBMITTED,
  AssetRequestStatus.APPROVED,
];
const INCIDENT_TYPES = new Set([AssetRequestType.LOSS, AssetRequestType.THEFT]);
const ACTING_ROLES = new Set([
  UserRole.IT_PERSONNEL,
  UserRole.PROPERTY_CUSTODIAN,
]);
const UNSCOPED_READERS = new Set([UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT]);

const TYPE_LABEL: Record<AssetRequestType, string> = {
  [AssetRequestType.RETURN]: 'Return request',
  [AssetRequestType.REPAIR]: 'Repair request',
  [AssetRequestType.DAMAGE]: 'Damage report',
  [AssetRequestType.LOSS]: 'Loss report',
  [AssetRequestType.THEFT]: 'Theft report',
};

// Notification titles: 'Return Request Approved', 'Theft Report Cancelled', ...
const TYPE_TITLE: Record<AssetRequestType, string> = {
  [AssetRequestType.RETURN]: 'Return Request',
  [AssetRequestType.REPAIR]: 'Repair Request',
  [AssetRequestType.DAMAGE]: 'Damage Report',
  [AssetRequestType.LOSS]: 'Loss Report',
  [AssetRequestType.THEFT]: 'Theft Report',
};

/**
 * Which already-open request (if any) blocks filing `type` on the same asset.
 * One open request per asset — except that a loss or theft can still be
 * reported while a return/repair/damage request is pending (the item can go
 * missing before it is handed over). Nothing else may be filed while a loss or
 * theft report is open.
 */
export function blockingRequest<T extends { type: AssetRequestType }>(
  type: AssetRequestType,
  open: T[],
): T | undefined {
  return INCIDENT_TYPES.has(type)
    ? open.find((r) => INCIDENT_TYPES.has(r.type))
    : open[0];
}

/** Asset status a completed request moves the asset to. */
export function completionTargetStatus(
  type: AssetRequestType,
  outcome?: 'repair' | 'disposal',
): AssetStatus {
  switch (type) {
    case AssetRequestType.RETURN:
      return AssetStatus.RETURNED;
    case AssetRequestType.REPAIR:
      return AssetStatus.UNDER_REPAIR;
    case AssetRequestType.DAMAGE:
      if (!outcome) {
        throw new BadRequestException(
          'Choose whether the damaged item goes to repair or is flagged for disposal.',
        );
      }
      return outcome === 'repair'
        ? AssetStatus.UNDER_REPAIR
        : AssetStatus.FLAGGED_FOR_DISPOSAL;
    default:
      return AssetStatus.FLAGGED_FOR_DISPOSAL; // loss / theft
  }
}

export type RlsddpLossType = 'Lost' | 'Stolen' | 'Damaged';

export interface RequiredDocument {
  formType: OfficialFormType;
  lossType?: RlsddpLossType;
}

/**
 * The COA documents a completed request must produce — CLAUDE.md §7.2 trigger
 * events. Generated automatically when the custodian completes the request and
 * linked to it so the requester can download them.
 *
 *   return                 → Receipt of Returned Property (PPE) / SEP (SEP, IES)
 *   repair                 → none (no COA form; item stays in the holder's custody)
 *   damage → repair        → RLSDDP (Damaged)
 *   damage → disposal      → Receipt (item surrendered) + RLSDDP (Damaged) + IIRUP
 *   loss / theft           → RLSDDP (Lost / Stolen) — no IIRUP: there is no item
 *                            to inspect, and no receipt: nothing was handed back
 */
export function requiredDocuments(
  req: Pick<AssetRequestEntity, 'type' | 'status' | 'resultingStatus'>,
  assetClass: AssetClass,
): RequiredDocument[] {
  if (req.status !== AssetRequestStatus.COMPLETED) return [];
  const receipt: RequiredDocument = {
    formType:
      assetClass === AssetClass.PPE
        ? OfficialFormType.RECEIPT_RETURNED_PROPERTY
        : OfficialFormType.RECEIPT_RETURNED_SEP,
  };
  switch (req.type) {
    case AssetRequestType.RETURN:
      return [receipt];
    case AssetRequestType.LOSS:
      return [{ formType: OfficialFormType.RLSDDP, lossType: 'Lost' }];
    case AssetRequestType.THEFT:
      return [{ formType: OfficialFormType.RLSDDP, lossType: 'Stolen' }];
    case AssetRequestType.DAMAGE: {
      const rlsddp: RequiredDocument = {
        formType: OfficialFormType.RLSDDP,
        lossType: 'Damaged',
      };
      return req.resultingStatus === AssetStatus.FLAGGED_FOR_DISPOSAL
        ? [receipt, rlsddp, { formType: OfficialFormType.IIRUP }]
        : [rlsddp];
    }
    default:
      return [];
  }
}

/**
 * Whether completing the request ends the holder's accountability for the item.
 * Only when the item is physically surrendered for good: a return, or a
 * damaged item surrendered for disposal. Lost/stolen items stay on the holder's
 * record until COA relief; repaired items come back to the holder.
 */
export function clearsAccountability(
  type: AssetRequestType,
  resultingStatus: string | null,
): boolean {
  return (
    type === AssetRequestType.RETURN ||
    (type === AssetRequestType.DAMAGE &&
      resultingStatus === AssetStatus.FLAGGED_FOR_DISPOSAL)
  );
}

const FORM_LABEL: Partial<Record<OfficialFormType, string>> = {
  [OfficialFormType.RECEIPT_RETURNED_PROPERTY]: 'Receipt of Returned Property',
  [OfficialFormType.RECEIPT_RETURNED_SEP]:
    'Receipt of Returned Semi-Expendable Property',
  [OfficialFormType.RLSDDP]:
    'Report of Lost, Stolen, Damaged or Destroyed Property (RLSDDP)',
  [OfficialFormType.IIRUP]:
    'Inventory and Inspection Report of Unserviceable Property (IIRUP)',
};

function custodianRoleFor(assetType: AssetType): UserRole {
  return assetType === AssetType.ICT
    ? UserRole.IT_PERSONNEL
    : UserRole.PROPERTY_CUSTODIAN;
}

function custodianLabelFor(assetType: AssetType): string {
  return assetType === AssetType.ICT
    ? 'IT Asset Custodian'
    : 'Property Custodian';
}

/** What completion means for the holder, in the requester's notification. */
export function completionMessage(
  type: AssetRequestType,
  resultingStatus: AssetStatus,
): string {
  if (INCIDENT_TYPES.has(type)) {
    return 'The incident has been documented. The item stays on your accountability record until COA grants relief.';
  }
  if (resultingStatus === AssetStatus.RETURNED) {
    return 'The item has been received and is no longer assigned to you.';
  }
  if (resultingStatus === AssetStatus.UNDER_REPAIR) {
    return 'The item has been received for repair and will be returned to you; it stays under your accountability.';
  }
  return 'The item has been received and flagged for disposal; your accountability for it has ended.';
}

function fullName(u?: UserEntity | null): string {
  return u ? `${u.firstName} ${u.lastName}`.trim() : '';
}

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

@Injectable()
export class AssetRequestsService {
  private readonly logger = new Logger(AssetRequestsService.name);

  constructor(
    @InjectRepository(AssetRequestEntity)
    private readonly repo: Repository<AssetRequestEntity>,
    @InjectRepository(AssetRequestAttachmentEntity)
    private readonly attachmentRepo: Repository<AssetRequestAttachmentEntity>,
    @InjectRepository(GeneratedFormEntity)
    private readonly formRepo: Repository<GeneratedFormEntity>,
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
  ) {}

  // ── View shape ─────────────────────────────────────────────────────────────
  // Requester / actors reduced to name + employee ID (CLAUDE.md §8.4); the
  // attachment blob never leaves through this path.
  private toView(
    req: AssetRequestEntity,
    people: Record<string, UserEntity | null | undefined> = {},
    forms: GeneratedFormEntity[] = [],
  ) {
    const asset = req.asset;
    const required = asset ? requiredDocuments(req, asset.assetClass) : [];
    // Required order (receipt → RLSDDP → IIRUP), not generation order — the
    // forms are generated in parallel.
    const rank = (t: OfficialFormType) => {
      const i = required.findIndex((d) => d.formType === t);
      return i === -1 ? required.length : i;
    };
    const ordered = [...forms].sort(
      (a, b) => rank(a.formType) - rank(b.formType),
    );
    const documents = ordered.map((f) => ({
      id: f.id,
      formType: f.formType,
      label: FORM_LABEL[f.formType] ?? f.formType,
      generatedAt: f.generatedAt,
    }));
    const missingDocuments = required
      .filter((d) => !forms.some((f) => f.formType === d.formType))
      .map((d) => d.formType);
    const requester = req.requestedBy ?? people[req.requestedById];
    const person = (id: string | null) => {
      const u = id ? people[id] : null;
      return u
        ? { id: u.id, name: fullName(u), employeeId: u.employeeId }
        : null;
    };
    return {
      id: req.id,
      requestNumber: req.requestNumber,
      type: req.type,
      status: req.status,
      preferredDate: req.preferredDate,
      details: req.details,
      handoverDate: req.handoverDate,
      decisionNotes: req.decisionNotes,
      decidedAt: req.decidedAt,
      completionNotes: req.completionNotes,
      completedAt: req.completedAt,
      resultingStatus: req.resultingStatus,
      cancelledAt: req.cancelledAt,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      requester: requester
        ? {
            id: requester.id,
            name: fullName(requester),
            employeeId: requester.employeeId,
            officeOrSection: requester.officeOrSection,
          }
        : null,
      decidedBy: person(req.decidedById),
      completedBy: person(req.completedById),
      asset: asset
        ? {
            id: asset.id,
            itemDescription: asset.itemDescription,
            propertyNumber: asset.propertyNumber,
            serialNumber: asset.serialNumber,
            assetType: asset.assetType,
            assetClass: asset.assetClass,
            status: asset.status,
            components: asset.components ?? null, // what to bring at hand-over
          }
        : null,
      attachments: (req.attachments ?? []).map((a) => ({
        id: a.id,
        stage: a.stage,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
      custodianLabel: asset ? custodianLabelFor(asset.assetType) : null,
      // Official COA documents generated on completion (proof of return /
      // incident report), downloadable by the requester and the custodian.
      documents,
      missingDocuments,
      accountabilityCleared:
        req.status === AssetRequestStatus.COMPLETED &&
        clearsAccountability(req.type, req.resultingStatus),
    };
  }

  /**
   * Views for many requests at once: resolves the approver / completer names
   * and the linked COA documents in two batched lookups, so list rows carry the
   * same detail as a single fetch (no "Approved by custodian" placeholder).
   */
  private async hydrate(reqs: AssetRequestEntity[]) {
    const userIds = [
      ...new Set(
        reqs.flatMap((r) =>
          [r.decidedById, r.completedById].filter((x): x is string => !!x),
        ),
      ),
    ];
    const users = await Promise.all(
      userIds.map((uid) => this.usersService.findOne(uid).catch(() => null)),
    );
    const people = Object.fromEntries(userIds.map((uid, i) => [uid, users[i]]));
    const forms = reqs.length
      ? await this.formRepo.find({
          select: {
            id: true,
            formType: true,
            generatedAt: true,
            relatedAssetRequestId: true,
          },
          where: { relatedAssetRequestId: In(reqs.map((r) => r.id)) },
          order: { generatedAt: 'ASC' },
        })
      : [];
    return reqs.map((r) =>
      this.toView(
        r,
        people,
        forms.filter((f) => f.relatedAssetRequestId === r.id),
      ),
    );
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.asset', 'asset')
      .leftJoinAndSelect('r.requestedBy', 'requestedBy')
      .leftJoinAndSelect('r.attachments', 'attachments')
      .orderBy('r.createdAt', 'DESC');
  }

  private async load(id: string): Promise<AssetRequestEntity> {
    const req = await this.baseQuery().where('r.id = :id', { id }).getOne();
    if (!req) throw new NotFoundException(`Request "${id}" not found`);
    return req;
  }

  private canRead(req: AssetRequestEntity, user: UserEntity): boolean {
    if (req.requestedById === user.id) return true;
    if (UNSCOPED_READERS.has(user.role)) return true;
    const scope = resolveAssetTypeScope(user.role);
    return !!scope && scope.includes(req.asset.assetType);
  }

  /** Only the custodian role for this asset type may decide — never the requester. */
  private assertCanAct(req: AssetRequestEntity, user: UserEntity): void {
    const scope = resolveAssetTypeScope(user.role);
    if (!ACTING_ROLES.has(user.role) || !scope?.includes(req.asset.assetType)) {
      throw new ForbiddenException(
        `This request is handled by the ${custodianLabelFor(req.asset.assetType)}.`,
      );
    }
    if (req.requestedById === user.id) {
      throw new ForbiddenException(
        'You cannot act on a request you filed yourself.',
      );
    }
  }

  // update(), not save(): the loaded entity carries joined relations
  // (asset, requester, attachments without their blob) that must not be
  // re-persisted. The in-memory copy is patched too for the notifications.
  private async patch(
    req: AssetRequestEntity,
    changes: Partial<
      Pick<
        AssetRequestEntity,
        | 'status'
        | 'handoverDate'
        | 'decidedById'
        | 'decidedAt'
        | 'decisionNotes'
        | 'completedById'
        | 'completedAt'
        | 'completionNotes'
        | 'resultingStatus'
        | 'cancelledAt'
      >
    >,
  ) {
    await this.repo.update(req.id, changes);
    Object.assign(req, changes);
  }

  private async view(id: string) {
    const [one] = await this.hydrate([await this.load(id)]);
    return one;
  }

  /**
   * Generates (and links) every COA document the completed request requires
   * that does not exist yet. Each form is attempted independently and a
   * failure is logged rather than thrown: the request and asset are already
   * completed by then, and the custodian can retry via POST …/documents.
   * Returns the form types that are still missing.
   */
  private async ensureDocuments(
    req: AssetRequestEntity,
    user: UserEntity,
    ipAddress: string,
  ): Promise<OfficialFormType[]> {
    const required = requiredDocuments(req, req.asset.assetClass);
    const existing = await this.formRepo.find({
      select: { id: true, formType: true },
      where: { relatedAssetRequestId: req.id },
    });
    const toGenerate = required.filter(
      (doc) => !existing.some((f) => f.formType === doc.formType),
    );
    const results = await Promise.all(
      toGenerate.map((doc) =>
        this.reportsService
          .generateFormRecord(
            {
              formType: doc.formType,
              assetId: req.assetId,
              assetRequestId: req.id,
              returneeId: req.requestedById,
              lossType: doc.lossType,
              circumstances: doc.lossType
                ? [req.details, req.completionNotes].filter(Boolean).join(' — ')
                : undefined,
            },
            user.id,
            user.role,
            ipAddress,
          )
          .then(() => null)
          .catch((e: unknown) => {
            this.logger.error(
              `${req.requestNumber}: could not generate ${doc.formType}`,
              e instanceof Error ? e.stack : String(e),
            );
            return doc.formType;
          }),
      ),
    );
    return results.filter((f): f is OfficialFormType => f !== null);
  }

  private async notifyCustodians(
    req: AssetRequestEntity,
    title: string,
    message: string,
  ) {
    const custodians = await this.usersService.findByRole(
      custodianRoleFor(req.asset.assetType),
    );
    await Promise.all(
      custodians
        .filter((u) => u.id !== req.requestedById)
        .map((u) =>
          this.notificationsService.notify(
            u.id,
            NotificationAlertType.ASSET_REQUEST,
            title,
            message,
            req.id,
            'asset_request',
          ),
        ),
    );
  }

  private notifyRequester(
    req: AssetRequestEntity,
    title: string,
    message: string,
  ) {
    return this.notificationsService.notify(
      req.requestedById,
      NotificationAlertType.ASSET_REQUEST_UPDATE,
      title,
      message,
      req.id,
      'asset_request',
    );
  }

  private audit(
    action: AuditAction,
    req: AssetRequestEntity,
    user: UserEntity,
    ipAddress: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action,
      affectedRecordId: req.id,
      affectedRecordType: 'asset_request',
      ipAddress,
      metadata: {
        requestNumber: req.requestNumber,
        type: req.type,
        assetId: req.assetId,
        ...metadata,
      },
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async create(
    dto: CreateAssetRequestDto,
    files: UploadedAttachment[] | undefined,
    user: UserEntity,
    ipAddress: string,
  ) {
    const attachments = checkAttachments(files);

    const saved = await this.repo.manager.transaction(async (em) => {
      // Lock the asset row so two submissions for the same asset serialise and
      // the one-open-request rule below can't be raced past.
      const asset = await em.getRepository(AssetEntity).findOne({
        where: { id: dto.assetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.custodianId !== user.id) {
        throw new ForbiddenException(
          'You can only file requests for assets currently issued to you.',
        );
      }
      if (asset.status !== AssetStatus.ISSUED) {
        throw new BadRequestException(
          `This asset is "${asset.status.replaceAll('_', ' ')}" — requests can only be filed on an issued asset.`,
        );
      }

      const open = await em.getRepository(AssetRequestEntity).find({
        where: { assetId: asset.id, status: In(OPEN_STATUSES) },
        order: { createdAt: 'ASC' },
      });
      const blocker = blockingRequest(dto.type, open);
      if (blocker) {
        throw new ConflictException(
          `${blocker.requestNumber} (${TYPE_LABEL[blocker.type].toLowerCase()}) is still open for this asset. ` +
            'Cancel it or wait until it is closed before filing another.',
        );
      }

      // Serialise numbering across all assets for the rest of this txn so
      // concurrent submissions can't draw the same AR number.
      await em.query(
        "SELECT pg_advisory_xact_lock(hashtext('asset_request_number'))",
      );
      const year = new Date().getFullYear();
      const count = await em
        .getRepository(AssetRequestEntity)
        .createQueryBuilder('r')
        .where('r.requestNumber LIKE :p', { p: `AR-${year}-%` })
        .getCount();
      const requestNumber = `AR-${year}-${String(count + 1).padStart(4, '0')}`;

      const req = await em.getRepository(AssetRequestEntity).save(
        em.getRepository(AssetRequestEntity).create({
          requestNumber,
          assetId: asset.id,
          requestedById: user.id,
          type: dto.type,
          status: AssetRequestStatus.SUBMITTED,
          preferredDate: dto.preferredDate.slice(0, 10),
          details: dto.details.trim(),
        }),
      );
      if (attachments.length) {
        await em.getRepository(AssetRequestAttachmentEntity).save(
          attachments.map((a) =>
            em.getRepository(AssetRequestAttachmentEntity).create({
              ...a,
              requestId: req.id,
              stage: 'request',
              uploadedById: user.id,
            }),
          ),
        );
      }
      req.asset = asset;
      return req;
    });

    await this.notifyCustodians(
      saved,
      `New ${TYPE_TITLE[saved.type]}`,
      `${saved.requestNumber}: ${fullName(user)} (${user.employeeId}) filed a ${TYPE_LABEL[saved.type].toLowerCase()} for ` +
        `"${saved.asset.itemDescription}". Review it in Returns & Incidents.`,
    );
    await this.audit(
      AuditAction.ASSET_REQUEST_SUBMITTED,
      saved,
      user,
      ipAddress,
      {
        attachmentCount: attachments.length,
      },
    );
    return this.view(saved.id);
  }

  // ── Reads ──────────────────────────────────────────────────────────────────
  async findMine(userId: string) {
    const rows = await this.baseQuery()
      .where('r.requestedById = :userId', { userId })
      .take(200)
      .getMany();
    return this.hydrate(rows);
  }

  /** Custodian / oversight queue, scoped by asset type like the asset registry. */
  async findQueue(user: UserEntity, status?: string) {
    const qb = this.baseQuery().take(200);
    const scope = resolveAssetTypeScope(user.role);
    if (scope) qb.where('asset.assetType IN (:...scope)', { scope });
    if (status === 'open') {
      qb.andWhere('r.status IN (:...open)', { open: OPEN_STATUSES });
    } else if (status) {
      qb.andWhere('r.status = :status', { status });
    }
    const rows = await qb.getMany();
    return this.hydrate(rows);
  }

  async findOneForUser(id: string, user: UserEntity) {
    const req = await this.load(id);
    if (!this.canRead(req, user)) {
      throw new ForbiddenException('You do not have access to this request.');
    }
    return this.view(id);
  }

  async getAttachment(id: string, attachmentId: string, user: UserEntity) {
    const req = await this.load(id);
    if (!this.canRead(req, user)) {
      throw new ForbiddenException('You do not have access to this request.');
    }
    const file = await this.attachmentRepo
      .createQueryBuilder('a')
      .addSelect('a.content')
      .where('a.id = :attachmentId AND a.requestId = :id', { attachmentId, id })
      .getOne();
    if (!file) throw new NotFoundException('Attachment not found');
    return file;
  }

  // ── Custodian decisions ────────────────────────────────────────────────────
  async approve(
    id: string,
    dto: ApproveAssetRequestDto,
    user: UserEntity,
    ipAddress: string,
  ) {
    const req = await this.load(id);
    this.assertCanAct(req, user);
    if (req.status !== AssetRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only a submitted request can be approved (this one is "${req.status}").`,
      );
    }
    await this.patch(req, {
      status: AssetRequestStatus.APPROVED,
      handoverDate: dto.handoverDate ? dto.handoverDate.slice(0, 10) : null,
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNotes: dto.notes?.trim() || null,
    });

    const label = custodianLabelFor(req.asset.assetType);
    const when = req.handoverDate ? ` on ${formatDate(req.handoverDate)}` : '';
    const withParts = req.asset.components
      ? ` together with its components (${req.asset.components})`
      : '';
    const supporting =
      req.type === AssetRequestType.THEFT
        ? 'a police report'
        : 'an affidavit of loss';
    const next = INCIDENT_TYPES.has(req.type)
      ? `The ${label} is preparing the RLSDDP. Bring any supporting documents ` +
        `(e.g. ${supporting})${when} so the report can be completed.`
      : `Please bring "${req.asset.itemDescription}"${withParts} to the ${label}${when}.`;
    await this.notifyRequester(
      req,
      `${TYPE_TITLE[req.type]} Approved`,
      `${req.requestNumber} was approved by the ${label}. ${next}` +
        (req.decisionNotes ? ` Note: ${req.decisionNotes}` : ''),
    );
    await this.audit(AuditAction.ASSET_REQUEST_APPROVED, req, user, ipAddress, {
      handoverDate: req.handoverDate,
    });
    return this.view(id);
  }

  async reject(
    id: string,
    dto: RejectAssetRequestDto,
    user: UserEntity,
    ipAddress: string,
  ) {
    const req = await this.load(id);
    this.assertCanAct(req, user);
    // Rejecting is the alternative to approving — once approved, the
    // custodian has committed to the hand-over and can only mark it received.
    if (req.status !== AssetRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        req.status === AssetRequestStatus.APPROVED
          ? 'This request is already approved and can no longer be rejected.'
          : `This request is already "${req.status}".`,
      );
    }
    await this.patch(req, {
      status: AssetRequestStatus.REJECTED,
      decidedById: user.id,
      decidedAt: new Date(),
      decisionNotes: dto.reason.trim(),
    });

    await this.notifyRequester(
      req,
      `${TYPE_TITLE[req.type]} Rejected`,
      `${req.requestNumber} for "${req.asset.itemDescription}" was rejected. Reason: ${req.decisionNotes}`,
    );
    await this.audit(AuditAction.ASSET_REQUEST_REJECTED, req, user, ipAddress, {
      reason: req.decisionNotes,
    });
    return this.view(id);
  }

  /** Item received (or incident processed) — drives the asset lifecycle. */
  async complete(
    id: string,
    dto: CompleteAssetRequestDto,
    user: UserEntity,
    ipAddress: string,
    files?: UploadedAttachment[],
  ) {
    const req = await this.load(id);
    this.assertCanAct(req, user);
    if (req.status !== AssetRequestStatus.APPROVED) {
      throw new BadRequestException(
        req.status === AssetRequestStatus.SUBMITTED
          ? 'Approve the request before marking it received.'
          : `This request is already "${req.status}".`,
      );
    }
    const target = completionTargetStatus(req.type, dto.outcome);
    const notes = dto.notes?.trim() || null;
    // Condition-on-receipt photos — validated before anything is written.
    const receiptPhotos = checkAttachments(files);

    // Lifecycle first: if the state machine refuses (the asset moved on in the
    // meantime) the request stays approved and the custodian sees why.
    await this.assetsService.updateLifecycle(
      req.assetId,
      {
        status: target,
        notes: `${req.requestNumber} (${TYPE_LABEL[req.type]}): ${notes ?? req.details}`,
      },
      user.id,
      user.role,
      ipAddress,
      resolveAssetTypeScope(user.role),
    );

    if (receiptPhotos.length) {
      await this.attachmentRepo.save(
        receiptPhotos.map((a) =>
          this.attachmentRepo.create({
            ...a,
            requestId: req.id,
            stage: 'receipt',
            uploadedById: user.id,
          }),
        ),
      );
    }

    // A damaged item surrendered for disposal leaves the holder's hands for
    // good, so their accountability ends here (a return clears it inside
    // updateLifecycle). Lost/stolen items deliberately stay on the holder's
    // record until COA grants relief; repaired items come back to them.
    const cleared = clearsAccountability(req.type, target);
    if (cleared && target !== AssetStatus.RETURNED) {
      await this.repo.manager
        .getRepository(AssetEntity)
        .update(req.assetId, { custodianId: null });
    }

    await this.patch(req, {
      status: AssetRequestStatus.COMPLETED,
      completedById: user.id,
      completedAt: new Date(),
      completionNotes: notes,
      resultingStatus: target,
    });

    // Official documents for the outcome (CLAUDE.md §7.2) — generated now,
    // linked to the request, downloadable by the requester as their proof.
    const missing = await this.ensureDocuments(req, user, ipAddress);
    const generated = requiredDocuments(req, req.asset.assetClass)
      .filter((d) => !missing.includes(d.formType))
      .map((d) => FORM_LABEL[d.formType] ?? d.formType);

    await this.notifyRequester(
      req,
      `${TYPE_TITLE[req.type]} Completed`,
      [
        `${req.requestNumber} for "${req.asset.itemDescription}" is complete.`,
        completionMessage(req.type, target),
        generated.length
          ? `Your copy of the ${generated.join(', ')} is on the request.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    await this.audit(
      AuditAction.ASSET_REQUEST_COMPLETED,
      req,
      user,
      ipAddress,
      {
        resultingStatus: target,
        accountabilityCleared: cleared,
        receiptPhotoCount: receiptPhotos.length,
        documents: generated.length,
        missingDocuments: missing,
      },
    );
    return this.view(id);
  }

  /** Custodian retry for documents that failed to generate on completion. */
  async regenerateDocuments(id: string, user: UserEntity, ipAddress: string) {
    const req = await this.load(id);
    this.assertCanAct(req, user);
    if (req.status !== AssetRequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Documents are generated once the request is completed.',
      );
    }
    await this.ensureDocuments(req, user, ipAddress);
    return this.view(id);
  }

  /**
   * A COA document linked to this request — readable by anyone who can read
   * the request (the requester's proof of return / incident report). Generated
   * forms are otherwise custodian/admin-only, so the link is the authorisation.
   */
  async getDocument(id: string, formId: string, user: UserEntity) {
    const req = await this.load(id);
    if (!this.canRead(req, user)) {
      throw new ForbiddenException('You do not have access to this request.');
    }
    const form = await this.formRepo
      .createQueryBuilder('f')
      .select(['f.id', 'f.formType', 'f.pdfContent', 'f.relatedAssetRequestId'])
      .where('f.id = :formId AND f.relatedAssetRequestId = :id', { formId, id })
      .getOne();
    if (!form?.pdfContent) throw new NotFoundException('Document not found');
    return { form, req };
  }

  // ── Requester cancels ──────────────────────────────────────────────────────
  async cancel(id: string, user: UserEntity, ipAddress: string) {
    const req = await this.load(id);
    if (req.requestedById !== user.id) {
      throw new ForbiddenException(
        'Only the requester can cancel this request.',
      );
    }
    if (!OPEN_STATUSES.includes(req.status)) {
      throw new BadRequestException(`This request is already "${req.status}".`);
    }
    await this.patch(req, {
      status: AssetRequestStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    await this.notifyCustodians(
      req,
      `${TYPE_TITLE[req.type]} Cancelled`,
      `${req.requestNumber} for "${req.asset.itemDescription}" was cancelled by ${fullName(user)}.`,
    );
    await this.audit(AuditAction.ASSET_REQUEST_CANCELLED, req, user, ipAddress);
    return this.view(id);
  }
}
