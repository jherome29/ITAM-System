import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { RequisitionsModule } from '../requisitions/requisitions.module';

// SVC: Plan — user account management

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    forwardRef(() => RequisitionsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
