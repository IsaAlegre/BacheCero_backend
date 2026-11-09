import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';
import { JwtGuard } from './jwt.guard';
import { Roles, RolesGuard } from './roles.guard';

const PERSONAL = ['operador', 'administrador'];

@Controller('estadisticas')
@UseGuards(JwtGuard, RolesGuard)
export class EstadisticasController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  // Los parámetros se pasan sin tocar: el caso de uso los valida y responde 400 si son inválidos.
  @Get()
  @Roles(...PERSONAL)
  obtener(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limiteZonas') limiteZonas?: string,
  ) {
    return this.casos.estadisticas.ejecutar({ desde, hasta, limiteZonas });
  }
}
