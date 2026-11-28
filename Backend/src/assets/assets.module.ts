import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AssetRepairEntity } from './entities/asset-repair.entity';
import { AssetRepairsService } from './asset-repairs.service';
import { RepairsController } from './repairs.controller';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { ReportsModule } from '../reports/reports.module';

// SVC: Obtain/Build & Deliver and Support — asset registration and lifecycle management

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetEntity,
      AssetTransactionEntity,
      AssetRepairEntity, // repair records — opened/closed by updateLifecycle
    ]),
    AuditModule,
    UsersModule, // Required — employeeId lookup for ISSUED transitions
    NotificationsModule, // Required — overdue-return watcher fires alerts
    SystemConfigModule, // Required — default reorder level for low-stock checks
    ReportsModule, // a repair's paper copy (record printouts)
  ],
  controllers: [AssetsController, RepairsController],
  providers: [AssetsService, AssetRepairsService],
  exports: [AssetsService, AssetRepairsService],
})
export class AssetsModule {}
