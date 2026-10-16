import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from './entities/system-config.entity';
import {
  CONFIG_KEYS,
  SystemConfigMeta,
  SystemConfigSnapshot,
} from './system-config.keys';
import { AssetClass } from '../../../packages/shared/src/enums';
import {
  SLA_APPROVAL_HOURS,
  DEFAULT_REORDER_LEVEL,
  USEFUL_LIFE_YEARS,
  MAX_LOGIN_ATTEMPTS,
  REPEAT_REPAIR_LIMIT,
  FORM_ENTITY_NAME,
} from '../../../packages/shared/src/constants';

// One repair is routine; the rule is about an item that keeps failing.
export const MIN_REPEAT_REPAIR_LIMIT = 2;

// Longest text the form header has room for.
export const MAX_ENTITY_NAME_LENGTH = 150;
export const MAX_FUND_CLUSTER_LENGTH = 60;

// SVC: Plan — runtime-tunable configuration. Cached on init, refreshed on write.
// TODO(scale-out): single-instance cache — a TTL on reload() is the cheapest multi-instance upgrade
@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private cache = new Map<string, unknown>();
  // Per-key provenance from the system_config row (updated_at / updated_by).
  // Absent = never persisted, so getMeta() reports null/null for that key.
  private meta = new Map<
    string,
    { updatedAt: Date | null; updatedBy: string | null }
  >();

  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repo: Repository<SystemConfigEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      const rows = await this.repo.find();
      this.cache = new Map(rows.map((r) => [r.key, r.value]));
      this.meta = new Map(
        rows.map((r) => [
          r.key,
          { updatedAt: r.updatedAt ?? null, updatedBy: r.updatedBy ?? null },
        ]),
      );
    } catch (err) {
      this.logger.error(
        'system_config unreadable; serving compiled-in defaults',
        err as Error,
      );
    }
  }

  private readInt(key: string, min: number, fallback: number): number {
    const raw = this.cache.get(key);
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= min)
      return raw;
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
    return this.readInt(
      CONFIG_KEYS.DEFAULT_REORDER_LEVEL,
      0,
      DEFAULT_REORDER_LEVEL,
    );
  }

  getMaxLoginAttempts(): number {
    return this.readInt(CONFIG_KEYS.MAX_LOGIN_ATTEMPTS, 1, MAX_LOGIN_ATTEMPTS);
  }

  /** Repairs within the look-back window that make an asset replaceable. */
  getRepeatRepairLimit(): number {
    return this.readInt(
      CONFIG_KEYS.REPEAT_REPAIR_LIMIT,
      MIN_REPEAT_REPAIR_LIMIT,
      REPEAT_REPAIR_LIMIT,
    );
  }

  /** Agency name for the header of every official form. */
  getEntityName(): string {
    const raw = this.cache.get(CONFIG_KEYS.ENTITY_NAME);
    return typeof raw === 'string' && raw.trim()
      ? raw.trim()
      : FORM_ENTITY_NAME;
  }

  /** The Fund Cluster the forms print; '' until CICC has set one. */
  getFundCluster(): string {
    const raw = this.cache.get(CONFIG_KEYS.FUND_CLUSTER);
    return typeof raw === 'string' ? raw.trim() : '';
  }

  getUsefulLifeYears(): Record<AssetClass, number> {
    const raw = this.cache.get(CONFIG_KEYS.USEFUL_LIFE_YEARS);
    const classes = [AssetClass.PPE, AssetClass.SEP, AssetClass.IES] as const;
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      const ok = classes.every(
        (c) => typeof r[c] === 'number' && Number.isInteger(r[c]) && r[c] >= 1,
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
    return { ...USEFUL_LIFE_YEARS };
  }

  private assertInt(v: unknown, min: number): void {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min) {
      throw new BadRequestException(`value must be an integer >= ${min}`);
    }
  }

  private assertText(v: unknown, max: number, required: boolean): void {
    if (typeof v !== 'string') {
      throw new BadRequestException('value must be text');
    }
    if (required && !v.trim()) {
      throw new BadRequestException('value must not be empty');
    }
    if (v.trim().length > max) {
      throw new BadRequestException(`value must be at most ${max} characters`);
    }
  }

  private assertUsefulLife(v: unknown): void {
    if (!v || typeof v !== 'object') {
      throw new BadRequestException('usefulLifeYears must be an object');
    }
    const r = v as Record<string, unknown>;
    for (const c of [AssetClass.PPE, AssetClass.SEP, AssetClass.IES] as const) {
      if (typeof r[c] !== 'number' || !Number.isInteger(r[c]) || r[c] < 1) {
        throw new BadRequestException(
          `usefulLifeYears.${c} must be an integer >= 1`,
        );
      }
    }
  }

  private readonly validators: Record<string, (v: unknown) => void> = {
    [CONFIG_KEYS.SLA_APPROVAL_HOURS]: (v) => this.assertInt(v, 1),
    [CONFIG_KEYS.DEFAULT_REORDER_LEVEL]: (v) => this.assertInt(v, 0),
    [CONFIG_KEYS.MAX_LOGIN_ATTEMPTS]: (v) => this.assertInt(v, 1),
    [CONFIG_KEYS.USEFUL_LIFE_YEARS]: (v) => this.assertUsefulLife(v),
    [CONFIG_KEYS.REPEAT_REPAIR_LIMIT]: (v) =>
      this.assertInt(v, MIN_REPEAT_REPAIR_LIMIT),
    [CONFIG_KEYS.ENTITY_NAME]: (v) =>
      this.assertText(v, MAX_ENTITY_NAME_LENGTH, true),
    [CONFIG_KEYS.FUND_CLUSTER]: (v) =>
      this.assertText(v, MAX_FUND_CLUSTER_LENGTH, false),
  };

  async update(key: string, raw: unknown, updatedBy: string): Promise<void> {
    const validate = this.validators[key];
    if (!validate) {
      throw new BadRequestException(`Unknown config key "${key}"`);
    }
    validate(raw);
    // Text settings are stored trimmed, so what the form prints is what was meant.
    const value = typeof raw === 'string' ? raw.trim() : raw;
    const updatedAt = new Date();
    await this.repo.save({ key, value, updatedBy, updatedAt });
    this.cache.set(key, value);
    this.meta.set(key, { updatedAt, updatedBy });
  }

  // Provenance for every known config key, keyed by CONFIG_KEYS value. A key
  // with no persisted row (still on the compiled-in default) reports null/null.
  getMeta(): Record<string, SystemConfigMeta> {
    return Object.values(CONFIG_KEYS).reduce(
      (acc, key) => {
        const m = this.meta.get(key);
        acc[key] = {
          updatedAt: m?.updatedAt ? m.updatedAt.toISOString() : null,
          updatedBy: m?.updatedBy ?? null,
        };
        return acc;
      },
      {} as Record<string, SystemConfigMeta>,
    );
  }

  getAll(): SystemConfigSnapshot {
    return {
      slaApprovalHours: this.getSlaApprovalHours(),
      defaultReorderLevel: this.getDefaultReorderLevel(),
      usefulLifeYears: this.getUsefulLifeYears(),
      maxLoginAttempts: this.getMaxLoginAttempts(),
      repeatRepairLimit: this.getRepeatRepairLimit(),
      entityName: this.getEntityName(),
      fundCluster: this.getFundCluster(),
      meta: this.getMeta(),
    };
  }
}
