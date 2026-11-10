import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class NovedadDto {
  @IsString() @MinLength(3) @MaxLength(150) titulo!: string;
  @IsString() @MinLength(10) @MaxLength(10000) contenido!: string;
}

// Cambios parciales: se puede mandar solo el título, solo el contenido, o ambos.
export class EditarNovedadDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(150) titulo?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(10000) contenido?: string;
}

export class GenerarNovedadDto {
  @Type(() => Number) @IsInt({ message: 'El año debe ser un número entero' }) @Min(2024) anio!: number;
  @Type(() => Number) @IsInt({ message: 'El mes debe ser un número entero' }) @Min(1) @Max(12) mes!: number;
}
