import { randomUUID } from 'node:crypto';
import { EquipmentType } from '@sterenn/shared';
import { Check, Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { sqlList } from '../../common/sql-list';
import { EquipmentThread } from './equipment-thread.entity';
import { Camera } from './specs/camera.entity';
import { Corrector } from './specs/corrector.entity';
import { FilterHolder } from './specs/filter-holder.entity';
import { Filter } from './specs/filter.entity';
import { Mount } from './specs/mount.entity';
import { Telescope } from './specs/telescope.entity';

// The columns common to every item. Type-specific columns live in one specs
// table per type, keyed by this id (ADR 0004 section 7). Only the relation
// matching `type` is ever set; an adapter has none.
@Entity('equipment')
@Check(`type IN (${sqlList(EquipmentType)})`)
export class Equipment {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'varchar', length: 255 })
  type: EquipmentType;

  @Column({ type: 'varchar', length: 255 })
  manufacturer: string;

  @Column({ type: 'varchar', length: 255 })
  model: string;

  @Column({ type: 'integer', nullable: true })
  weight_g: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Mount, (mount) => mount.equipment, { cascade: true })
  mount?: Mount | null;

  @OneToOne(() => Telescope, (telescope) => telescope.equipment, { cascade: true })
  telescope?: Telescope | null;

  @OneToOne(() => Camera, (camera) => camera.equipment, { cascade: true })
  camera?: Camera | null;

  @OneToOne(() => FilterHolder, (filter_holder) => filter_holder.equipment, { cascade: true })
  filter_holder?: FilterHolder | null;

  @OneToOne(() => Filter, (filter) => filter.equipment, { cascade: true })
  filter?: Filter | null;

  @OneToOne(() => Corrector, (corrector) => corrector.equipment, { cascade: true })
  corrector?: Corrector | null;

  @OneToMany(() => EquipmentThread, (thread) => thread.equipment, { cascade: true })
  threads: EquipmentThread[];
}
