import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * LoginDto — validated request body for POST /api/v1/auth/login
 *
 * Accepts either email address or employee ID in the same field.
 * class-validator strips and validates all incoming data before
 * it reaches the service layer (SQL injection prevention layer 1).
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Email or Employee ID is required' })
  emailOrEmployeeId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
