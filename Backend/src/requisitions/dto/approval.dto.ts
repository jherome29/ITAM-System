import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Body for POST /requisitions/:id/approve */
export class ApproveRequisitionDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

/** Body for POST /requisitions/:id/reject — comments required */
export class RejectRequisitionDto {
  @IsString()
  @IsNotEmpty({ message: 'Comments are required when rejecting a requisition' })
  comments!: string;
}

/** One line-item → issued-asset link inside a fulfill request. Both ids are
 *  UUIDs — without this nested validation a raw client string would reach
 *  assetRepo.findOne / itemRepo.update and a non-UUID would surface as a
 *  Postgres error (500) instead of a 400. */
export class FulfilledItemDto {
  @IsUUID()
  requisitionItemId!: string;

  @IsUUID()
  assetId!: string;
}

/** Body for POST /requisitions/:id/fulfill */
export class FulfillRequisitionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  /** Asset IDs issued per line item — maps to requisition_items.fulfilled_asset_id */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfilledItemDto)
  fulfilledItems?: FulfilledItemDto[];
}
