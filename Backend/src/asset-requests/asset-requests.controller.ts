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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AssetRequestsService } from './asset-requests.service';
import {
  ApproveAssetRequestDto,
  CompleteAssetRequestDto,
  CreateAssetRequestDto,
  RejectAssetRequestDto,
} from './dto/asset-request.dto';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  UploadedAttachment,
} from './attachment-files';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthReq {
  user: UserEntity;
  ip: string;
}

// Anyone can be issued an asset, so any role may file on one it holds — the
// service enforces "you must be the current custodian". Deciding is limited to
// the custodian roles, further scoped by asset type in the service.
const ALL_ROLES = [
  UserRole.EMPLOYEE,
  UserRole.SUPERVISOR,
  UserRole.IT_PERSONNEL,
  UserRole.PROPERTY_CUSTODIAN,
  UserRole.PROPERTY_OFFICER,
  UserRole.SYSTEM_ADMIN,
  UserRole.MANAGEMENT,
];

// SVC: Deliver & Support — returns, repairs and incident reporting.

@Controller('v1/asset-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetRequestsController {
  constructor(private readonly svc: AssetRequestsService) {}

  /**
   * POST /api/v1/asset-requests — multipart/form-data.
   * Fields: assetId, type, preferredDate, details. Files: `attachments`
   * (up to 3 × 5 MB; JPG, PNG, WEBP or PDF, verified by content).
   */
  @Post()
  @Roles(...ALL_ROLES)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENTS, {
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS },
    }),
  )
  async create(
    @Body() dto: CreateAssetRequestDto,
    @UploadedFiles() files: UploadedAttachment[] | undefined,
    @Req() req: AuthReq,
  ) {
    const data = await this.svc.create(dto, files, req.user, req.ip);
    return { message: `${data.requestNumber} submitted`, data };
  }

  /** GET /api/v1/asset-requests/mine — requests the caller filed. */
  @Get('mine')
  @Roles(...ALL_ROLES)
  async findMine(@Req() req: AuthReq) {
    return {
      message: 'Requests retrieved',
      data: await this.svc.findMine(req.user.id),
    };
  }

  /**
   * GET /api/v1/asset-requests?status=open|submitted|approved|...
   * Custodian queue (asset-type scoped); Admin / Management see all.
   */
  @Get()
  @Roles(
    UserRole.IT_PERSONNEL,
    UserRole.PROPERTY_CUSTODIAN,
    UserRole.PROPERTY_OFFICER,
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGEMENT,
  )
  async findQueue(@Req() req: AuthReq, @Query('status') status?: string) {
    return {
      message: 'Requests retrieved',
      data: await this.svc.findQueue(req.user, status),
    };
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return {
      message: 'Request retrieved',
      data: await this.svc.findOneForUser(id, req.user),
    };
  }

  /** Streams one attachment; same read access as the request itself. */
  @Get(':id/attachments/:attachmentId')
  @Roles(...ALL_ROLES)
  async attachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: AuthReq,
    @Res() res: Response,
  ) {
    const file = await this.svc.getAttachment(id, attachmentId, req.user);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.content.length),
      'Content-Disposition': `inline; filename="${file.fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(file.content);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveAssetRequestDto,
    @Req() req: AuthReq,
  ) {
    const data = await this.svc.approve(id, dto, req.user, req.ip);
    return { message: `${data.requestNumber} approved`, data };
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAssetRequestDto,
    @Req() req: AuthReq,
  ) {
    const data = await this.svc.reject(id, dto, req.user, req.ip);
    return { message: `${data.requestNumber} rejected`, data };
  }

  /**
   * Item received / incident processed — moves the asset through its lifecycle.
   * JSON or multipart: optional `attachments` are condition-on-receipt photos
   * (same 3 × 5 MB JPG/PNG/WEBP/PDF limits as the request itself).
   */
  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN)
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_ATTACHMENTS, {
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS },
    }),
  )
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteAssetRequestDto,
    @UploadedFiles() files: UploadedAttachment[] | undefined,
    @Req() req: AuthReq,
  ) {
    const data = await this.svc.complete(id, dto, req.user, req.ip, files);
    return { message: `${data.requestNumber} completed`, data };
  }

  /**
   * GET /api/v1/asset-requests/:id/documents/:formId — a COA document generated
   * for this request (receipt / RLSDDP / IIRUP). Same read access as the
   * request, so the requester can download their own proof.
   */
  @Get(':id/documents/:formId')
  @Roles(...ALL_ROLES)
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Req() req: AuthReq,
    @Res() res: Response,
  ) {
    const { form, req: request } = await this.svc.getDocument(
      id,
      formId,
      req.user,
    );
    const pdf = form.pdfContent as Buffer;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Content-Disposition': `attachment; filename="${form.formType}-${request.requestNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(pdf);
  }

  /** Custodian retry for documents that failed to generate on completion. */
  @Post(':id/documents')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN)
  async regenerateDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthReq,
  ) {
    const data = await this.svc.regenerateDocuments(id, req.user, req.ip);
    return { message: 'Documents generated', data };
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_ROLES)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    const data = await this.svc.cancel(id, req.user, req.ip);
    return { message: `${data.requestNumber} cancelled`, data };
  }
}
