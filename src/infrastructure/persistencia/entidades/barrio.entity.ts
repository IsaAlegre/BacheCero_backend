import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './transformadores';

@Entity('barrios')
@Check('barrios_indice_vulnerabilidad_check', '"indice_vulnerabilidad" BETWEEN 0 AND 1')
export class Barrio {
  @PrimaryGeneratedColumn({ type: 'integer' }) id!: number;
  @Column({ type: 'text', unique: true }) nombre!: string;
  @Column({ type: 'numeric', precision: 3, scale: 2, name: 'indice_vulnerabilidad', transformer: decimal })
  indiceVulnerabilidad!: number;
  @Column({ type: 'text', default: 'simulado' }) fuente!: string;
  @Index('barrios_geom_gix', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  geom!: unknown;
}
