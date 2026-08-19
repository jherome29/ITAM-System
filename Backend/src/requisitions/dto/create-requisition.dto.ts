import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AssetClass,
  AssetType,
  RequisitionType,
} from '../../../../packages/shared/src/enums';

export class RequisitionItemDto {
  @IsEnum(AssetType)
  assetType!: AssetType;

  @IsEnum(AssetClass)
  assetClass!: AssetClass;

  @IsString()
  @IsNotEmpty()
  itemDescription!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  justification?: string;
}

/**
 * CreateRequisitionDto — body for POST /requisitions
 * SVC: Engage — employee submits a formal request
 */
export class CreateRequisitionDto {
  @IsEnum(RequisitionType, {
    message: 'requisitionType must be new | replacement | repair | supply',
  })
  requisitionType!: RequisitionType;

  @IsString()
  @IsNotEmpty({ message: 'Justification is required' })
  justification!: string;

  @IsDateString()
  requiredDate!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => RequisitionItemDto)
  items!: RequisitionItemDto[];
}
