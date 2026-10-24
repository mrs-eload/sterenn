import { HolderType } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer.js';
import { sqlList } from '../../../common/sql-list.js';
import { Equipment } from '../equipment.entity.js';

@Entity('filter_holder')
@Check(`holder_type IN (${sqlList(HolderType)})`)
export class FilterHolder {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.filter_holder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<Equipment>;

  @Column({ type: 'varchar', length: 255 })
  holder_type: HolderType;

  @Column({ type: 'integer' })
  positions: number;

  // For unmounted filters.
  @Column({ ...decimal_column, nullable: true })
  accepts_disc_diameter_mm: number | null;
}
