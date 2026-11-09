import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Estado } from './estado.entity';
import { Ticket } from './ticket.entity';
import { Usuario } from './usuario.entity';

@Entity('historial_estados')
export class HistorialEstado {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;

  @Index('historial_ticket_idx')
  @ManyToOne(() => Ticket, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: Ticket;

  @ManyToOne(() => Estado, { nullable: true })
  @JoinColumn({ name: 'estado_anterior_id' })
  estadoAnterior!: Estado | null;

  @ManyToOne(() => Estado, { nullable: false })
  @JoinColumn({ name: 'estado_nuevo_id' })
  estadoNuevo!: Estado;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' }) creadoEn!: Date;
}
