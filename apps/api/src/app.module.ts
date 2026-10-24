import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { data_source_options } from './config/data-source';
import { EquipmentModule } from './equipment/equipment.module';

@Module({
  imports: [TypeOrmModule.forRoot(data_source_options), AuthModule, EquipmentModule],
})
export class AppModule {}
