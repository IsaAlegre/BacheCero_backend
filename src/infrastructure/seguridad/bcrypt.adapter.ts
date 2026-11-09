import * as bcrypt from 'bcrypt';
import type { PuertoHash } from '../../application/usuarios';

const COSTO = 10;

export class BcryptHash implements PuertoHash {
  hashear(texto: string): Promise<string> {
    return bcrypt.hash(texto, COSTO);
  }

  comparar(texto: string, hash: string): Promise<boolean> {
    return bcrypt.compare(texto, hash);
  }
}
