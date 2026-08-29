import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { UserRole } from '../../../../packages/shared/src/enums';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
    message:
      'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
  })
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  @IsNotEmpty()
  division!: string;

  @IsString()
  @IsNotEmpty()
  officeOrSection!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() division?: string;
  @IsOptional() @IsString() officeOrSection?: string;

  // Alternate Approver (CLAUDE.md §5, §17) — accepted only on SUPERVISOR rows.
  // A uuid designates the backup; null clears it.
  @IsOptional() @IsUUID('4') alternateApproverId?: string | null;
  @IsOptional() @IsBoolean() unavailable?: boolean;
  @IsOptional() @IsDateString() unavailableUntil?: string | null;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/, {
    message:
      'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
  })
  newPassword!: string;
}

export class AssignRoleDto {
  @IsEnum(UserRole, {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role!: UserRole;
}

/** Body for PATCH /api/v1/users/me/availability — supervisor self-service. */
export class AvailabilityDto {
  @IsBoolean() unavailable!: boolean;
  @IsOptional() @IsDateString() unavailableUntil?: string | null;
}
