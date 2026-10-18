import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AssetsService } from './assets.service';
import { AssetRepairsService } from './asset-repairs.service';
import {
  CompleteRepairDto,
  IssueLoanerDto,
  UpdateRepairDto,
} from './dto/repair.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthenticatedRequest {
  user: UserEntity;
  ip: string;
}

const ALL_ROLES = Object.values(UserRole);

const READERS = [
  UserRole.IT_PERSONNEL,
  UserRole.PROPERTY_CUSTODIAN,
  UserRole.SYSTEM_ADMIN,
  UserRole.MANAGEMENT,
];

// SVC: Deliver & Support — maintenance and repair records.
// Custodians act within their asset-type scope (ICT → IT Personnel,
// Fixed/Supplies → Property Custodian); the System Administrator acts only on
// a custodian's own item (AssetRepairsService.canAct). Everyone else reads.
@Controller('v1/repairs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepairsController {
  constructor(
    private readonly repairs: AssetRepairsService,
    private readonly assets: AssetsService,
  ) {}

  /** GET /api/v1/repairs?status=open|closed — scoped queue / history. */
  @Get()
  @Roles(...READERS)
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return {
      message: 'Repairs retrieved',
      data: await this.repairs.list(req.user, status),
    };
  }

  /** GET /api/v1/repairs/asset/:assetId — one asset's repair history. */
  @Get('asset/:assetId')
  @Roles(...READERS)
  async forAsset(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Repair history retrieved',
      data: await this.repairs.listForAsset(assetId, req.user),
    };
  }

  @Get(':id')
  @Roles(...READERS)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Repair retrieved',
      data: await this.repairs.findOneForUser(id, req.user),
    };
  }

  /**
   * POST /api/v1/repairs/:id/print — a numbered paper copy of this repair. The item's holder (an employee)
   * and the custodians, Admin and Management within their scope may print it; each print is stored,
   * numbered and audited, and a later one is marked REPRINT.
   */
  @Post(':id/print')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  async print(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const doc = await this.repairs.printRecord(id, req.user, req.ip);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(doc.buffer.length),
      'Content-Disposition': `inline; filename="${doc.documentNumber}.pdf"`,
      'X-Document-Number': doc.documentNumber ?? '',
      'Cache-Control': 'private, no-store',
    });
    res.end(doc.buffer);
  }

  /** GET /api/v1/repairs/:id/prints — the prints made of this repair (same access). */
  @Get(':id/prints')
  @Roles(...ALL_ROLES)
  async prints(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Printouts retrieved',
      data: await this.repairs.listPrints(id, req.user),
    };
  }

  /** GET /api/v1/repairs/:id/prints/:formId — one stored print again. */
  @Get(':id/prints/:formId')
  @Roles(...ALL_ROLES)
  async printFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const doc = await this.repairs.printPdf(id, formId, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(doc.buffer.length),
      'Content-Disposition': `inline; filename="${doc.documentNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(doc.buffer);
  }

  /** PATCH /api/v1/repairs/:id — service details, expected date, findings. */
  @Patch(':id')
  @Roles(
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
    UserRole.SYSTEM_ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Repair updated',
      data: await this.repairs.update(id, dto, req.user, req.ip),
    };
  }

  /** POST /api/v1/repairs/:id/loaner — lend the holder a unit meanwhile. */
  @Post(':id/loaner')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
    UserRole.SYSTEM_ADMIN,
  )
  async issueLoaner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueLoanerDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Loaner issued',
      data: await this.assets.issueLoaner(id, dto, req.user, req.ip),
    };
  }

  /** POST /api/v1/repairs/:id/complete — repaired or unrepairable. */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
    UserRole.SYSTEM_ADMIN,
  )
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRepairDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Repair completed',
      data: await this.assets.completeRepair(id, dto, req.user, req.ip),
    };
  }
}
