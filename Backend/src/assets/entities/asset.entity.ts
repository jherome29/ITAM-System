import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import {
  AssetClass,
  AssetCondition,
  AssetStatus,
  AssetType,
} from '../../../../packages/shared/src/enums';
import { AssetTransactionEntity } from './asset-transaction.entity';

@Entity('assets')
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  sapClassification!: string;

  @Column({ nullable: true })
  itemCode!: string;

  @Column()
  itemDescription!: string;

  @Column({ nullable: true })
  brand!: string;

  @Column({ nullable: true })
  serialNumber!: string;

  @Column({ nullable: true, unique: true })
  propertyNumber!: string;

  @Column({ nullable: true, type: 'text' })
  components!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  acquisitionCost!: number;

  @Column({ nullable: true, type: 'date' })
  acquisitionDate!: Date;

  @Column({ nullable: true })
  accountableOfficer!: string;

  @Column({ nullable: true })
  division!: string;

  @Column({ nullable: true })
  officeOrSection!: string;

  @Column({ nullable: true })
  officeLocation!: string;

  @Column({
    type: 'enum',
    enum: AssetCondition,
    default: AssetCondition.SERVICEABLE,
  })
  condition!: AssetCondition;

  @Column({ nullable: true })
  supplier!: string;

  @Column({ nullable: true, type: 'date' })
  dateOfDelivery!: Date;

  @Column({ type: 'enum', enum: AssetClass })
  assetClass!: AssetClass;

  @Column({ type: 'enum', enum: AssetType })
  assetType!: AssetType;

  @Column({ nullable: true, unique: true })
  qrCode!: string;

  @Column({ nullable: true, unique: true })
  barcodeValue!: string;

  @Column({ type: 'enum', enum: AssetStatus, default: AssetStatus.REGISTERED })
  status!: AssetStatus;

  @Column({ nullable: true, type: 'uuid' })
  custodianId!: string | null;

  @OneToMany(() => AssetTransactionEntity, (tx) => tx.asset, { eager: false })
  locationHistory!: AssetTransactionEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
