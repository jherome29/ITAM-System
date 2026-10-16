import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
  IsPositive,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COST_MAX, COUNT_MAX, FIELD_MAX } from '../../common/field-limits';
import { AssetCondition } from '../../../../packages/shared/src/enums';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.code)
  sapClassification?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) itemCode?: string;
  @IsOptional() @IsString() itemDescription?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) brand?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) propertyNumber?: string;
  @IsOptional() @IsString() components?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(COST_MAX)
  @Type(() => Number)
  acquisitionCost?: number;

  @IsOptional() @IsDateString() acquisitionDate?: string;
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX.long)
  accountableOfficer?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) division?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.code) officeOrSection?: string;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.long) officeLocation?: string;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @IsString() @MaxLength(FIELD_MAX.long) supplier?: string;
  @IsOptional() @IsDateString() dateOfDelivery?: string;

  // ── Stock (IES supply lines only) ───────────────────────────────────────
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  @Type(() => Number)
  quantity?: number; // units on hand — IES stock lines; PPE/SEP stay 1

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  @Type(() => Number)
  reorderLevel?: number; // low-stock threshold for this item
}
