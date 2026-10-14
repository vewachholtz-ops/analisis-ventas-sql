// Las tablas publicadas en ../resultados y las consultas de ../sql entran a la página al construirla: la portada
// se ve al instante con los mismos números del repo, y DuckDB solo se carga cuando alguien quiere correr SQL.
import { csvParse } from 'd3-dsv'
import limpiezaCsv from '../../../resultados/00_limpieza.csv?raw'
import mensualCsv from '../../../resultados/01_ventas_mensuales.csv?raw'
import curvaCsv from '../../../resultados/02_abc_curva.csv?raw'
import abcCsv from '../../../resultados/02_abc_productos.csv?raw'
import rfmCsv from '../../../resultados/03_rfm_clientes.csv?raw'
import cohortesCsv from '../../../resultados/04_cohortes.csv?raw'
import devolucionesCsv from '../../../resultados/05_devoluciones.csv?raw'
import paisesCsv from '../../../resultados/06_paises.csv?raw'
import canastaCsv from '../../../resultados/07_canasta.csv?raw'
import sql00 from '../../../sql/00_limpieza.sql?raw'
import sql01 from '../../../sql/01_ventas_mensuales.sql?raw'
import sql02 from '../../../sql/02_abc_productos.sql?raw'
import sql03 from '../../../sql/03_rfm_clientes.sql?raw'
import sql04 from '../../../sql/04_cohortes.sql?raw'
import sql05 from '../../../sql/05_devoluciones.sql?raw'
import sql06 from '../../../sql/06_paises.sql?raw'
import sql07 from '../../../sql/07_canasta.sql?raw'

export type Valor = string | number | boolean | null
export type Fila = Record<string, Valor>

/** Lee un CSV de pandas: números como números, True/False como booleanos y lo vacío como null. */
export function leerCsv(texto: string): Fila[] {
  return csvParse(texto, (fila) => {
    const salida: Fila = {}
    for (const [k, v] of Object.entries(fila)) {
      if (v === undefined || v === '') salida[k] = null
      else if (v === 'True' || v === 'False') salida[k] = v === 'True'
      else if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) salida[k] = Number(v)
      else salida[k] = v
    }
    return salida
  })
}

export interface Consulta {
  id: string
  archivo: string
  sql: string
  /** La tabla publicada con que se compara lo que da la consulta en el navegador. */
  publicada: Fila[]
}

const crear = (id: string, archivo: string, sql: string, csv: string): Consulta => ({ id, archivo, sql, publicada: leerCsv(csv) })

export const CONSULTAS = {
  limpieza: crear('limpieza', '00_limpieza.sql', sql00, limpiezaCsv),
  mensual: crear('mensual', '01_ventas_mensuales.sql', sql01, mensualCsv),
  abc: crear('abc', '02_abc_productos.sql', sql02, abcCsv),
  rfm: crear('rfm', '03_rfm_clientes.sql', sql03, rfmCsv),
  cohortes: crear('cohortes', '04_cohortes.sql', sql04, cohortesCsv),
  devoluciones: crear('devoluciones', '05_devoluciones.sql', sql05, devolucionesCsv),
  paises: crear('paises', '06_paises.sql', sql06, paisesCsv),
  canasta: crear('canasta', '07_canasta.sql', sql07, canastaCsv),
}
export type IdConsulta = keyof typeof CONSULTAS

export const CURVA_ABC = leerCsv(curvaCsv) as { ranking: number; pct_productos: number; acum: number; clase: string }[]

export interface Limpieza {
  lineas_originales: number
  lineas_validas: number
  lineas_de_venta: number
  lineas_canceladas: number
  ventas_totales: number
  monto_cancelado: number
  ventas_netas: number
  clientes: number
  productos: number
  desde: string
  hasta: string
}
export const LIMPIEZA = CONSULTAS.limpieza.publicada[0] as unknown as Limpieza

export interface Mes {
  mes: string
  ventas_brutas: number
  canceladas: number
  ventas_netas: number
  pedidos: number
  clientes: number
  ticket_promedio: number
  variacion_anual_pct: number | null
  mes_parcial: boolean
}
export const MENSUAL = CONSULTAS.mensual.publicada as unknown as Mes[]

export interface ClaseAbc {
  clase: string
  productos: number
  pct_productos: number
  ventas: number
  pct_ventas: number
}
export const ABC = CONSULTAS.abc.publicada as unknown as ClaseAbc[]

export interface Segmento {
  segmento: string
  clientes: number
  pct_clientes: number
  pct_ventas: number
  recencia_mediana_dias: number
  pedidos_promedio: number
  monto_promedio: number
}
export const RFM = CONSULTAS.rfm.publicada as unknown as Segmento[]

export interface Cohorte {
  cohorte: string
  meses_desde: number
  clientes: number
  retencion_pct: number
}
export const COHORTES = CONSULTAS.cohortes.publicada as unknown as Cohorte[]

export interface Devolucion {
  codigo: string | number
  descripcion: string
  monto_cancelado: number
  facturas_cancelacion: number
  ventas: number
  cancelado_sobre_ventas_pct: number
}
export const DEVOLUCIONES = CONSULTAS.devoluciones.publicada as unknown as Devolucion[]

export interface Pais {
  pais: string
  ventas_netas: number
  pct_ventas: number
  clientes: number
  ticket_promedio: number
}
export const PAISES = CONSULTAS.paises.publicada as unknown as Pais[]

export interface Par {
  producto_a: string
  producto_b: string
  pedidos_juntos: number
  soporte_pct: number
  confianza_a_b_pct: number
  lift: number
}
export const CANASTA = CONSULTAS.canasta.publicada as unknown as Par[]
