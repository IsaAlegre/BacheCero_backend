import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketBarrioNombre1794186003051 implements MigrationInterface {
    name = 'TicketBarrioNombre1794186003051'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "barrio_nombre" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "barrio_nombre"`);
    }

}