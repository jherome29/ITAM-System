import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';

// SVC: Improve — immutable audit trail for all system transactions
// CRITICAL: audit_logs table is APPEND-ONLY — no UPDATE or DELETE endpoints.
// This is a hard constraint for COA compliance and RA 10173 (Data Privacy Act).

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService], // Exported so every module can log actions
})
export class AuditModule {}
