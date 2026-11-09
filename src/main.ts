import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { dataSource } from './infrastructure/persistencia/data-source';
import { ErroresAplicacionFilter } from './infrastructure/http/errores.filter';

async function main(): Promise<void> {
  await dataSource.initialize();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ErroresAplicacionFilter());
  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  console.log(`Bache Cero escuchando en el puerto ${puerto}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
