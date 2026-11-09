import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';
import { CambioEstadoDto, RevisionDto } from './dto';
import { JwtGuard } from './jwt.guard';
import { Roles, RolesGuard } from './roles.guard';

const PERSONAL = ['operador', 'administrador'];

@Controller('tickets')
@UseGuards(JwtGuard, RolesGuard)
export class TicketsController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  @Get()
  @Roles(...PERSONAL)
  listar(
    @Query('pagina') pagina?: string,
    @Query('estado') estado?: string,
    @Query('orden') orden?: string,
    @Query('barrio') barrio?: string,
  ) {
    return this.casos.listarTickets.ejecutar(Number(pagina ?? 1), { estado, orden, barrio });
  }

  @Get(':id')
  @Roles(...PERSONAL)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.casos.verTicket.ejecutar(id);
  }

  @Patch(':id/estado')
  @Roles(...PERSONAL)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambioEstadoDto,
    @Req() req: { user: { sub: number } },
  ) {
    return this.casos.cambiarEstadoTicket.ejecutar(id, dto.estado, Number(req.user.sub));
  }

  @Post(':id/revision')
  @HttpCode(200)
  @Roles(...PERSONAL)
  resolverRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisionDto,
    @Req() req: { user: { sub: number } },
  ) {
    return this.casos.resolverRevision.ejecutar(id, dto.decision, Number(req.user.sub));
  }
}