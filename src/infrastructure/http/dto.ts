import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString() @IsNotEmpty() @MaxLength(120) nombre!: string;
  @IsString() @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' }) dni!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}

export class LoginDto {
  @IsString() @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' }) dni!: string;
  @IsString() @IsNotEmpty() password!: string;
}

// Llega como multipart/form-data: los números vienen como texto.
export class ReporteDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}

export class CambioEstadoDto {
  @IsIn(['pendiente', 'programado', 'en_reparacion', 'resuelto'], { message: 'Estado inválido' })
  estado!: string;
}

export class RevisionDto {
  @IsIn(['confirmada', 'rechazada'], { message: 'La decisión debe ser "confirmada" o "rechazada"' })
  decision!: string;
}

export class RolDto {
  @IsIn(['ciudadano', 'operador', 'administrador'], { message: 'Rol inválido' })
  rol!: string;
}
