import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer';
import { Equipment } from '../equipment.entity';

// Reducer, flattener or barlow.
@Entity('corrector')
export class Corrector {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.corrector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column(decimal_column)
  focal_multiplier: number;
}
