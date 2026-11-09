import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Barrio } from './barrio.entity';
import { Usuario } from './usuario.entity';
import { Estado } from './estado.entity';
import { Gravedad } from './gravedad.entity';
import { JerarquiaCalle } from './jerarquia-calle.entity';
import { TipoDano } from './tipo-dano.entity';
import { decimal } from './transformadores';

@Entity('tickets')
@Check('tickets_prioridad_check', '"prioridad" BETWEEN 0 AND 1')
@Check('tickets_revision_decision_check', `"revision_decision" IN ('confirmada', 'rechazada')`)
export class Ticket {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @Index('tickets_ubicacion_gix', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  ubicacion!: { type: 'Point'; coordinates: [number, number] };

  @ManyToOne(() => TipoDano, { nullable: true })
  @JoinColumn({ name: 'tipo_dano_id' })
  tipoDano!: TipoDano | null;

  @ManyToOne(() => Gravedad, { nullable: true })
  @JoinColumn({ name: 'gravedad_id' })
  gravedad!: Gravedad | null;

  @Index('tickets_estado_idx')
  @ManyToOne(() => Estado, { nullable: false })
  @JoinColumn({ name: 'estado_id' })
  estado!: Estado;

  @ManyToOne(() => JerarquiaCalle, { nullable: true })
  @JoinColumn({ name: 'jerarquia_id' })
  jerarquia!: JerarquiaCalle | null;

  @ManyToOne(() => Barrio, { nullable: true })
  @JoinColumn({ name: 'barrio_id' })
  barrio!: Barrio | null;

  @Column({ type: 'text', name: 'calle_nombre', nullable: true }) calleNombre!: string | null;
  
  @Column({ type: 'text', name: 'barrio_nombre', nullable: true }) barrioNombre!: string | null;

  @Index('tickets_prioridad_idx')
  @Column({ type: 'numeric', precision: 4, scale: 3, default: 0, transformer: decimal })
  prioridad!: number;

  @Column({ type: 'boolean', name: 'necesita_revision', default: false }) necesitaRevision!: boolean;

  @Column({ type: 'text', name: 'revision_decision', nullable: true }) revisionDecision!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'revisado_por_id' })
  revisadoPor!: Usuario | null;

  @Column({ type: 'timestamptz', name: 'revisado_en', nullable: true }) revisadoEn!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' }) creadoEn!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' }) actualizadoEn!: Date;
}
