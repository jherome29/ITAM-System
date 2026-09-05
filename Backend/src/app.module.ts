import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AssetsModule } from './assets/assets.module';
import { RequisitionsModule } from './requisitions/requisitions.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthController } from './health/health.controller';
import { SystemConfigModule } from './system-config/system-config.module';
import { SnakeNamingStrategy } from './common/snake-naming.strategy';

@Module({
  imports: [
    // Global config — validates ALL required env vars at startup (SECURITY.md §8)
    // App refuses to start if any required var is missing or malformed.
    // abortEarly:false shows ALL missing vars at once instead of one at a time.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('8h'),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        ALLOWED_ORIGIN: Joi.string().default('http://localhost:3000'),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),

    // TypeORM — works against Supabase (dev) and raw PostgreSQL (prod)
    // IMPORTANT: Do NOT use Supabase-specific client features — production runs raw PG
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Schema created via SQL scripts — do not let TypeORM alter it.
        // Exception: NODE_ENV=test only (CI's throwaway e2e Postgres container,
        // destroyed after every run) — this is the "throw-away local environment"
        // carve-out CLAUDE.md §11 allows. Never true in development or production.
        synchronize: config.get<string>('NODE_ENV') === 'test',
        logging: config.get<string>('NODE_ENV') === 'development',
        // Converts camelCase entity properties to snake_case DB columns (employee_id, etc.)
        namingStrategy: new SnakeNamingStrategy(),
        // TLS on the primary DB connection. Default is verified SSL — required by
        // Supabase (dev) and managed production Postgres. DATABASE_SSL overrides:
        //   'disable'    → no SSL          (local docker-compose / CI Postgres)
        //   'no-verify'  → SSL, cert NOT verified (a dev box behind a TLS-
        //                  intercepting proxy — set this in Backend/.env, never
        //                  in code)
        //   unset/other  → SSL, full certificate verification (production)
        // NODE_ENV=test keeps the historical "no SSL" default for CI's throwaway
        // e2e Postgres when DATABASE_SSL is not set.
        ssl: ((): boolean | { rejectUnauthorized: boolean } => {
          const mode = config.get<string>('DATABASE_SSL');
          if (mode === 'disable') return false;
          if (mode === 'no-verify') return { rejectUnauthorized: false };
          if (!mode && config.get<string>('NODE_ENV') === 'test') return false;
          return { rejectUnauthorized: true };
        })(),
      }),
    }),

    // Rate limiting — OWASP ASVS control against brute-force
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute window
        limit: 60, // Max 60 requests per minute per IP
      },
    ]),

    // Cron engine for the automated notification watchers (SchedulerModule)
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    AssetsModule,
    RequisitionsModule,
    AuditModule,
    NotificationsModule,
    ReportsModule,
    SchedulerModule,
    SystemConfigModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiting enforced globally on every route (SECURITY.md §3)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
