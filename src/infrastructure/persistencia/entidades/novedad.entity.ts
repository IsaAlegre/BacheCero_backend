import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

// Una novedad nace como borrador (escrita a mano o generada por IA) y la publica un administrador.
// Publicada exige fecha de publicación y quién la aprobó.
@Entity('novedades')
@Check('novedades_estado_check', `"estado" IN ('borrador', 'publicado')`)
@Check('novedades_origen_check', `"origen" IN ('manual', 'ia')`)
@Check('novedades_publicacion_check', `"estado" = 'borrador' OR ("publicado_en" IS NOT NULL AND "aprobado_por_id" IS NOT NULL)`)
export class Novedad {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'text' }) titulo!: string;
  @Column({ type: 'text' }) contenido!: string;

  @Index('novedades_estado_idx')
  @Column({ type: 'text', default: 'borrador' }) estado!: string;
  @Column({ type: 'text', default: 'manual' }) origen!: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'autor_id' })
  autor!: Usuario;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'aprobado_por_id' })
  aprobadoPor!: Usuario | null;

  @Column({ type: 'timestamptz', name: 'publicado_en', nullable: true }) publicadoEn!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' }) creadoEn!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' }) actualizadoEn!: Date;
}
