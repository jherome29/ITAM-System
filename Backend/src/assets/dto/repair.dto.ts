import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  RepairOutcome,
  RepairServiceType,
} from '../../../../packages/shared/src/enums';

/** PATCH /repairs/:id — progress on an open repair. All fields optional. */
export class UpdateRepairDto {
  @IsOptional()
  @IsEnum(RepairServiceType)
  serviceType?: RepairServiceType;

  /** Service center / technician when sent out. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  serviceProvider?: string;

  /** Empty string clears it (falls back to the default turnaround). */
  @IsOptional()
  @ValidateIf((o: UpdateRepairDto) => o.expectedCompletionDate !== '')
  @IsDateString()
  expectedCompletionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  actionTaken?: string;
}

/** POST /repairs/:id/loaner — lend the holder an available unit meanwhile. */
export class IssueLoanerDto {
  @IsUUID()
  assetId!: string;

  /** Defaults to the repair's due date. */
  @IsOptional()
  @IsDateString()
  expectedReturnDate?: string;
}

/** POST /repairs/:id/complete — record the outcome; drives the asset lifecycle. */
export class CompleteRepairDto {
  @IsEnum(RepairOutcome)
  outcome!: RepairOutcome;

  /** Diagnosis — required when unrepairable (the disposal justification). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string;

  /** What was done (or attempted). */
  @IsString()
  @MinLength(5, { message: 'Describe the work done in at least 5 characters.' })
  @MaxLength(2000)
  actionTaken!: string;

  /** Repaired, but put it into stock instead of back with its holder. */
  @IsOptional()
  @IsBoolean()
  returnToStock?: boolean;
}
