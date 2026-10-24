import { MountType } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { sqlList } from '../../../common/sql-list';
import { Equipment } from '../equipment.entity';

@Entity('mount')
@Check(`mount_type IN (${sqlList(MountType)})`)
export class Mount {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.mount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ type: 'varchar', length: 255 })
  mount_type: MountType;

  @Column({ type: 'boolean' })
  goto: boolean;

  @Column({ type: 'integer', nullable: true })
  payload_capacity_g: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  goto_precision: string | null;
}
