import { Body, Controller, Inject, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';
import { RolDto } from './dto';
import { JwtGuard } from './jwt.guard';
import { Roles, RolesGuard } from './roles.guard';

@Controller('usuarios')
@UseGuards(JwtGuard, RolesGuard)
export class UsuariosController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  @Patch(':id/rol')
  @Roles('administrador')
  asignarRol(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RolDto,
    @Req() req: { user: { sub: number } },
  ) {
    return this.casos.asignarRol.ejecutar(id, dto.rol, Number(req.user.sub));
  }
}
