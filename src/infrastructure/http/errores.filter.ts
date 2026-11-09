import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorEntradaInvalida, ErrorImagenInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from '../../application/errores';
import { ErrorCredenciales, ErrorDniYaRegistrado } from '../../application/usuarios';

@Catch()
export class ErroresAplicacionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (error instanceof HttpException) {
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }

    let status = 500;
    let mensaje = 'Error interno';
    if (error instanceof ErrorEntradaInvalida) { status = 400; mensaje = error.message; }
    else if (error instanceof ErrorDniYaRegistrado) { status = 409; mensaje = error.message; }
    else if (error instanceof ErrorCredenciales) { status = 401; mensaje = error.message; }
    else if (error instanceof ErrorImagenInvalida) { status = 422; mensaje = error.message; }
    else if (error instanceof ErrorNoEncontrado) { status = 404; mensaje = error.message; }
    else if (error instanceof ErrorOperacionInvalida) { status = 409; mensaje = error.message; }
    else console.error(error);

    res.status(status).json({ statusCode: status, mensaje });
  }
}
