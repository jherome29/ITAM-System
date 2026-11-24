import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The last running number handed out for a form series in a year (schema 016).
 * Incremented only through allocateDocumentNumber(), with one atomic upsert, so
 * it is declared here for the schema (the e2e suite builds its tables from the
 * entities) and never read or written through the repository.
 */
@Entity('document_counters')
export class DocumentCounterEntity {
  @PrimaryColumn({ type: 'text' })
  series!: string;

  @PrimaryColumn({ type: 'integer' })
  year!: number;

  @Column({ type: 'integer', default: 0 })
  lastValue!: number;
}
