import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AssetStatus } from '../../../../packages/shared/src/enums';

/**
 * UpdateLifecycleDto — body for PATCH /assets/:id/lifecycle
 *
 * The target status is validated by the state machine in AssetsService.
 * Invalid transitions return 400 with a descriptive error message.
 *
 * SVC: Deliver and Support — authorized lifecycle transitions
 */
export class UpdateLifecycleDto {
  @IsEnum(AssetStatus, {
    message: `status must be one of: ${Object.values(AssetStatus).join(', ')}`,
  })
  status!: AssetStatus;

  @IsOptional()
  @IsUUID()
  custodianId?: string; // Required when issuing or transferring

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  employeeId?: string; // Alternative to custodianId — resolved to UUID by service

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toLocation?: string; // Required for transfer

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fromLocation?: string;

  @IsOptional()
  @IsString()
  notes?: string; // Justification (required for disposal flag)

  @IsOptional()
  @IsDateString()
  expectedReturnDate?: string; // set on ISSUED for loaned assets; drives OVERDUE_RETURN
}
