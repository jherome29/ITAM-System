import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigService } from '../system-config/system-config.service';
import {
  AssetClass,
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
    byRole: Record<UserRole, number>;
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
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
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
      this.audit.count({
        where: {
          action: AuditAction.USER_LOGIN_FAILED,
          timestamp: MoreThanOrEqual(startOfToday),
        },
      }),
      this.audit.count({ where: { timestamp: MoreThanOrEqual(startOfToday) } }),
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
      generatedAt: now.toISOString(),
    };
  }

  // Every role starts at 0 so the dashboard renders a complete legend even for
  // roles that have no accounts yet.
  private async countUsersByRole(): Promise<Record<UserRole, number>> {
    const rows = await this.users
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.role')
      .getRawMany<{ role: UserRole; count: string }>();

    const byRole = Object.values(UserRole).reduce(
      (acc, role) => ({ ...acc, [role]: 0 }),
      {} as Record<UserRole, number>,
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
