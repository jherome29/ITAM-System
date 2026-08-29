import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AssetClass,
  AssetCondition,
  AssetType,
} from '../../../../packages/shared/src/enums';

/**
 * CreateAssetDto — all required fields from CLAUDE.md section 5.3 Asset interface.
 * Validated by class-validator before reaching the service layer.
 * SVC: Obtain/Build — asset registration
 */
export class CreateAssetDto {
  // ── SAP / Classification ──────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  sapClassification?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'Item description is required' })
  itemDescription!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  propertyNumber?: string; // Official CICC property number

  @IsOptional()
  @IsString()
  components?: string; // Attached accessories/components

  // ── Financial (identification only — not accounting) ──────────────────────
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  acquisitionCost?: number; // PHP value

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  // ── Accountability ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  accountableOfficer?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  officeOrSection?: string;

  @IsOptional()
  @IsString()
  officeLocation?: string;

  // ── Condition & Classification ─────────────────────────────────────────────
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsDateString()
  dateOfDelivery?: string;

  @IsEnum(AssetClass, { message: 'assetClass must be PPE, SEP, or IES' })
  assetClass!: AssetClass;

  @IsEnum(AssetType, { message: 'assetType must be ICT, Fixed, or Supplies' })
  assetType!: AssetType;

  // ── Stock (IES supply lines only — PPE/SEP stay at the default 1) ─────────
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity?: number; // units on hand — IES stock lines; PPE/SEP stay 1

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number; // low-stock threshold for this item
}
