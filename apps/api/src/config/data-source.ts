import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Init1792783457511 } from '../../migrations/1792783457511-Init.js';
import { CameraSensorChip1792789358882 } from '../../migrations/1792789358882-CameraSensorChip.js';
import { Session } from '../auth/entities/session.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { EquipmentThread } from '../equipment/entities/equipment-thread.entity.js';
import { Equipment } from '../equipment/entities/equipment.entity.js';
import { RigChainItem } from '../equipment/entities/rig-chain-item.entity.js';
import { RigFilter } from '../equipment/entities/rig-filter.entity.js';
import { Rig } from '../equipment/entities/rig.entity.js';
import { Camera } from '../equipment/entities/specs/camera.entity.js';
import { Corrector } from '../equipment/entities/specs/corrector.entity.js';
import { FilterHolder } from '../equipment/entities/specs/filter-holder.entity.js';
import { Filter } from '../equipment/entities/specs/filter.entity.js';
import { Mount } from '../equipment/entities/specs/mount.entity.js';
import { Telescope } from '../equipment/entities/specs/telescope.entity.js';
import { ThreadSize } from '../equipment/entities/thread-size.entity.js';
import { env } from './env.js';

// Shared by the Nest app and the TypeORM CLI (default export), so migrations
// are generated against exactly the entities the app runs with.
// Listed explicitly, not globbed: Vercel only ships the files the entrypoint
// imports, so files found by a runtime glob would be missing from the function.
// A new entity or migration must be added here.
export const data_source_options: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [
    Session,
    User,
    Equipment,
    EquipmentThread,
    ThreadSize,
    Camera,
    Corrector,
    Filter,
    FilterHolder,
    Mount,
    Telescope,
    Rig,
    RigChainItem,
    RigFilter,
  ],
  migrations: [Init1792783457511, CameraSensorChip1792789358882],
  migrationsRun: true,
  synchronize: false,
};

export default new DataSource(data_source_options);
