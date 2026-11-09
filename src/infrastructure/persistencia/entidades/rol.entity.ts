import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ type: 'smallint' }) id!: number;
  @Column({ type: 'text', unique: true }) codigo!: string;
  @Column({ type: 'text' }) nombre!: string;
}
