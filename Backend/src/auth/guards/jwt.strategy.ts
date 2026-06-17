import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string; // User UUID
  employeeId: string;
  role: string;
  tokenVersion: number; // invalidates old JWTs when user logs in again
  iat?: number;
  exp?: number;
}

/**
 * JwtStrategy — validates JWT tokens on every protected request.
 * Attaches the full user object to request.user.
 *
 * SVC: Design & Transition — stateless authentication, Security by Design
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    // tokenVersion mismatch means the user has logged in elsewhere since this token was issued
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return user;
  }
}
