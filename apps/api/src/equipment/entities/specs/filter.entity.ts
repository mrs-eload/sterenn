import { FilterType, type Passband } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer.js';
import { sqlList } from '../../../common/sql-list.js';
import { Equipment } from '../equipment.entity.js';

// A mounted filter records its thread as an equipment_thread row; an
// unmounted one records disc_diameter_mm instead.
@Entity('filter')
@Check(`filter_type IN (${sqlList(FilterType)})`)
export class Filter {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.filter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<Equipment>;

  @Column({ type: 'varchar', length: 255 })
  filter_type: FilterType;

  @Column({ ...decimal_column, nullable: true })
  disc_diameter_mm: number | null;

  // simple-json, not a native JSON type, to stay portable (ADR 0004 section 6).
  @Column({ type: 'simple-json', nullable: true })
  passbands: Passband[] | null;
}
