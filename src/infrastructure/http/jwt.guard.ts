import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CASOS, Casos } from '../../composicion';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const cabecera: string | undefined = req.headers.authorization;
    if (!cabecera?.startsWith('Bearer ')) throw new UnauthorizedException('Falta el token');
    try {
      req.user = this.casos.tokens.verificar(cabecera.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
  }
}
