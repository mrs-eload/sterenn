import { SensorColor } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer';
import { sqlList } from '../../../common/sql-list';
import { Equipment } from '../equipment.entity';

// Used as main or guide camera; the role comes from where a rig references it.
@Entity('camera')
@Check(`sensor_color IN (${sqlList(SensorColor)})`)
export class Camera {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column(decimal_column)
  pixel_size_um: number;

  @Column({ type: 'integer' })
  resolution_x: number;

  @Column({ type: 'integer' })
  resolution_y: number;

  @Column({ type: 'varchar', length: 255 })
  sensor_color: SensorColor;

  // The sensor part, e.g. "Sony IMX585".
  @Column({ type: 'varchar', length: 255, nullable: true })
  sensor_chip: string | null;

  @Column({ type: 'boolean', nullable: true })
  cooled: boolean | null;

  @Column({ ...decimal_column, nullable: true })
  read_noise_e: number | null;

  @Column({ type: 'integer', nullable: true })
  full_well_e: number | null;

  // The gain at which read_noise_e and full_well_e were measured.
  @Column({ type: 'integer', nullable: true })
  measured_at_gain: number | null;
}
