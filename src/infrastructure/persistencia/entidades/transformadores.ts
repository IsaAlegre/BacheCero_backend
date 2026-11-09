// Postgres devuelve numeric como string; lo convertimos a number al leer.
export const decimal = {
  to: (valor: number | null | undefined) => valor,
  from: (valor: string | null) => (valor === null ? null : Number(valor)),
};
