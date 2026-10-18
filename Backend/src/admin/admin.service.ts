import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigService } from '../system-config/system-config.service';
import { AssetRequestsService } from '../asset-requests/asset-requests.service';
import { AssetRepairsService } from '../assets/asset-repairs.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AUDIT_REASON_REFRESH_TOKEN_REUSE } from '../audit/audit-reasons';
import {
  AssetClass,
  ASSIGNABLE_USER_ROLES,
  AssetStatus,
  AuditAction,
  RequisitionStatus,
  UserRole,
} from '../../../packages/shared/src/enums';

export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    locked: number;
    byRole: Partial<Record<UserRole, number>>;
  };
  requisitions: {
    pendingSupervisor: number;
    slaBreached: number;
  };
  assets: {
    total: number;
    available: number;
    lowStock: number;
  };
  audit: {
    failedLoginsToday: number;
    eventsToday: number;
  };
  // Work only the System Administrator may do: what a custodian filed for themselves (they may not decide it,
  // so the admin is the fallback). Counts what THIS administrator can act on, from the same services the three
  // admin screens read.
  decisions: {
    returnsIncidents: number;
    repairs: number;
    requisitions: number;
  };
  generatedAt: string;
}

// SVC: Improve — the System Administrator dashboard is a live operational and
// security read-out. Every figure below is an aggregate COUNT against the same
// tables the individual admin screens page through, so the dashboard never
// drifts from what those screens show. Read-only: no audit entry is written.
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(RequisitionEntity)
    private readonly requisitions: Repository<RequisitionEntity>,
    @InjectRepository(AssetEntity)
    private readonly assets: Repository<AssetEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly audit: Repository<AuditLogEntity>,
    private readonly systemConfig: SystemConfigService,
    private readonly assetRequests: AssetRequestsService,
    private readonly repairs: AssetRepairsService,
    private readonly requisitionsService: RequisitionsService,
  ) {}

  async getDashboardStats(admin: UserEntity): Promise<AdminDashboardStats> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      lockedUsers,
      byRole,
      pendingSupervisor,
      slaBreached,
      totalAssets,
      availableAssets,
      lowStock,
      failedLoginsToday,
      eventsToday,
      decisions,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { isActive: true } }),
      this.users.count({ where: { lockedUntil: MoreThan(now) } }),
      this.countUsersByRole(),
      this.requisitions.count({
        where: { status: RequisitionStatus.PENDING_SUPERVISOR },
      }),
      this.requisitions.count({
        where: {
          status: RequisitionStatus.PENDING_SUPERVISOR,
          slaDeadline: LessThan(now),
        },
      }),
      this.assets.count(),
      this.assets.count({ where: { status: AssetStatus.AVAILABLE } }),
      this.countLowStock(),
      this.countFailedLoginsSince(startOfToday),
      this.audit.count({ where: { timestamp: MoreThanOrEqual(startOfToday) } }),
      this.countDecisions(admin),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        locked: lockedUsers,
        byRole,
      },
      requisitions: { pendingSupervisor, slaBreached },
      assets: { total: totalAssets, available: availableAssets, lowStock },
      audit: { failedLoginsToday, eventsToday },
      decisions,
      generatedAt: now.toISOString(),
    };
  }

  // The three Master Admin escalation screens (Returns & Incidents, Repairs, Requisition Fulfillment) list
  // everything, but only a custodian's own item is the administrator's to decide. Each service already knows
  // that rule (`canAct`, `fulfilmentFallback`), so ask them instead of copying it: the dashboard number is then
  // exactly the number of items with decision buttons on those screens.
  private async countDecisions(
    admin: UserEntity,
  ): Promise<AdminDashboardStats['decisions']> {
    const [requests, openRepairs, fulfilment] = await Promise.all([
      this.assetRequests.findQueue(admin, 'open'),
      this.repairs.list(admin, 'open'),
      this.requisitionsService.fulfilmentFallback(),
    ]);
    return {
      returnsIncidents: requests.filter((r) => r.canAct).length,
      repairs: openRepairs.filter((r) => r.canAct).length,
      requisitions: fulfilment.total,
    };
  }

  // Failed sign-in attempts. A superseded session's rejected refresh is audited
  // as USER_LOGIN_FAILED too (no enum value of its own), but it is session
  // churn, not a wrong password — counting it made the dashboard report
  // password-guessing that never happened.
  private countFailedLoginsSince(since: Date): Promise<number> {
    return this.audit
      .createQueryBuilder('a')
      .where('a.action = :action', { action: AuditAction.USER_LOGIN_FAILED })
      .andWhere('a.timestamp >= :since', { since })
      .andWhere("COALESCE(a.metadata ->> 'reason', '') <> :reuse", {
        reuse: AUDIT_REASON_REFRESH_TOKEN_REUSE,
      })
      .getCount();
  }

  // Every assignable role starts at 0 so the dashboard renders a complete legend
  // even for roles that have no accounts yet. The retired Property Officer role
  // appears only while an account still holds it: that is a leftover to migrate.
  private async countUsersByRole(): Promise<Partial<Record<UserRole, number>>> {
    const rows = await this.users
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.role')
      .getRawMany<{ role: UserRole; count: string }>();

    const byRole = ASSIGNABLE_USER_ROLES.reduce(
      (acc, role) => ({ ...acc, [role]: 0 }),
      {} as Partial<Record<UserRole, number>>,
    );
    for (const { role, count } of rows) {
      byRole[role] = Number(count);
    }
    return byRole;
  }

  // Mirrors AssetsService.checkLowStock(): an IES supply line at or below its
  // per-item reorder level, falling back to the SystemConfig default. Unlike the
  // watcher this ignores lowStockNotifiedAt — the dashboard wants the current
  // count, not "how many alerts are still un-sent".
  private countLowStock(): Promise<number> {
    return this.assets
      .createQueryBuilder('a')
      .where('a.assetClass = :cls', { cls: AssetClass.IES })
      .andWhere('a.quantity <= COALESCE(a.reorderLevel, :fallback)', {
        fallback: this.systemConfig.getDefaultReorderLevel(),
      })
      .getCount();
  }
}
