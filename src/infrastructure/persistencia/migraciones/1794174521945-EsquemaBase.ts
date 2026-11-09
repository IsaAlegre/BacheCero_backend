import { MigrationInterface, QueryRunner } from "typeorm";

export class EsquemaBase1794174521945 implements MigrationInterface {
    name = 'EsquemaBase1794174521945'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "barrios" ("id" SERIAL NOT NULL, "nombre" text NOT NULL, "indice_vulnerabilidad" numeric(3,2) NOT NULL, "fuente" text NOT NULL DEFAULT 'simulado', "geom" geometry(MultiPolygon,4326), CONSTRAINT "UQ_cc46f56a8af3ff666e9abfb785f" UNIQUE ("nombre"), CONSTRAINT "barrios_indice_vulnerabilidad_check" CHECK ("indice_vulnerabilidad" BETWEEN 0 AND 1), CONSTRAINT "PK_16e28df8b7ebada77200bc7c52e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "barrios_geom_gix" ON "barrios" USING GiST ("geom") `);
        await queryRunner.query(`CREATE TABLE "estados" ("id" SMALLSERIAL NOT NULL, "codigo" text NOT NULL, "nombre" text NOT NULL, "orden" smallint NOT NULL, "abierto" boolean NOT NULL, CONSTRAINT "UQ_2b8501cee3ffd7c939b18b83563" UNIQUE ("codigo"), CONSTRAINT "PK_3d9a9f2658d5086012f27924d30" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gravedades" ("id" SMALLSERIAL NOT NULL, "codigo" text NOT NULL, "nombre" text NOT NULL, "peso" numeric(3,2) NOT NULL, CONSTRAINT "UQ_dc22456475a986db1d0f8fe5006" UNIQUE ("codigo"), CONSTRAINT "gravedades_peso_check" CHECK ("peso" BETWEEN 0 AND 1), CONSTRAINT "PK_71e4512711976a55644a580cc06" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "jerarquias_calle" ("id" SMALLSERIAL NOT NULL, "osm_highway" text NOT NULL, "nombre" text NOT NULL, "peso" numeric(3,2) NOT NULL, CONSTRAINT "UQ_faa8d73fd5f90cb9661f42e9a49" UNIQUE ("osm_highway"), CONSTRAINT "jerarquias_calle_peso_check" CHECK ("peso" BETWEEN 0 AND 1), CONSTRAINT "PK_1b890349ac1bfe3b31b9a067c0a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tipos_dano" ("id" SMALLSERIAL NOT NULL, "codigo" text NOT NULL, "nombre_es" text NOT NULL, CONSTRAINT "UQ_b7864c79e6360fd5f8437e67a14" UNIQUE ("codigo"), CONSTRAINT "PK_02d1c66f2610efa79502740bcf2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" BIGSERIAL NOT NULL, "ubicacion" geography(Point,4326) NOT NULL, "calle_nombre" text, "prioridad" numeric(4,3) NOT NULL DEFAULT '0', "necesita_revision" boolean NOT NULL DEFAULT false, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tipo_dano_id" smallint, "gravedad_id" smallint, "estado_id" smallint NOT NULL, "jerarquia_id" smallint, "barrio_id" integer, CONSTRAINT "tickets_prioridad_check" CHECK ("prioridad" BETWEEN 0 AND 1), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "tickets_ubicacion_gix" ON "tickets" USING GiST ("ubicacion") `);
        await queryRunner.query(`CREATE INDEX "tickets_estado_idx" ON "tickets" ("estado_id") `);
        await queryRunner.query(`CREATE INDEX "tickets_prioridad_idx" ON "tickets" ("prioridad") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" SMALLSERIAL NOT NULL, "codigo" text NOT NULL, "nombre" text NOT NULL, CONSTRAINT "UQ_5def9cb8b6a53b45e58ab82e37e" UNIQUE ("codigo"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" BIGSERIAL NOT NULL, "nombre" text NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "rol_id" smallint NOT NULL, CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reportes" ("id" BIGSERIAL NOT NULL, "imagen_url" text NOT NULL, "ubicacion" geography(Point,4326) NOT NULL, "descripcion" text, "respuesta_ia" jsonb, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ticket_id" bigint NOT NULL, "usuario_id" bigint NOT NULL, CONSTRAINT "PK_4204634633cb4099bc06b27a17e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "reportes_ticket_idx" ON "reportes" ("ticket_id") `);
        await queryRunner.query(`CREATE INDEX "reportes_usuario_idx" ON "reportes" ("usuario_id") `);
        await queryRunner.query(`CREATE TABLE "detecciones" ("id" BIGSERIAL NOT NULL, "clase_modelo" text NOT NULL, "confianza" numeric(4,3) NOT NULL, "x1" integer NOT NULL, "y1" integer NOT NULL, "x2" integer NOT NULL, "y2" integer NOT NULL, "area_pct" numeric(5,2) NOT NULL, "reporte_id" bigint NOT NULL, "tipo_dano_id" smallint NOT NULL, CONSTRAINT "detecciones_confianza_check" CHECK ("confianza" BETWEEN 0 AND 1), CONSTRAINT "PK_b8db5ae3135b2269d65f17f412d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "detecciones_reporte_idx" ON "detecciones" ("reporte_id") `);
        await queryRunner.query(`CREATE INDEX "detecciones_tipo_idx" ON "detecciones" ("tipo_dano_id") `);
        await queryRunner.query(`CREATE TABLE "historial_estados" ("id" BIGSERIAL NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ticket_id" bigint NOT NULL, "estado_anterior_id" smallint, "estado_nuevo_id" smallint NOT NULL, "usuario_id" bigint NOT NULL, CONSTRAINT "PK_823e3b2c25e047a01d6eb37fc24" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "historial_ticket_idx" ON "historial_estados" ("ticket_id") `);
        await queryRunner.query(`CREATE TABLE "novedades" ("id" BIGSERIAL NOT NULL, "titulo" text NOT NULL, "contenido" text NOT NULL, "publicado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "autor_id" bigint NOT NULL, CONSTRAINT "PK_3ee04ab14e73b9b6d9f486ca27a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "parametros" ("clave" text NOT NULL, "valor" numeric NOT NULL, "descripcion" text, CONSTRAINT "PK_d52f3fb26992445525eaa8ce435" PRIMARY KEY ("clave"))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_4b0b2bba19aa2eb2371954a205a" FOREIGN KEY ("tipo_dano_id") REFERENCES "tipos_dano"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_da01b688acf32b37bf2cec09d25" FOREIGN KEY ("gravedad_id") REFERENCES "gravedades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_5839d71590e85523d33dc2910e6" FOREIGN KEY ("estado_id") REFERENCES "estados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_0700824694f997373ae446a55f9" FOREIGN KEY ("jerarquia_id") REFERENCES "jerarquias_calle"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_304f3d4dbe867d85e0594c12c76" FOREIGN KEY ("barrio_id") REFERENCES "barrios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_9e519760a660751f4fa21453d3e" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reportes" ADD CONSTRAINT "FK_198d1550b440e608f9b937a04b3" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reportes" ADD CONSTRAINT "FK_5fd0f11ce1c9a42ebc8fb5b15d9" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detecciones" ADD CONSTRAINT "FK_69782dc3673717cee14fadb4ae7" FOREIGN KEY ("reporte_id") REFERENCES "reportes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detecciones" ADD CONSTRAINT "FK_002d151fb9c29d3f05b7e060d18" FOREIGN KEY ("tipo_dano_id") REFERENCES "tipos_dano"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historial_estados" ADD CONSTRAINT "FK_a3c8373401500824496446d9317" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historial_estados" ADD CONSTRAINT "FK_d4976f77e4daafe6a9775f8e236" FOREIGN KEY ("estado_anterior_id") REFERENCES "estados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historial_estados" ADD CONSTRAINT "FK_9c323b4c033eefb30196c8c7a7c" FOREIGN KEY ("estado_nuevo_id") REFERENCES "estados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "historial_estados" ADD CONSTRAINT "FK_536ba92a0e1f0c6e562f01d90ba" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "novedades" ADD CONSTRAINT "FK_da0000ee3b984a7b240857e5c16" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "novedades" DROP CONSTRAINT "FK_da0000ee3b984a7b240857e5c16"`);
        await queryRunner.query(`ALTER TABLE "historial_estados" DROP CONSTRAINT "FK_536ba92a0e1f0c6e562f01d90ba"`);
        await queryRunner.query(`ALTER TABLE "historial_estados" DROP CONSTRAINT "FK_9c323b4c033eefb30196c8c7a7c"`);
        await queryRunner.query(`ALTER TABLE "historial_estados" DROP CONSTRAINT "FK_d4976f77e4daafe6a9775f8e236"`);
        await queryRunner.query(`ALTER TABLE "historial_estados" DROP CONSTRAINT "FK_a3c8373401500824496446d9317"`);
        await queryRunner.query(`ALTER TABLE "detecciones" DROP CONSTRAINT "FK_002d151fb9c29d3f05b7e060d18"`);
        await queryRunner.query(`ALTER TABLE "detecciones" DROP CONSTRAINT "FK_69782dc3673717cee14fadb4ae7"`);
        await queryRunner.query(`ALTER TABLE "reportes" DROP CONSTRAINT "FK_5fd0f11ce1c9a42ebc8fb5b15d9"`);
        await queryRunner.query(`ALTER TABLE "reportes" DROP CONSTRAINT "FK_198d1550b440e608f9b937a04b3"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_9e519760a660751f4fa21453d3e"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_304f3d4dbe867d85e0594c12c76"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_0700824694f997373ae446a55f9"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_5839d71590e85523d33dc2910e6"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_da01b688acf32b37bf2cec09d25"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_4b0b2bba19aa2eb2371954a205a"`);
        await queryRunner.query(`DROP TABLE "parametros"`);
        await queryRunner.query(`DROP TABLE "novedades"`);
        await queryRunner.query(`DROP INDEX "public"."historial_ticket_idx"`);
        await queryRunner.query(`DROP TABLE "historial_estados"`);
        await queryRunner.query(`DROP INDEX "public"."detecciones_tipo_idx"`);
        await queryRunner.query(`DROP INDEX "public"."detecciones_reporte_idx"`);
        await queryRunner.query(`DROP TABLE "detecciones"`);
        await queryRunner.query(`DROP INDEX "public"."reportes_usuario_idx"`);
        await queryRunner.query(`DROP INDEX "public"."reportes_ticket_idx"`);
        await queryRunner.query(`DROP TABLE "reportes"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."tickets_prioridad_idx"`);
        await queryRunner.query(`DROP INDEX "public"."tickets_estado_idx"`);
        await queryRunner.query(`DROP INDEX "public"."tickets_ubicacion_gix"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TABLE "tipos_dano"`);
        await queryRunner.query(`DROP TABLE "jerarquias_calle"`);
        await queryRunner.query(`DROP TABLE "gravedades"`);
        await queryRunner.query(`DROP TABLE "estados"`);
        await queryRunner.query(`DROP INDEX "public"."barrios_geom_gix"`);
        await queryRunner.query(`DROP TABLE "barrios"`);
    }

}
