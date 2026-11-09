import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Ticket } from './ticket.entity';
import { Usuario } from './usuario.entity';

@Entity('reportes')
export class Reporte {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @Index('reportes_ticket_idx')
  @ManyToOne(() => Ticket, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: Ticket;

  @Index('reportes_usuario_idx')
  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ type: 'text', name: 'imagen_url' }) imagenUrl!: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  ubicacion!: { type: 'Point'; coordinates: [number, number] };

  @Column({ type: 'text', nullable: true }) descripcion!: string | null;

  @Column({ type: 'jsonb', name: 'respuesta_ia', nullable: true }) respuestaIa!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' }) creadoEn!: Date;
}
