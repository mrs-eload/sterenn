import { OpticalDesign } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer';
import { sqlList } from '../../../common/sql-list';
import { Equipment } from '../equipment.entity';

// Used as main or guide telescope; the role comes from where a rig references it.
@Entity('telescope')
@Check(`optical_design IN (${sqlList(OpticalDesign)})`)
export class Telescope {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.telescope, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ type: 'varchar', length: 255 })
  optical_design: OpticalDesign;

  @Column(decimal_column)
  aperture_mm: number;

  @Column(decimal_column)
  focal_length_mm: number;

  // A single fixed backfocus is stored as min = max.
  @Column({ ...decimal_column, nullable: true })
  backfocus_min_mm: number | null;

  @Column({ ...decimal_column, nullable: true })
  backfocus_max_mm: number | null;

  @Column({ ...decimal_column, nullable: true })
  backfocus_recommended_mm: number | null;

  @Column({ ...decimal_column, nullable: true })
  tube_length_mm: number | null;
}
