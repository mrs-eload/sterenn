import { MigrationInterface, QueryRunner } from "typeorm";

export class CameraSensorChip1792789358882 implements MigrationInterface {
    name = 'CameraSensorChip1792789358882'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "camera" ADD "sensor_chip" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "camera" DROP COLUMN "sensor_chip"`);
    }

}
