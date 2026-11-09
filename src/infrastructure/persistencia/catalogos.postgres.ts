import type { DataSource } from 'typeorm';
import type { PuertoBarrios, PuertoCatalogos } from '../../application/puertos';

export class CatalogosPostgres implements PuertoCatalogos, PuertoBarrios {
  constructor(private readonly db: DataSource) {}

  async pesoJerarquia(osmHighway: string | null): Promise<number | null> {
    if (!osmHighway) return null;
    const filas: Array<{ peso: string }> = await this.db.query(
      'SELECT peso FROM jerarquias_calle WHERE osm_highway = $1',
      [osmHighway],
    );
    return filas[0] ? Number(filas[0].peso) : null;
  }

  async indiceVulnerabilidad(nombre: string | null): Promise<number | null> {
    if (!nombre) return null;
    const filas: Array<{ indice: string }> = await this.db.query(
      'SELECT indice_vulnerabilidad AS indice FROM barrios WHERE nombre = $1',
      [nombre],
    );
    return filas[0] ? Number(filas[0].indice) : null;
  }
}
