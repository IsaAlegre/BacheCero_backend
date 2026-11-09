import { Barrio } from './barrio.entity';
import { Deteccion } from './deteccion.entity';
import { Estado } from './estado.entity';
import { Gravedad } from './gravedad.entity';
import { HistorialEstado } from './historial-estado.entity';
import { JerarquiaCalle } from './jerarquia-calle.entity';
import { Novedad } from './novedad.entity';
import { Parametro } from './parametro.entity';
import { Reporte } from './reporte.entity';
import { Rol } from './rol.entity';
import { Ticket } from './ticket.entity';
import { TipoDano } from './tipo-dano.entity';
import { Usuario } from './usuario.entity';

export * from './barrio.entity';
export * from './deteccion.entity';
export * from './estado.entity';
export * from './gravedad.entity';
export * from './historial-estado.entity';
export * from './jerarquia-calle.entity';
export * from './novedad.entity';
export * from './parametro.entity';
export * from './reporte.entity';
export * from './rol.entity';
export * from './ticket.entity';
export * from './tipo-dano.entity';
export * from './usuario.entity';

export const ENTIDADES = [
  Barrio, Deteccion, Estado, Gravedad, HistorialEstado, JerarquiaCalle,
  Novedad, Parametro, Reporte, Rol, Ticket, TipoDano, Usuario,
];
