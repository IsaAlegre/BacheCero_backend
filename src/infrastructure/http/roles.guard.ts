import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const CLAVE_ROLES = 'roles';

// Uso: @Roles('administrador') sobre una ruta. Debe ir después de JwtGuard, que es quien pone req.user.
export const Roles = (...roles: string[]) => SetMetadata(CLAVE_ROLES, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<string[] | undefined>(CLAVE_ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!permitidos?.length) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: { rol?: string } }>();
    if (!req.user?.rol || !permitidos.includes(req.user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción');
    }
    return true;
  }
}
