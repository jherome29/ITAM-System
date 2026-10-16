import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UsefulLifeYearsDto {
  @IsInt()
  @Min(1)
  @Max(100)
  PPE!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  SEP!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  IES!: number;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  slaApprovalHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  defaultReorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxLoginAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  repeatRepairLimit?: number;

  /** Agency name in the header of every official form. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  entityName?: string;

  /** Fund Cluster printed on the forms; an empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fundCluster?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UsefulLifeYearsDto)
  usefulLifeYears?: UsefulLifeYearsDto;
}
