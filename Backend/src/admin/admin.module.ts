import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity } from '../users/entities/user.entity';
import { RequisitionEntity } from '../requisitions/entities/requisition.entity';
import { AssetEntity } from '../assets/entities/asset.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { SystemConfigModule } from '../system-config/system-config.module';

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
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
