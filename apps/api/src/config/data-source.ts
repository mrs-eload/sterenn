import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Init1792783457511 } from '../../migrations/1792783457511-Init';
import { CameraSensorChip1792789358882 } from '../../migrations/1792789358882-CameraSensorChip';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { EquipmentThread } from '../equipment/entities/equipment-thread.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { RigChainItem } from '../equipment/entities/rig-chain-item.entity';
import { RigFilter } from '../equipment/entities/rig-filter.entity';
import { Rig } from '../equipment/entities/rig.entity';
import { Camera } from '../equipment/entities/specs/camera.entity';
import { Corrector } from '../equipment/entities/specs/corrector.entity';
import { FilterHolder } from '../equipment/entities/specs/filter-holder.entity';
import { Filter } from '../equipment/entities/specs/filter.entity';
import { Mount } from '../equipment/entities/specs/mount.entity';
import { Telescope } from '../equipment/entities/specs/telescope.entity';
import { ThreadSize } from '../equipment/entities/thread-size.entity';
import { env } from './env';

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
