import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemConfigModule } from '../system-config/system-config.module';

// SVC: Obtain/Build & Deliver and Support — asset registration and lifecycle management

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetEntity, AssetTransactionEntity]),
    AuditModule,
    UsersModule, // Required — employeeId lookup for ISSUED transitions
    NotificationsModule, // Required — overdue-return watcher fires alerts
    SystemConfigModule, // Required — default reorder level for low-stock checks
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
