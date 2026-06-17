import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
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
