import { randomUUID } from 'node:crypto';
import { Column, Entity, PrimaryColumn, Unique } from 'typeorm';
import { decimal_column } from '../../common/decimal.transformer.js';

// A thread dimension, e.g. M48x0.75. One row per size, so a size has one
// common name shared by every thread that uses it.
@Entity('thread_size')
@Unique(['diameter_mm', 'pitch_mm'])
export class ThreadSize {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column(decimal_column)
  diameter_mm: number;

  @Column(decimal_column)
  pitch_mm: number;

  // Common name, e.g. "T2".
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;
}
