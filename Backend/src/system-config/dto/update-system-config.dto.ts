import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

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
  @ValidateNested()
  @Type(() => UsefulLifeYearsDto)
  usefulLifeYears?: UsefulLifeYearsDto;
}
