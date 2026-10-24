import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './controllers/equipment.controller';
import { RigController } from './controllers/rig.controller';
import { ThreadSizeController } from './controllers/thread-size.controller';
import { EquipmentThread } from './entities/equipment-thread.entity';
import { Equipment } from './entities/equipment.entity';
import { RigChainItem } from './entities/rig-chain-item.entity';
import { RigFilter } from './entities/rig-filter.entity';
import { Rig } from './entities/rig.entity';
import { Camera } from './entities/specs/camera.entity';
import { Corrector } from './entities/specs/corrector.entity';
import { FilterHolder } from './entities/specs/filter-holder.entity';
import { Filter } from './entities/specs/filter.entity';
import { Mount } from './entities/specs/mount.entity';
import { Telescope } from './entities/specs/telescope.entity';
import { ThreadSize } from './entities/thread-size.entity';
import { EquipmentRepository } from './repositories/equipment.repository';
import { RigRepository } from './repositories/rig.repository';
import { ThreadSizeRepository } from './repositories/thread-size.repository';
import { TypeormEquipmentRepository } from './repositories/typeorm-equipment.repository';
import { TypeormRigRepository } from './repositories/typeorm-rig.repository';
import { TypeormThreadSizeRepository } from './repositories/typeorm-thread-size.repository';
import { RigValidator } from './rules/rig-validator';
import { EquipmentService } from './services/equipment.service';
import { RigService } from './services/rig.service';
import { ThreadSizeService } from './services/thread-size.service';

// The session guard is global (AuthModule), so nothing from auth is imported
// here except @CurrentUserId where a route needs the owner.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Equipment,
      EquipmentThread,
      Mount,
      Telescope,
      Camera,
      FilterHolder,
      Filter,
      Corrector,
      ThreadSize,
      Rig,
      RigChainItem,
      RigFilter,
    ]),
  ],
  controllers: [EquipmentController, ThreadSizeController, RigController],
  providers: [
    EquipmentService,
    ThreadSizeService,
    RigService,
    RigValidator,
    { provide: EquipmentRepository, useClass: TypeormEquipmentRepository },
    { provide: ThreadSizeRepository, useClass: TypeormThreadSizeRepository },
    { provide: RigRepository, useClass: TypeormRigRepository },
  ],
})
export class EquipmentModule {}
