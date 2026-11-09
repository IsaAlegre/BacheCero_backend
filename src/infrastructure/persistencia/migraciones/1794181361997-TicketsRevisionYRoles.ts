import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketsRevisionYRoles1794181361997 implements MigrationInterface {
    name = 'TicketsRevisionYRoles1794181361997'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "revision_decision" text`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "revisado_en" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "revisado_por_id" bigint`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "tickets_revision_decision_check" CHECK ("revision_decision" IN ('confirmada', 'rechazada'))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_cf38563330de681ed560f2baeba" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_cf38563330de681ed560f2baeba"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "tickets_revision_decision_check"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "revisado_por_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "revisado_en"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "revision_decision"`);
    }

}
