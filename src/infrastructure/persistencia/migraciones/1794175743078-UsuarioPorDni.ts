import { MigrationInterface, QueryRunner } from "typeorm";

export class UsuarioPorDni1794175743078 implements MigrationInterface {
    name = 'UsuarioPorDni1794175743078'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" RENAME COLUMN "email" TO "dni"`);
        await queryRunner.query(`ALTER TABLE "usuarios" RENAME CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" TO "UQ_3fd196cb306bed4b2a2e7c34154"`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_dni_check" CHECK ("dni" ~ '^[0-9]{7,8}$')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_dni_check"`);
        await queryRunner.query(`ALTER TABLE "usuarios" RENAME CONSTRAINT "UQ_3fd196cb306bed4b2a2e7c34154" TO "UQ_446adfc18b35418aac32ae0b7b5"`);
        await queryRunner.query(`ALTER TABLE "usuarios" RENAME COLUMN "dni" TO "email"`);
    }

}
