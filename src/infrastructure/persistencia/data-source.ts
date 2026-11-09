import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTIDADES } from './entidades';

// Fuente de datos única: la usan la app y el CLI de TypeORM (migraciones).
// El esquema lo cambian solo las migraciones: synchronize está apagado a propósito.
export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ENTIDADES,
  migrations: [join(__dirname, 'migraciones', '*.js')],
  synchronize: false,
  migrationsRun: false,
});
