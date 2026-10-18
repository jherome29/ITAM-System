import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigModule } from '../system-config/system-config.module';
import { AssetRequestsModule } from '../asset-requests/asset-requests.module';
import { AssetsModule } from '../assets/assets.module';
import { RequisitionsModule } from '../requisitions/requisitions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RequisitionEntity,
      AssetEntity,
      AuditLogEntity,
    ]),
    // for the reorder-level fallback used in the low-stock count
    SystemConfigModule,
    // "Needs your decision": the same queues the three escalation screens read
    AssetRequestsModule,
    AssetsModule,
    RequisitionsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
