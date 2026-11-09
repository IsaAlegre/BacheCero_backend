import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';
import { LoginDto, RegistroDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  @Post('registro')
  registro(@Body() dto: RegistroDto) {
    return this.casos.registrarCiudadano.ejecutar(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.casos.iniciarSesion.ejecutar(dto.dni, dto.password);
  }
}
