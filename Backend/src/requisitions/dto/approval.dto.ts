import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

/** Body for POST /requisitions/:id/fulfill */
export class FulfillRequisitionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  /** Asset IDs issued per line item — maps to requisition_items.fulfilled_asset_id */
  @IsOptional()
  fulfilledItems?: { requisitionItemId: string; assetId: string }[];
}
