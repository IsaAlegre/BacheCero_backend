import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './transformadores';

@Entity('gravedades')
@Check('gravedades_peso_check', '"peso" BETWEEN 0 AND 1')
export class Gravedad {
  @PrimaryGeneratedColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'text', unique: true }) codigo!: string;
  @Column({ type: 'text' }) nombre!: string;
  @Column({ type: 'numeric', precision: 3, scale: 2, transformer: decimal }) peso!: number;
}
