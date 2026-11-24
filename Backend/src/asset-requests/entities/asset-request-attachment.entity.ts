import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AssetRequestEntity } from './asset-request.entity';

export type AttachmentStage = 'request' | 'receipt';

/**
 * A photo or PDF supporting a return / incident request. Stored in-row as bytea
 * like GeneratedFormEntity.pdfContent (CLAUDE.md §11#10): `content` is
 * select:false, so load it only through a QueryBuilder with an explicit
 * `.addSelect('a.content')`.
 */
@Entity('asset_request_attachments')
export class AssetRequestAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requestId!: string;

  @ManyToOne(() => AssetRequestEntity, (r) => r.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request!: AssetRequestEntity;

  // 'request' — evidence filed by the holder; 'receipt' — condition photos the
  // custodian took when marking the item received (schema 011).
  @Column({ type: 'varchar', length: 10, default: 'request' })
  stage!: AttachmentStage;

  @Column({ type: 'uuid', nullable: true })
  uploadedById!: string | null;

  @Column({ type: 'varchar', length: 120 })
  fileName!: string;

  @Column({ type: 'varchar', length: 50 })
  mimeType!: string; // detected from the file's magic bytes, never the client

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'bytea', select: false })
  content!: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
