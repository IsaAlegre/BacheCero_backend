import { Module } from '@nestjs/common';
import { CASOS, construirCasos } from './composicion';
import { AuthController } from './infrastructure/http/auth.controller';
import { ReportesController } from './infrastructure/http/reportes.controller';
import { TicketsController } from './infrastructure/http/tickets.controller';
import { UsuariosController } from './infrastructure/http/usuarios.controller';

@Module({
  controllers: [AuthController, ReportesController, TicketsController, UsuariosController],
  providers: [{ provide: CASOS, useFactory: () => construirCasos() }],
})
export class AppModule {}
