import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './controllers/equipment.controller.js';
import { RigController } from './controllers/rig.controller.js';
import { ThreadSizeController } from './controllers/thread-size.controller.js';
import { EquipmentThread } from './entities/equipment-thread.entity.js';
import { Equipment } from './entities/equipment.entity.js';
import { RigChainItem } from './entities/rig-chain-item.entity.js';
import { RigFilter } from './entities/rig-filter.entity.js';
import { Rig } from './entities/rig.entity.js';
import { Camera } from './entities/specs/camera.entity.js';
import { Corrector } from './entities/specs/corrector.entity.js';
import { FilterHolder } from './entities/specs/filter-holder.entity.js';
import { Filter } from './entities/specs/filter.entity.js';
import { Mount } from './entities/specs/mount.entity.js';
import { Telescope } from './entities/specs/telescope.entity.js';
import { ThreadSize } from './entities/thread-size.entity.js';
import { EquipmentRepository } from './repositories/equipment.repository.js';
import { RigRepository } from './repositories/rig.repository.js';
import { ThreadSizeRepository } from './repositories/thread-size.repository.js';
import { TypeormEquipmentRepository } from './repositories/typeorm-equipment.repository.js';
import { TypeormRigRepository } from './repositories/typeorm-rig.repository.js';
import { TypeormThreadSizeRepository } from './repositories/typeorm-thread-size.repository.js';
import { RigValidator } from './rules/rig-validator.js';
import { EquipmentService } from './services/equipment.service.js';
import { RigService } from './services/rig.service.js';
import { ThreadSizeService } from './services/thread-size.service.js';

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
