import { MigrationInterface, QueryRunner } from 'typeorm';

// Debe ser la primera: las columnas geography y geometry necesitan PostGIS.
export class ExtensionPostgis1700000000000 implements MigrationInterface {
  name = 'ExtensionPostgis1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS postgis');
  }
}
