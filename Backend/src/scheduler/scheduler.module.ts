import { Module } from '@nestjs/common';
import { RequisitionsModule } from '../requisitions/requisitions.module';
import { AssetsModule } from '../assets/assets.module';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';

// SVC: Engage — standalone scheduling layer. Depends only on RequisitionsModule
// and AssetsModule (both export their service); nothing imports SchedulerModule
// except AppModule, so there is no circular dependency.
@Module({
  imports: [RequisitionsModule, AssetsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
