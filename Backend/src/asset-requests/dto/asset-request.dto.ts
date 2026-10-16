import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AssetRequestType } from '../../../../packages/shared/src/enums';

/** Body of POST /asset-requests (multipart — files travel as `attachments`). */
export class CreateAssetRequestDto {
  @IsUUID()
  assetId!: string;

  @IsEnum(AssetRequestType)
  type!: AssetRequestType;

  @IsDateString()
  preferredDate!: string;

  @IsString()
  @MinLength(15, { message: 'Details must be at least 15 characters.' })
  @MaxLength(2000)
  details!: string;
}

export class ApproveAssetRequestDto {
  @IsOptional()
  @IsDateString()
  handoverDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Shortest rejection reason accepted; the screen enforces the same number. */
export const MIN_REJECT_REASON_LENGTH = 10;

export class RejectAssetRequestDto {
  // The reason is the requester's only explanation and stays on the record, so
  // "no" is not one. Counted after trimming, so padding does not help.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'A reason is required to reject a request.' })
  @MinLength(MIN_REJECT_REASON_LENGTH, {
    message: `Give the requester a reason of at least ${MIN_REJECT_REASON_LENGTH} characters.`,
  })
  @MaxLength(1000)
  reason!: string;
}

export const DAMAGE_OUTCOMES = ['repair', 'disposal'] as const;
export type DamageOutcome = (typeof DAMAGE_OUTCOMES)[number];

export class CompleteAssetRequestDto {
  // Damage only: whether the received item goes to repair or is flagged for disposal.
  @IsOptional()
  @IsIn(DAMAGE_OUTCOMES)
  outcome?: DamageOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
