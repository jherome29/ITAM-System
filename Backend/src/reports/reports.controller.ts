import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Response } from 'express';
import { ReportsService, GenerateFormInput } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OfficialFormType } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthReq {
  user: UserEntity;
  ip: string;
}

class GenerateReportDto {
  @IsString() reportType!: string;
  @IsString() format!: 'PDF' | 'Excel';
}

class GenerateFormDto implements GenerateFormInput {
  @IsEnum(OfficialFormType) formType!: OfficialFormType;
  @IsOptional() @IsUUID() assetId?: string;
  @IsOptional() @IsUUID() requisitionId?: string;
  @IsOptional() @IsString() targetOffice?: string;
  @IsOptional() @IsString() circumstances?: string;
  @IsOptional() @IsString() lossType?:
    | 'Lost'
    | 'Stolen'
    | 'Damaged'
    | 'Destroyed';
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() requestingDivision?: string;
  @IsOptional() @IsUUID() returneeId?: string;
  @IsOptional() @IsUUID() receiverId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

// SVC: Improve — management reports and COA official form generation

@Controller('v1/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  /**
   * GET /api/v1/reports
   * Paginated list of generated management reports.
   */
  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 50) {
    const result = await this.svc.findAll(+page, +limit);
    return { message: 'Reports retrieved', data: result };
  }

  /**
   * GET /api/v1/reports/forms
   * Paginated list of generated COA forms.
   */
  @Get('forms')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
  async findAllForms(@Query('page') page = 1, @Query('limit') limit = 50) {
    const result = await this.svc.findAllForms(+page, +limit);
    return { message: 'Forms retrieved', data: result };
  }

  /**
   * GET /api/v1/reports/kpi
   * Management dashboard KPIs (inventoryAccuracy, avgApprovalHours, slaComplianceRate, …).
   */
  @Get('kpi')
  @Roles(UserRole.MANAGEMENT, UserRole.SYSTEM_ADMIN)
  async getKpi() {
    const result = await this.svc.getKpi();
    return { message: 'KPI data retrieved', data: result };
  }

  /**
   * POST /api/v1/reports/generate
   * Generate a management report as a binary PDF or Excel file.
   * Streams the file directly to the browser as an attachment.
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async generate(
    @Body() dto: GenerateReportDto,
    @Req() req: AuthReq,
    @Res() res: Response,
  ) {
    const format = dto.format.toUpperCase() as 'PDF' | 'Excel';
    const { buffer } = await this.svc.generate(
      dto.reportType,
      format,
      req.user.id,
      req.user.role,
      req.ip,
    );
    const isPdf = format === 'PDF';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const mimeType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = `${dto.reportType}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * GET /api/v1/reports/forms/:id/download
   * Stream a previously stored COA form PDF from the database.
   */
  @Get('forms/:id/download')
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async downloadForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { form, buffer } = await this.svc.downloadForm(id);
    const date = form.generatedAt.toISOString().slice(0, 10);
    const filename = `${form.formType}-${date}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * POST /api/v1/reports/forms/generate
   * Generate a COA official form PDF and stream it directly to the browser.
   * Response: application/pdf (binary, not JSON).
   * Audit log entry is written inside the service.
   */
  @Post('forms/generate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
  async generateForm(
    @Body() dto: GenerateFormDto,
    @Req() req: AuthReq,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.generateForm(
      dto,
      req.user.id,
      req.user.role,
      req.ip,
    );
    const filename = `${dto.formType}-${Date.now()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
