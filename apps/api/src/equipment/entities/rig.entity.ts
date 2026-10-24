import { randomUUID } from 'node:crypto';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { RigChainItem } from './rig-chain-item.entity';
import { RigFilter } from './rig-filter.entity';
import { Camera } from './specs/camera.entity';
import { Mount } from './specs/mount.entity';
import { Telescope } from './specs/telescope.entity';

@Entity('rig')
export class Rig {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column('uuid')
  owner_id: string;

  // Referenced by entity name so EquipmentModule imports nothing from
  // AuthModule but the guard and the user id (ADR 0004 section 4).
  @ManyToOne('User')
  @JoinColumn({ name: 'owner_id' })
  owner: object;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Several rigs may be current at once; not enforced to one.
  @Column({ type: 'boolean', default: false })
  is_current: boolean;

  // Nullable only so a rig survives the deletion of its parts (ADR 0004
  // section 9). A rig without one is reported as incomplete.
  @Column({ type: 'uuid', nullable: true })
  mount_id: string | null;

  @ManyToOne(() => Mount, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mount_id' })
  mount: Mount | null;

  @Column({ type: 'uuid', nullable: true })
  guide_telescope_id: string | null;

  @ManyToOne(() => Telescope, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'guide_telescope_id' })
  guide_telescope: Telescope | null;

  @Column({ type: 'uuid', nullable: true })
  guide_camera_id: string | null;

  @ManyToOne(() => Camera, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'guide_camera_id' })
  guide_camera: Camera | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => RigChainItem, (chain_item) => chain_item.rig, { cascade: true })
  chain_items: RigChainItem[];

  @OneToMany(() => RigFilter, (rig_filter) => rig_filter.rig, { cascade: true })
  filters: RigFilter[];
}
