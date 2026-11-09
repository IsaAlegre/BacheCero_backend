import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tipos_dano')
export class TipoDano {
  @PrimaryGeneratedColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'text', unique: true }) codigo!: string;
  @Column({ type: 'text', name: 'nombre_es' }) nombreEs!: string;
}
