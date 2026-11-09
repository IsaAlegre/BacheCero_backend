// La IA rechazó la imagen (413, 415 o 422): es un problema del pedido, no del servidor.
export class ErrorImagenInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorImagenInvalida';
  }
}

// Coordenadas o datos que no pasan la validación de entrada.
export class ErrorEntradaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorEntradaInvalida';
  }
}

export class ErrorNoEncontrado extends Error {}

// Operación que no se puede hacer en el estado actual (transición inválida, revisión ya resuelta, etc.).
export class ErrorOperacionInvalida extends Error {}
