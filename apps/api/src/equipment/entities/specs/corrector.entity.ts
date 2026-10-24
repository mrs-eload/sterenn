import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { decimal_column } from '../../../common/decimal.transformer.js';
import { Equipment } from '../equipment.entity.js';

// Reducer, flattener or barlow.
@Entity('corrector')
export class Corrector {
  @PrimaryColumn('uuid')
  equipment_id: string;

  @OneToOne(() => Equipment, (equipment) => equipment.corrector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Relation<Equipment>;

  @Column(decimal_column)
  focal_multiplier: number;
}
