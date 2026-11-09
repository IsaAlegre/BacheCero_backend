import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './transformadores';

@Entity('jerarquias_calle')
@Check('jerarquias_calle_peso_check', '"peso" BETWEEN 0 AND 1')
export class JerarquiaCalle {
  @PrimaryGeneratedColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'text', unique: true, name: 'osm_highway' }) osmHighway!: string;
  @Column({ type: 'text' }) nombre!: string;
  @Column({ type: 'numeric', precision: 3, scale: 2, transformer: decimal }) peso!: number;
}
