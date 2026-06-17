import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetCondition } from '../../../../packages/shared/src/enums';

export class UpdateAssetDto {
  @IsOptional() @IsString() sapClassification?: string;
  @IsOptional() @IsString() itemCode?: string;
  @IsOptional() @IsString() itemDescription?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() propertyNumber?: string;
  @IsOptional() @IsString() components?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  acquisitionCost?: number;

  @IsOptional() @IsDateString() acquisitionDate?: string;
  @IsOptional() @IsString() accountableOfficer?: string;
  @IsOptional() @IsString() division?: string;
  @IsOptional() @IsString() officeOrSection?: string;
  @IsOptional() @IsString() officeLocation?: string;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsDateString() dateOfDelivery?: string;
}
