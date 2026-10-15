import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { OfficialFormType } from '../../../../packages/shared/src/enums';

@Entity('generated_forms')
export class GeneratedFormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: OfficialFormType })
  formType!: OfficialFormType;

  @Column({ type: 'uuid' })
  generatedById!: string;

  @Column({ nullable: true, type: 'uuid' })
  relatedAssetId!: string | null;

  @Column({ nullable: true, type: 'uuid' })
  relatedRequisitionId!: string | null;

  // Return / incident request this form documents (schema 012) — lets the
  // requester download their own proof of return / incident report.
  @Column({ nullable: true, type: 'uuid' })
  relatedAssetRequestId!: string | null;

  // Running number of the per-transaction forms, e.g. PAR-2026-0007 (schema
  // 016). Null for periodic reports and for forms generated before it existed.
  @Column({ type: 'text', nullable: true })
  documentNumber!: string | null;

  @Column()
  filePath!: string;

  // Stored PDF binary — excluded from list queries via select:false, loaded only on download
  @Column({ type: 'bytea', nullable: true, select: false })
  pdfContent!: Buffer | null;

  @CreateDateColumn()
  generatedAt!: Date;
}
