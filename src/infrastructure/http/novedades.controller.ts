import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';
import { JwtGuard } from './jwt.guard';
import { EditarNovedadDto, GenerarNovedadDto, NovedadDto } from './novedades.dto';
import { Roles, RolesGuard } from './roles.guard';

const ADMIN = 'administrador';

type PeticionConUsuario = { user: { sub: number; rol: string } };

// Cualquier usuario logueado lee las novedades publicadas. Gestionarlas es solo del administrador.
// Las rutas fijas (gestion, generar) van antes que las de :id.
@Controller('novedades')
@UseGuards(JwtGuard, RolesGuard)
export class NovedadesController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  @Get()
  listar(@Query('pagina') pagina?: string) {
    return this.casos.novedades.listar.ejecutar(Number(pagina ?? 1));
  }

  @Get('gestion')
  @Roles(ADMIN)
  listarGestion(@Query('pagina') pagina?: string, @Query('estado') estado?: string) {
    return this.casos.novedades.listarGestion.ejecutar(Number(pagina ?? 1), estado);
  }

  @Post('generar')
  @HttpCode(201)
  @Roles(ADMIN)
  generar(@Body() dto: GenerarNovedadDto, @Req() req: PeticionConUsuario) {
    return this.casos.novedades.generarBorrador.ejecutar(dto.anio, dto.mes, Number(req.user.sub));
  }

  @Get(':id')
  ver(@Param('id', ParseIntPipe) id: number, @Req() req: PeticionConUsuario) {
    return this.casos.novedades.ver.ejecutar(id, req.user.rol === ADMIN);
  }

  @Post()
  @Roles(ADMIN)
  crear(@Body() dto: NovedadDto, @Req() req: PeticionConUsuario) {
    return this.casos.novedades.crear.ejecutar(dto.titulo, dto.contenido, Number(req.user.sub));
  }

  @Patch(':id')
  @Roles(ADMIN)
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarNovedadDto) {
    return this.casos.novedades.editar.ejecutar(id, dto);
  }

  @Post(':id/publicar')
  @HttpCode(200)
  @Roles(ADMIN)
  publicar(@Param('id', ParseIntPipe) id: number, @Req() req: PeticionConUsuario) {
    return this.casos.novedades.publicar.ejecutar(id, Number(req.user.sub));
  }

  @Delete(':id')
  @Roles(ADMIN)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.casos.novedades.eliminar.ejecutar(id);
  }
}
