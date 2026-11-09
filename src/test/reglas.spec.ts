import {
  calcularPrioridad,
  danoPrincipal,
  Deteccion,
  gravedadDeDeteccion,
  PARAMETROS_POR_DEFECTO,
  puedeTransicionar,
  requiereRevision,
} from '../domain/reglas';

const bache = (areaPct: number, confianza = 0.8): Deteccion => ({
  tipo: 'pothole',
  claseModelo: 'pothole',
  confianza,
  areaPct,
  bbox: [0, 0, 10, 10],
});

const grieta = (claseModelo: string, confianza = 0.6): Deteccion => ({
  tipo: 'crack',
  claseModelo,
  confianza,
  areaPct: 3,
  bbox: [0, 0, 10, 10],
});

describe('gravedad', () => {
  it('clasifica baches por área ocupada', () => {
    expect(gravedadDeDeteccion(bache(1))).toBe('leve');
    expect(gravedadDeDeteccion(bache(2))).toBe('moderada');
    expect(gravedadDeDeteccion(bache(5))).toBe('grave');
  });

  it('piel de cocodrilo es moderada, la grieta lineal es leve', () => {
    expect(gravedadDeDeteccion(grieta('alligator_crack'))).toBe('moderada');
    expect(gravedadDeDeteccion(grieta('longitudinal_crack'))).toBe('leve');
  });

  it('el daño principal es el de mayor gravedad, y en empate el de mayor confianza', () => {
    const principal = danoPrincipal([bache(1, 0.99), bache(6, 0.4), grieta('alligator_crack')]);
    expect(principal?.gravedad).toBe('grave');
    expect(principal?.deteccion.areaPct).toBe(6);

    const empate = danoPrincipal([bache(1, 0.5), bache(1, 0.9)]);
    expect(empate?.deteccion.confianza).toBe(0.9);
  });

  it('sin detecciones no hay daño principal', () => {
    expect(danoPrincipal([])).toBeNull();
  });
});

describe('revisión humana', () => {
  it('se requiere si no hay daño o si la confianza está bajo el umbral', () => {
    expect(requiereRevision(false, 0, 0.5)).toBe(true);
    expect(requiereRevision(true, 0.49, 0.5)).toBe(true);
    expect(requiereRevision(true, 0.5, 0.5)).toBe(false);
  });
});

describe('prioridad', () => {
  it('con todos los factores al máximo da 1', () => {
    const p = calcularPrioridad({
      gravedad: 'grave',
      pesoJerarquia: 1,
      cantidadReportes: 5,
      vulnerabilidad: 1,
    });
    expect(p).toBe(1);
  });

  it('pondera cada factor con los pesos por defecto', () => {
    // 0.4*1 + 0.25*1 + 0.15*(1/5) + 0.2*0.8 = 0.84
    const p = calcularPrioridad({
      gravedad: 'grave',
      pesoJerarquia: 1,
      cantidadReportes: 1,
      vulnerabilidad: 0.8,
    });
    expect(p).toBeCloseTo(0.84, 3);
  });

  it('más reportes suben la prioridad hasta el máximo de reportes', () => {
    const base = { gravedad: 'moderada' as const, pesoJerarquia: 0.5, vulnerabilidad: 0.5 };
    const uno = calcularPrioridad({ ...base, cantidadReportes: 1 });
    const cinco = calcularPrioridad({ ...base, cantidadReportes: 5 });
    const diez = calcularPrioridad({ ...base, cantidadReportes: 10 });
    expect(cinco).toBeGreaterThan(uno);
    expect(diez).toBe(cinco);
  });

  it('rechaza pesos que no suman 1', () => {
    expect(() =>
      calcularPrioridad(
        { gravedad: 'leve', pesoJerarquia: 0.3, cantidadReportes: 1, vulnerabilidad: 0.5 },
        { ...PARAMETROS_POR_DEFECTO, pesos: { gravedad: 0.5, jerarquia: 0.5, reportes: 0.5, vulnerabilidad: 0.5 } },
      ),
    ).toThrow('deben sumar 1');
  });
});

describe('transiciones de estado', () => {
  it('avanza en el orden del ciclo de reparación', () => {
    expect(puedeTransicionar('pendiente', 'programado')).toBe(true);
    expect(puedeTransicionar('programado', 'en_reparacion')).toBe(true);
    expect(puedeTransicionar('en_reparacion', 'resuelto')).toBe(true);
  });

  it('no retrocede y "resuelto" es terminal', () => {
    expect(puedeTransicionar('en_reparacion', 'pendiente')).toBe(false);
    expect(puedeTransicionar('resuelto', 'pendiente')).toBe(false);
  });
});
