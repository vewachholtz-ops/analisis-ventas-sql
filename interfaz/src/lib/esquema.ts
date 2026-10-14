// Las vistas que hay en la consola, con sus columnas. Las crean sql/00_limpieza.sql (crudo, lineas, ventas,
// cancelaciones, nombres), 02_abc_productos.sql (abc) y 03_rfm_clientes.sql (rfm).
export interface Vista {
  nombre: string
  descripcion: string
  columnas: [nombre: string, tipo: string][]
}

const LINEA: [string, string][] = [
  ['factura', 'VARCHAR'],
  ['codigo', 'VARCHAR'],
  ['descripcion', 'VARCHAR'],
  ['cantidad', 'BIGINT'],
  ['fecha', 'TIMESTAMP'],
  ['precio', 'DOUBLE'],
  ['cliente', 'BIGINT'],
  ['pais', 'VARCHAR'],
]

export const VISTAS: Vista[] = [
  {
    nombre: 'lineas',
    descripcion: 'Las líneas de producto válidas. Las cancelaciones tienen monto negativo: sum(monto) da la venta neta.',
    columnas: [...LINEA, ['monto', 'DOUBLE'], ['es_cancelacion', 'BOOLEAN']],
  },
  { nombre: 'ventas', descripcion: 'Las líneas que son ventas.', columnas: [...LINEA, ['monto', 'DOUBLE'], ['es_cancelacion', 'BOOLEAN']] },
  { nombre: 'cancelaciones', descripcion: 'Las líneas de facturas «C».', columnas: [...LINEA, ['monto', 'DOUBLE'], ['es_cancelacion', 'BOOLEAN']] },
  { nombre: 'nombres', descripcion: 'Un nombre por producto: la descripción más frecuente de cada código.', columnas: [['codigo', 'VARCHAR'], ['descripcion', 'VARCHAR']] },
  {
    nombre: 'abc',
    descripcion: 'Cada producto del último año completo con su clase A, B o C.',
    columnas: [
      ['ranking', 'BIGINT'],
      ['codigo', 'VARCHAR'],
      ['descripcion', 'VARCHAR'],
      ['ventas', 'DOUBLE'],
      ['unidades', 'HUGEINT'],
      ['acum', 'DOUBLE'],
      ['clase', 'VARCHAR'],
    ],
  },
  {
    nombre: 'rfm',
    descripcion: 'Cada cliente identificado con sus puntajes de 1 a 5 y su segmento.',
    columnas: [
      ['cliente', 'BIGINT'],
      ['recencia_dias', 'BIGINT'],
      ['frecuencia', 'BIGINT'],
      ['monto', 'DOUBLE'],
      ['r', 'INTEGER'],
      ['f', 'INTEGER'],
      ['m', 'INTEGER'],
      ['segmento', 'VARCHAR'],
    ],
  },
  { nombre: 'crudo', descripcion: 'Las dos hojas del Excel tal cual, sin limpiar.', columnas: [...LINEA, ['hoja', 'VARCHAR']] },
]

/** Para el autocompletado del editor: vista → columnas. */
export const ESQUEMA: Record<string, string[]> = Object.fromEntries(VISTAS.map((v) => [v.nombre, v.columnas.map(([c]) => c)]))
