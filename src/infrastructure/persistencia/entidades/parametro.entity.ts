import { Column, Entity, PrimaryColumn } from 'typeorm';
import { decimal } from './transformadores';

@Entity('parametros')
export class Parametro {
  @PrimaryColumn({ type: 'text' }) clave!: string;
  @Column({ type: 'numeric', transformer: decimal }) valor!: number;
  @Column({ type: 'text', nullable: true }) descripcion!: string | null;
}
