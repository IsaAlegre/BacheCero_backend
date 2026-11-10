import { MigrationInterface, QueryRunner } from "typeorm";

export class NovedadesBorradorYAprobacion1794269829261 implements MigrationInterface {
    name = 'NovedadesBorradorYAprobacion1794269829261'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "novedades" ADD "estado" text NOT NULL DEFAULT 'borrador'`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD "origen" text NOT NULL DEFAULT 'manual'`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD "aprobado_por_id" bigint`);
        await queryRunner.query(`ALTER TABLE "novedades" ALTER COLUMN "publicado_en" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "novedades" ALTER COLUMN "publicado_en" DROP DEFAULT`);
        // Las novedades que ya existían estaban publicadas: se conservan así, aprobadas por su autor.
        await queryRunner.query(`UPDATE "novedades" SET "estado" = 'publicado', "aprobado_por_id" = "autor_id", "creado_en" = "publicado_en", "actualizado_en" = "publicado_en"`);
        await queryRunner.query(`CREATE INDEX "novedades_estado_idx" ON "novedades" ("estado") `);
        await queryRunner.query(`ALTER TABLE "novedades" ADD CONSTRAINT "novedades_publicacion_check" CHECK ("estado" = 'borrador' OR ("publicado_en" IS NOT NULL AND "aprobado_por_id" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD CONSTRAINT "novedades_origen_check" CHECK ("origen" IN ('manual', 'ia'))`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD CONSTRAINT "novedades_estado_check" CHECK ("estado" IN ('borrador', 'publicado'))`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD CONSTRAINT "FK_38f69aa31f572c08f38cff22190" FOREIGN KEY ("aprobado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "novedades" DROP CONSTRAINT "FK_38f69aa31f572c08f38cff22190"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP CONSTRAINT "novedades_estado_check"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP CONSTRAINT "novedades_origen_check"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP CONSTRAINT "novedades_publicacion_check"`);
        await queryRunner.query(`DROP INDEX "public"."novedades_estado_idx"`);
        // Los borradores no tienen fecha de publicación: se borran para poder volver a NOT NULL (no se publican por accidente).
        await queryRunner.query(`DELETE FROM "novedades" WHERE "estado" = 'borrador'`);
        await queryRunner.query(`ALTER TABLE "novedades" ALTER COLUMN "publicado_en" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "novedades" ALTER COLUMN "publicado_en" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP COLUMN "aprobado_por_id"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP COLUMN "actualizado_en"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP COLUMN "creado_en"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP COLUMN "origen"`);
        await queryRunner.query(`ALTER TABLE "novedades" DROP COLUMN "estado"`);
    }

}
