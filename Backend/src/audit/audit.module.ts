import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AssetRequestEntity } from '../asset-requests/entities/asset-request.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';

// SVC: Improve — immutable audit trail for all system transactions
// CRITICAL: audit_logs table is APPEND-ONLY — no UPDATE or DELETE endpoints.
// This is a hard constraint for COA compliance and RA 10173 (Data Privacy Act).

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLogEntity,
      AssetEntity,
      UserEntity,
      AssetRequestEntity,
      RequisitionEntity,
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService], // Exported so every module can log actions
})
export class AuditModule {}
