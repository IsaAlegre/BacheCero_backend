import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('novedades')
export class Novedad {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'text' }) titulo!: string;
  @Column({ type: 'text' }) contenido!: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'autor_id' })
  autor!: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'publicado_en' }) publicadoEn!: Date;
}
