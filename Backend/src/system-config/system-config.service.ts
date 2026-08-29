import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from './entities/system-config.entity';
import { CONFIG_KEYS } from './system-config.keys';
import { AssetClass } from '../../../packages/shared/src/enums';
import {
  SLA_APPROVAL_HOURS,
  DEFAULT_REORDER_LEVEL,
  USEFUL_LIFE_YEARS,
  MAX_LOGIN_ATTEMPTS,
} from '../../../packages/shared/src/constants';

// SVC: Plan — runtime-tunable configuration. Cached on init, refreshed on write.
@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private cache = new Map<string, unknown>();

  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repo: Repository<SystemConfigEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const rows = await this.repo.find();
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
  }

  private readInt(key: string, min: number, fallback: number): number {
    const raw = this.cache.get(key);
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= min) return raw;
    if (raw !== undefined) {
      this.logger.warn(
        `config "${key}" = ${JSON.stringify(raw)} is invalid; using default ${fallback}`,
      );
    }
    return fallback;
  }

  getSlaApprovalHours(): number {
    return this.readInt(CONFIG_KEYS.SLA_APPROVAL_HOURS, 1, SLA_APPROVAL_HOURS);
  }

  getDefaultReorderLevel(): number {
    return this.readInt(CONFIG_KEYS.DEFAULT_REORDER_LEVEL, 0, DEFAULT_REORDER_LEVEL);
  }

  getMaxLoginAttempts(): number {
    return this.readInt(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, 1, MAX_LOGIN_ATTEMPTS);
  }

  getUsefulLifeYears(): Record<AssetClass, number> {
    const raw = this.cache.get(CONFIG_KEYS.USEFUL_LIFE_YEARS);
    const classes = [AssetClass.PPE, AssetClass.SEP, AssetClass.IES] as const;
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      const ok = classes.every(
        (c) =>
          typeof r[c] === 'number' &&
          Number.isInteger(r[c]) &&
          (r[c] as number) >= 1,
      );
      if (ok) {
        return {
          [AssetClass.PPE]: r[AssetClass.PPE],
          [AssetClass.SEP]: r[AssetClass.SEP],
          [AssetClass.IES]: r[AssetClass.IES],
        } as Record<AssetClass, number>;
      }
      this.logger.warn(
        `config "${CONFIG_KEYS.USEFUL_LIFE_YEARS}" is invalid; using defaults`,
      );
    }
    return USEFUL_LIFE_YEARS;
  }
}
