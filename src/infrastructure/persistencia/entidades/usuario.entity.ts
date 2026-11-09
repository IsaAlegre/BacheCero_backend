import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from './rol.entity';

@Entity('usuarios')
@Check('usuarios_dni_check', `"dni" ~ '^[0-9]{7,8}$'`)
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'text' }) nombre!: string;
  @Column({ type: 'text', unique: true }) dni!: string;
  @Column({ type: 'text', name: 'password_hash' }) passwordHash!: string;
  @ManyToOne(() => Rol, { nullable: false })
  @JoinColumn({ name: 'rol_id' })
  rol!: Rol;
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' }) creadoEn!: Date;
}
