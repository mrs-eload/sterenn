import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { env } from './env';

// Shared by the Nest app and the TypeORM CLI (default export), so migrations
// are generated against exactly the entities the app runs with.
export const data_source_options: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
  migrationsRun: true,
  synchronize: false,
};

export default new DataSource(data_source_options);
