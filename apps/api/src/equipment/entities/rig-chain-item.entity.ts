import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Equipment } from './equipment.entity';
import { Rig } from './rig.entity';

// The optical parts of a rig in order, telescope first, camera last. Keyed by
// position rather than equipment so the same adapter can appear twice.
@Entity('rig_chain_item')
export class RigChainItem {
  @PrimaryColumn('uuid')
  rig_id: string;

  // orphanedRowAction 'delete': a shorter chain on PUT deletes the extra rows.
  @ManyToOne(() => Rig, (rig) => rig.chain_items, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'rig_id' })
  rig: Rig;

  @PrimaryColumn('integer')
  sort_order: number;

  @Column('uuid')
  equipment_id: string;

  @ManyToOne(() => Equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;
}
