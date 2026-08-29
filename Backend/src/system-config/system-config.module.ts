import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from './entities/system-config.entity';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';
import { AuditModule } from '../audit/audit.module';

// SVC: Plan — runtime configuration store.
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity]), AuditModule],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
