import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Reporte } from './reporte.entity';
import { TipoDano } from './tipo-dano.entity';
import { decimal } from './transformadores';

@Entity('detecciones')
@Check('detecciones_confianza_check', '"confianza" BETWEEN 0 AND 1')
export class Deteccion {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @Index('detecciones_reporte_idx')
  @ManyToOne(() => Reporte, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporte_id' })
  reporte!: Reporte;

  @Index('detecciones_tipo_idx')
  @ManyToOne(() => TipoDano, { nullable: false })
  @JoinColumn({ name: 'tipo_dano_id' })
  tipoDano!: TipoDano;

  @Column({ type: 'text', name: 'clase_modelo' }) claseModelo!: string;
  @Column({ type: 'numeric', precision: 4, scale: 3, transformer: decimal }) confianza!: number;
  @Column({ type: 'integer' }) x1!: number;
  @Column({ type: 'integer' }) y1!: number;
  @Column({ type: 'integer' }) x2!: number;
  @Column({ type: 'integer' }) y2!: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'area_pct', transformer: decimal }) areaPct!: number;
}
