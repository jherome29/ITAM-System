import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './guards/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { UserEntity } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

// SVC: Design & Transition — RBAC enforcement, JWT session management
// Security by Design: bcrypt hashing, account lockout, JWT rotation

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') as string,
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '8h') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity]),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, JwtStrategy, RolesGuard, JwtModule],
})
export class AuthModule {}
