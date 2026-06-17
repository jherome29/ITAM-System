import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('generated_reports')
export class GeneratedReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  generatedById!: string;

  @Column()
  reportType!: string;

  @Column()
  format!: 'PDF' | 'Excel';

  @Column()
  filePath!: string;

  @CreateDateColumn()
  generatedAt!: Date;
}
