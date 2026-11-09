import type { PuertoIa, ResultadoIa } from '../../application/puertos';

// Para desarrollo y tests: devuelve siempre el mismo análisis, sin levantar los modelos.
export class IaFalsaAdapter implements PuertoIa {
  constructor(private readonly resultado: ResultadoIa) {}

  async analizar(): Promise<ResultadoIa> {
    return this.resultado;
  }
}
