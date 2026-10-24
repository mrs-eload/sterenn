import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1792783457511 implements MigrationInterface {
    name = 'Init1792783457511'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_user" ("id" uuid NOT NULL, "google_sub" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0d3faaaf597c8d6c3f901958b9d" UNIQUE ("google_sub"), CONSTRAINT "PK_22a5c4a3d9b2fb8e4e73fc4ada1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "last_used_at" TIMESTAMP NOT NULL, "user_agent" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a83507eb0338ac037780e02f2b9" UNIQUE ("token_hash"), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "camera" ("equipment_id" uuid NOT NULL, "pixel_size_um" numeric(10,3) NOT NULL, "resolution_x" integer NOT NULL, "resolution_y" integer NOT NULL, "sensor_color" character varying(255) NOT NULL, "cooled" boolean, "read_noise_e" numeric(10,3), "full_well_e" integer, "measured_at_gain" integer, CONSTRAINT "CHK_461d203546a511f323bfe034b3" CHECK (sensor_color IN ('mono', 'color')), CONSTRAINT "PK_20131b6caca127ec609a777b2e6" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "corrector" ("equipment_id" uuid NOT NULL, "focal_multiplier" numeric(10,3) NOT NULL, CONSTRAINT "PK_51b7fc80c959dd10c15c04f709c" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "filter_holder" ("equipment_id" uuid NOT NULL, "holder_type" character varying(255) NOT NULL, "positions" integer NOT NULL, "accepts_disc_diameter_mm" numeric(10,3), CONSTRAINT "CHK_930da05bc8620438f1aa4a4cdd" CHECK (holder_type IN ('wheel', 'drawer')), CONSTRAINT "PK_ee650dfb2717316c512ca473b5e" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "filter" ("equipment_id" uuid NOT NULL, "filter_type" character varying(255) NOT NULL, "disc_diameter_mm" numeric(10,3), "passbands" text, CONSTRAINT "CHK_48587c352f06b370cb3e974dd6" CHECK (filter_type IN ('L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII', 'dual_band', 'other')), CONSTRAINT "PK_42ae44b52e9f38b9fc697f05d8e" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "mount" ("equipment_id" uuid NOT NULL, "mount_type" character varying(255) NOT NULL, "goto" boolean NOT NULL, "payload_capacity_g" integer, "goto_precision" character varying(255), CONSTRAINT "CHK_ff874d23fe680319dc02a07c3a" CHECK (mount_type IN ('equatorial', 'alt_az')), CONSTRAINT "PK_d769a237d396e66dfcc3c1b3fe6" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "telescope" ("equipment_id" uuid NOT NULL, "optical_design" character varying(255) NOT NULL, "aperture_mm" numeric(10,3) NOT NULL, "focal_length_mm" numeric(10,3) NOT NULL, "backfocus_min_mm" numeric(10,3), "backfocus_max_mm" numeric(10,3), "backfocus_recommended_mm" numeric(10,3), "tube_length_mm" numeric(10,3), CONSTRAINT "CHK_a436cb6a987d20be78f00465c3" CHECK (optical_design IN ('refractor', 'reflector', 'catadioptric')), CONSTRAINT "PK_77f38cf66879b28ffa91afdd615" PRIMARY KEY ("equipment_id"))`);
        await queryRunner.query(`CREATE TABLE "equipment" ("id" uuid NOT NULL, "type" character varying(255) NOT NULL, "manufacturer" character varying(255) NOT NULL, "model" character varying(255) NOT NULL, "weight_g" integer, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_753bb285a3a89c338d4b784a75" CHECK (type IN ('mount', 'telescope', 'camera', 'filter_holder', 'filter', 'adapter', 'corrector')), CONSTRAINT "PK_0722e1b9d6eb19f5874c1678740" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "thread_size" ("id" uuid NOT NULL, "diameter_mm" numeric(10,3) NOT NULL, "pitch_mm" numeric(10,3) NOT NULL, "name" character varying(255), CONSTRAINT "UQ_29655090950f58c66c087c8e79c" UNIQUE ("diameter_mm", "pitch_mm"), CONSTRAINT "PK_a876d3d05fa70e40300b21633d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "equipment_thread" ("id" uuid NOT NULL, "equipment_id" uuid NOT NULL, "thread_size_id" uuid NOT NULL, "gender" character varying(255) NOT NULL, "position" character varying(255) NOT NULL, "notes" text, CONSTRAINT "CHK_cb79b7949dd7b8c6d601a6f5fa" CHECK (position IN ('front', 'rear', 'inside')), CONSTRAINT "CHK_d322c89def8ae9556932dd61f2" CHECK (gender IN ('male', 'female')), CONSTRAINT "PK_aae1e56b75b0422f603119c4876" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rig_filter" ("rig_id" uuid NOT NULL, "filter_id" uuid NOT NULL, "holder_id" uuid, CONSTRAINT "PK_d73c220d1b7f41fc8c3d632db87" PRIMARY KEY ("rig_id", "filter_id"))`);
        await queryRunner.query(`CREATE TABLE "rig" ("id" uuid NOT NULL, "owner_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "is_current" boolean NOT NULL DEFAULT false, "mount_id" uuid, "guide_telescope_id" uuid, "guide_camera_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d3b4a400f52482141524817fa8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rig_chain_item" ("rig_id" uuid NOT NULL, "sort_order" integer NOT NULL, "equipment_id" uuid NOT NULL, CONSTRAINT "PK_bec87590772d7c98ee70dfa935a" PRIMARY KEY ("rig_id", "sort_order"))`);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "FK_30e98e8746699fb9af235410aff" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camera" ADD CONSTRAINT "FK_20131b6caca127ec609a777b2e6" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "corrector" ADD CONSTRAINT "FK_51b7fc80c959dd10c15c04f709c" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "filter_holder" ADD CONSTRAINT "FK_ee650dfb2717316c512ca473b5e" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "filter" ADD CONSTRAINT "FK_42ae44b52e9f38b9fc697f05d8e" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mount" ADD CONSTRAINT "FK_d769a237d396e66dfcc3c1b3fe6" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "telescope" ADD CONSTRAINT "FK_77f38cf66879b28ffa91afdd615" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "equipment_thread" ADD CONSTRAINT "FK_24a6a39cbaedc4912ca5c23d446" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "equipment_thread" ADD CONSTRAINT "FK_79c3b55b8fdb6321a41da808018" FOREIGN KEY ("thread_size_id") REFERENCES "thread_size"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig_filter" ADD CONSTRAINT "FK_5a4d1be2783dbea0ffb0087e061" FOREIGN KEY ("rig_id") REFERENCES "rig"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig_filter" ADD CONSTRAINT "FK_59b5d6ee5fd892ae04d90cdc80a" FOREIGN KEY ("filter_id") REFERENCES "filter"("equipment_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig_filter" ADD CONSTRAINT "FK_c455e2c806af7e01dc971c213ef" FOREIGN KEY ("holder_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig" ADD CONSTRAINT "FK_449383a155732142b4bed2eae91" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig" ADD CONSTRAINT "FK_2a728ae714a85a036036376d055" FOREIGN KEY ("mount_id") REFERENCES "mount"("equipment_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig" ADD CONSTRAINT "FK_0e72326b7f389ff2c9491fa3bb0" FOREIGN KEY ("guide_telescope_id") REFERENCES "telescope"("equipment_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig" ADD CONSTRAINT "FK_1d5d2cd53192c2e67ddaa7a32c5" FOREIGN KEY ("guide_camera_id") REFERENCES "camera"("equipment_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig_chain_item" ADD CONSTRAINT "FK_cfeecc2f21b4bfcf2c162e61f36" FOREIGN KEY ("rig_id") REFERENCES "rig"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rig_chain_item" ADD CONSTRAINT "FK_7bdd9c03038d212502c2654f34d" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rig_chain_item" DROP CONSTRAINT "FK_7bdd9c03038d212502c2654f34d"`);
        await queryRunner.query(`ALTER TABLE "rig_chain_item" DROP CONSTRAINT "FK_cfeecc2f21b4bfcf2c162e61f36"`);
        await queryRunner.query(`ALTER TABLE "rig" DROP CONSTRAINT "FK_1d5d2cd53192c2e67ddaa7a32c5"`);
        await queryRunner.query(`ALTER TABLE "rig" DROP CONSTRAINT "FK_0e72326b7f389ff2c9491fa3bb0"`);
        await queryRunner.query(`ALTER TABLE "rig" DROP CONSTRAINT "FK_2a728ae714a85a036036376d055"`);
        await queryRunner.query(`ALTER TABLE "rig" DROP CONSTRAINT "FK_449383a155732142b4bed2eae91"`);
        await queryRunner.query(`ALTER TABLE "rig_filter" DROP CONSTRAINT "FK_c455e2c806af7e01dc971c213ef"`);
        await queryRunner.query(`ALTER TABLE "rig_filter" DROP CONSTRAINT "FK_59b5d6ee5fd892ae04d90cdc80a"`);
        await queryRunner.query(`ALTER TABLE "rig_filter" DROP CONSTRAINT "FK_5a4d1be2783dbea0ffb0087e061"`);
        await queryRunner.query(`ALTER TABLE "equipment_thread" DROP CONSTRAINT "FK_79c3b55b8fdb6321a41da808018"`);
        await queryRunner.query(`ALTER TABLE "equipment_thread" DROP CONSTRAINT "FK_24a6a39cbaedc4912ca5c23d446"`);
        await queryRunner.query(`ALTER TABLE "telescope" DROP CONSTRAINT "FK_77f38cf66879b28ffa91afdd615"`);
        await queryRunner.query(`ALTER TABLE "mount" DROP CONSTRAINT "FK_d769a237d396e66dfcc3c1b3fe6"`);
        await queryRunner.query(`ALTER TABLE "filter" DROP CONSTRAINT "FK_42ae44b52e9f38b9fc697f05d8e"`);
        await queryRunner.query(`ALTER TABLE "filter_holder" DROP CONSTRAINT "FK_ee650dfb2717316c512ca473b5e"`);
        await queryRunner.query(`ALTER TABLE "corrector" DROP CONSTRAINT "FK_51b7fc80c959dd10c15c04f709c"`);
        await queryRunner.query(`ALTER TABLE "camera" DROP CONSTRAINT "FK_20131b6caca127ec609a777b2e6"`);
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_30e98e8746699fb9af235410aff"`);
        await queryRunner.query(`DROP TABLE "rig_chain_item"`);
        await queryRunner.query(`DROP TABLE "rig"`);
        await queryRunner.query(`DROP TABLE "rig_filter"`);
        await queryRunner.query(`DROP TABLE "equipment_thread"`);
        await queryRunner.query(`DROP TABLE "thread_size"`);
        await queryRunner.query(`DROP TABLE "equipment"`);
        await queryRunner.query(`DROP TABLE "telescope"`);
        await queryRunner.query(`DROP TABLE "mount"`);
        await queryRunner.query(`DROP TABLE "filter"`);
        await queryRunner.query(`DROP TABLE "filter_holder"`);
        await queryRunner.query(`DROP TABLE "corrector"`);
        await queryRunner.query(`DROP TABLE "camera"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP TABLE "app_user"`);
    }

}
