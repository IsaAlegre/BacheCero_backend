import * as jwt from 'jsonwebtoken';
import type { PuertoTokens } from '../../application/usuarios';

const OCHO_HORAS_EN_SEGUNDOS = 8 * 60 * 60;

export class TokensJwt implements PuertoTokens {
  constructor(
    private readonly secreto: string,
    private readonly expiraEnSegundos = OCHO_HORAS_EN_SEGUNDOS,
  ) {}

  firmar(sub: number, rol: string): string {
    return jwt.sign({ rol }, this.secreto, { subject: String(sub), expiresIn: this.expiraEnSegundos });
  }

  verificar(token: string): { sub: number; rol: string } {
    const datos = jwt.verify(token, this.secreto) as jwt.JwtPayload & { rol: string };
    return { sub: Number(datos.sub), rol: datos.rol };
  }
}
