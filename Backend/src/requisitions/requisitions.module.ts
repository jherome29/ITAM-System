import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { RequisitionEntity } from './entities/requisition.entity';
import { RequisitionItemEntity } from './entities/requisition-item.entity';
import { RequisitionApprovalEntity } from './entities/requisition-approval.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AssetsModule } from '../assets/assets.module';

// SVC: Engage & Design and Transition — multi-level approval workflow

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RequisitionEntity,
      RequisitionItemEntity,
      RequisitionApprovalEntity,
      AssetEntity, // fulfill() decrements IES supply stock directly
    ]),
    AuditModule,
    NotificationsModule,
    forwardRef(() => UsersModule), // forwardRef prevents circular dep with UsersModule
    // AssetsModule → UsersModule → forwardRef(RequisitionsModule) already forms
    // a resolvable cycle; adding RequisitionsModule → AssetsModule needs the
    // matching forwardRef here (fulfill() calls AssetsService for the inline
    // low-stock check).
    forwardRef(() => AssetsModule),
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
