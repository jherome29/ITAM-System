import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  ASSIGNABLE_USER_ROLES,
  UserRole,
} from '../../../../packages/shared/src/enums';
import { FIELD_MAX } from '../../common/field-limits';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.employeeId)
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.code)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.code)
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

  @IsIn(ASSIGNABLE_USER_ROLES, {
    message: `role must be one of: ${ASSIGNABLE_USER_ROLES.join(', ')}`,
  })
  role!: UserRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.code)
  division!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_MAX.code)
  officeOrSection!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) firstName?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) division?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) officeOrSection?: string;

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
  @IsIn(ASSIGNABLE_USER_ROLES, {
    message: `role must be one of: ${ASSIGNABLE_USER_ROLES.join(', ')}`,
  })
  role!: UserRole;
}

/** Body for PATCH /api/v1/users/me/availability — supervisor self-service. */
export class AvailabilityDto {
  @IsBoolean() unavailable!: boolean;
  @IsOptional() @IsDateString() unavailableUntil?: string | null;
}
