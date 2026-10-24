import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Equipment } from './equipment.entity.js';
import { Rig } from './rig.entity.js';
import { Filter } from './specs/filter.entity.js';

// A filter used in a rig.
@Entity('rig_filter')
export class RigFilter {
  @PrimaryColumn('uuid')
  rig_id: string;

  @ManyToOne(() => Rig, (rig) => rig.filters, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'rig_id' })
  rig: Relation<Rig>;

  @PrimaryColumn('uuid')
  filter_id: string;

  @ManyToOne(() => Filter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'filter_id' })
  filter: Relation<Filter>;

  // The chain item the filter sits in. Set to null when the holder is deleted
  // but the filter is not (ADR 0004 section 12).
  @Column({ type: 'uuid', nullable: true })
  holder_id: string | null;

  @ManyToOne(() => Equipment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'holder_id' })
  holder: Relation<Equipment> | null;
}
