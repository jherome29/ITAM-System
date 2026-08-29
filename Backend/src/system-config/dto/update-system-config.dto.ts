import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class UsefulLifeYearsDto {
  @IsInt()
  @Min(1)
  PPE!: number;

  @IsInt()
  @Min(1)
  SEP!: number;

  @IsInt()
  @Min(1)
  IES!: number;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  slaApprovalHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultReorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLoginAttempts?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UsefulLifeYearsDto)
  usefulLifeYears?: UsefulLifeYearsDto;
}
