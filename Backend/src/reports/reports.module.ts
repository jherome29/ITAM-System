import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { GeneratedReportEntity } from './entities/generated-report.entity';
import { GeneratedFormEntity } from './entities/generated-form.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

// SVC: Improve — report and COA form generation

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeneratedReportEntity,
      GeneratedFormEntity,
      AssetEntity,
      RequisitionEntity,
      UserEntity, // For loading custodians, requesters, and signatories in form generators
    ]),
    AuditModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
