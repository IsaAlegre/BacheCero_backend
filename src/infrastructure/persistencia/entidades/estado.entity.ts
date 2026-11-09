import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('estados')
export class Estado {
  @PrimaryGeneratedColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'text', unique: true }) codigo!: string;
  @Column({ type: 'text' }) nombre!: string;
  @Column({ type: 'smallint' }) orden!: number;
  @Column({ type: 'boolean' }) abierto!: boolean;
}
