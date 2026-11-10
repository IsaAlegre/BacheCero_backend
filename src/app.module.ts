import { Module } from '@nestjs/common';
import { CASOS, construirCasos } from './composicion';
import { AuthController } from './infrastructure/http/auth.controller';
import { ReportesController } from './infrastructure/http/reportes.controller';
import { TicketsController } from './infrastructure/http/tickets.controller';
import { UsuariosController } from './infrastructure/http/usuarios.controller';
import { EstadisticasController } from './infrastructure/http/estadisticas.controller';
import { NovedadesController } from './infrastructure/http/novedades.controller';

@Module({
  controllers: [AuthController, EstadisticasController,NovedadesController, ReportesController, TicketsController, UsuariosController],
  providers: [{ provide: CASOS, useFactory: () => construirCasos() }],
})
export class AppModule {}
