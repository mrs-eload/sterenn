import { randomUUID } from 'node:crypto';
import { ThreadGender, ThreadPosition } from '@sterenn/shared';
import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { sqlList } from '../../common/sql-list';
import { Equipment } from './equipment.entity';
import { ThreadSize } from './thread-size.entity';

// A physical thread on a piece of equipment.
@Entity('equipment_thread')
@Check(`gender IN (${sqlList(ThreadGender)})`)
@Check(`position IN (${sqlList(ThreadPosition)})`)
export class EquipmentThread {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column('uuid')
  equipment_id: string;

  // orphanedRowAction 'delete': replacing an item's threads on PUT deletes the
  // old rows instead of trying to null their equipment_id.
  @ManyToOne(() => Equipment, (equipment) => equipment.threads, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column('uuid')
  thread_size_id: string;

  // A thread size still used by a thread cannot be deleted (ADR 0004 section 12).
  @ManyToOne(() => ThreadSize, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'thread_size_id' })
  thread_size: ThreadSize;

  @Column({ type: 'varchar', length: 255 })
  gender: ThreadGender;

  @Column({ type: 'varchar', length: 255 })
  position: ThreadPosition;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
