import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetRequestsController } from './asset-requests.controller';
import { AssetRequestsService } from './asset-requests.service';
import { AssetRequestEntity } from './entities/asset-request.entity';
import { AssetRequestAttachmentEntity } from './entities/asset-request-attachment.entity';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { GeneratedFormEntity } from '../reports/entities/generated-form.entity';

// SVC: Deliver & Support — returns, repairs and incident reporting.

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetRequestEntity,
      AssetRequestAttachmentEntity,
      GeneratedFormEntity, // documents linked to a request
    ]),
    AssetsModule, // completing a request drives AssetsService.updateLifecycle
    ReportsModule, // completing a request generates its COA documents
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [AssetRequestsController],
  providers: [AssetRequestsService],
})
export class AssetRequestsModule {}
