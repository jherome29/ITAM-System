import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { RequisitionEntity } from './entities/requisition.entity';
import { RequisitionItemEntity } from './entities/requisition-item.entity';
import { RequisitionApprovalEntity } from './entities/requisition-approval.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AssetsModule } from '../assets/assets.module';
import { SystemConfigModule } from '../system-config/system-config.module';

// SVC: Engage & Design and Transition — multi-level approval workflow

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RequisitionEntity,
      RequisitionItemEntity,
      RequisitionApprovalEntity,
    ]),
    AuditModule,
    NotificationsModule,
    forwardRef(() => UsersModule), // forwardRef prevents circular dep with UsersModule
    // fulfill() calls AssetsService for the inline post-fulfillment low-stock
    // check; the txn-scoped asset decrement uses em.getRepository(AssetEntity),
    // which resolves from the global DataSource, so no forFeature([AssetEntity])
    // is needed here. AssetsModule → UsersModule → forwardRef(RequisitionsModule)
    // already forms a resolvable cycle, so RequisitionsModule → AssetsModule
    // needs the matching forwardRef.
    forwardRef(() => AssetsModule),
    SystemConfigModule,
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
