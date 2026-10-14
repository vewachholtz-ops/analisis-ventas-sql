// Del archivo de quien sea a las mismas vistas que usan las ocho consultas (lineas, ventas, cancelaciones, nombres).
// La limpieza de 00_limpieza.sql es propia de Online Retail II (hojas repetidas, facturas «A», códigos de 5 dígitos);
// para un archivo cualquiera se usan reglas generales: fecha, factura, producto y cantidad presentes, precio mayor
// que cero, y las devoluciones según cómo vengan marcadas.
import { CONSULTAS, type IdConsulta } from '../lib/datos'
import type { Decimal, FormatoFecha, Mapeo } from './campos'

export type Devoluciones = { tipo: 'negativas' } | { tipo: 'prefijo'; prefijo: string } | { tipo: 'ninguna' }

export interface Config {
  archivo: string
  mapeo: Mapeo
  fecha: FormatoFecha
  decimal: Decimal
  devoluciones: Devoluciones
  moneda: string
}

/** Un nombre de columna entre comillas dobles, para SQL. */
export const col = (nombre: string) => `"${nombre.replaceAll('"', '""')}"`
const texto = (s: string) => `'${s.replaceAll("'", "''")}'`

const FORMATOS: Record<FormatoFecha, string[]> = {
  // primero los años de dos cifras: %Y también acepta «23» y lo leería como el año 23
  dmy: ['%d-%m-%y %H:%M', '%d-%m-%y', '%d/%m/%y %H:%M', '%d/%m/%y', '%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%d-%m-%Y', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%d.%m.%Y %H:%M', '%d.%m.%Y'],
  mdy: ['%m/%d/%y %H:%M', '%m/%d/%y', '%m-%d-%y', '%m/%d/%Y %H:%M:%S', '%m/%d/%Y %H:%M', '%m/%d/%Y', '%m-%d-%Y %H:%M:%S', '%m-%d-%Y %H:%M', '%m-%d-%Y'],
  ymd: ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y/%m/%d %H:%M', '%Y/%m/%d', '%Y-%m-%dT%H:%M:%S'],
}

/** Convierte el texto de una celda en número o fecha, según el formato del archivo. */
function numero(expr: string, d: Decimal) {
  const limpio = `regexp_replace(trim(${expr}), '[^0-9,.\\-]', '', 'g')`
  return d === 'coma'
    ? `TRY_CAST(replace(replace(${limpio}, '.', ''), ',', '.') AS DOUBLE)`
    : `TRY_CAST(replace(${limpio}, ',', '') AS DOUBLE)`
}
function fecha(expr: string, f: FormatoFecha) {
  const lista = `[${FORMATOS[f].map(texto).join(', ')}]`
  return `coalesce(try_strptime(trim(${expr}), ${lista}), TRY_CAST(trim(${expr}) AS TIMESTAMP))`
}

/** La tabla de líneas con tipos y nombres de columna en español, desde el archivo leído como texto. */
export function sqlBase(c: Config): string {
  const m = c.mapeo
  const t = (campo: keyof Mapeo) => (m[campo] ? `nullif(trim(${col(m[campo]!)}), '')` : 'NULL')
  const cantidad = m.cantidad ? numero(col(m.cantidad), c.decimal) : 'NULL'
  const precio = m.precio ? numero(col(m.precio), c.decimal) : m.monto ? `abs(${numero(col(m.monto), c.decimal)} / nullif(${cantidad}, 0))` : 'NULL'
  return `CREATE OR REPLACE TABLE mis_lineas AS
SELECT
    ${t('factura')} AS factura,
    coalesce(${t('codigo')}, ${t('descripcion')}) AS codigo,
    coalesce(${t('descripcion')}, ${t('codigo')}) AS descripcion,
    ${cantidad} AS cantidad,
    ${m.fecha ? fecha(col(m.fecha), c.fecha) : 'NULL'} AS fecha,
    ${precio} AS precio,
    ${t('cliente')} AS cliente,
    coalesce(${t('pais')}, 'Sin dato') AS pais
FROM mis_ventas_crudo`
}

/** Las vistas que usan las consultas, y el período «último año completo» que reemplaza las fechas fijas. */
export function sqlVistas(c: Config): string[] {
  const d = c.devoluciones
  const regla = d.tipo === 'negativas' ? 'cantidad < 0' : d.tipo === 'prefijo' ? `starts_with(upper(factura), ${texto(d.prefijo.toUpperCase())})` : 'false'
  return [
    "CREATE OR REPLACE VIEW crudo AS SELECT * FROM mis_ventas_crudo",
    `CREATE OR REPLACE VIEW lineas AS
SELECT factura, codigo, descripcion, cantidad, fecha, precio, cliente, pais,
    CASE WHEN es_cancelacion THEN -abs(cantidad * precio) ELSE cantidad * precio END AS monto,
    es_cancelacion
FROM (SELECT *, ${regla} AS es_cancelacion FROM mis_lineas)
WHERE fecha IS NOT NULL AND factura IS NOT NULL AND codigo IS NOT NULL
  AND cantidad IS NOT NULL AND cantidad <> 0 AND precio > 0`,
    `CREATE OR REPLACE VIEW nombres AS
SELECT codigo, descripcion
FROM (SELECT codigo, trim(descripcion) AS descripcion, count(*) AS n FROM lineas WHERE descripcion IS NOT NULL GROUP BY ALL)
QUALIFY row_number() OVER (PARTITION BY codigo ORDER BY n DESC, descripcion) = 1`,
    'CREATE OR REPLACE VIEW ventas AS SELECT * FROM lineas WHERE NOT es_cancelacion AND cantidad > 0',
    'CREATE OR REPLACE VIEW cancelaciones AS SELECT * FROM lineas WHERE es_cancelacion',
    // el último año completo: los 12 meses que terminan donde empieza el último mes sin terminar (o menos, si el
    // archivo cubre menos de un año)
    `CREATE OR REPLACE VIEW periodo AS
WITH l AS (SELECT min(fecha)::DATE AS primero, max(fecha)::DATE AS ultimo FROM lineas),
f AS (
    SELECT primero, ultimo,
        CASE WHEN ultimo = last_day(ultimo) THEN (date_trunc('month', ultimo) + INTERVAL 1 MONTH)::DATE
             ELSE date_trunc('month', ultimo)::DATE END AS hasta
    FROM l
)
SELECT
    CASE WHEN hasta <= primero THEN primero ELSE greatest(primero, (hasta - INTERVAL 12 MONTH)::DATE) END AS desde,
    CASE WHEN hasta <= primero THEN ultimo + 1 ELSE hasta END AS hasta
FROM f`,
  ]
}

/** Las consultas de sql/ para un archivo cualquiera: el último año completo en vez de dic-2010 a nov-2011, y para la
 * canasta un mínimo de pedidos proporcional al tamaño del archivo en vez de 100. */
const CAMBIOS: [string, string][] = [
  ["DATE '2010-12-01'", '(SELECT desde FROM periodo)'],
  ["DATE '2011-12-01'", '(SELECT hasta FROM periodo)'],
  ["m.mes = (SELECT date_trunc('month', max(fecha))::DATE FROM lineas) AS mes_parcial", 'm.mes >= (SELECT hasta FROM periodo) AS mes_parcial'],
  ['WHERE p.juntos >= 100', 'WHERE p.juntos >= greatest(3, round(0.005 * t.n))'],
]

export function adaptar(sql: string): string {
  let salida = sql
  for (const [de, a] of CAMBIOS) salida = salida.replaceAll(de, a)
  return salida
}

/** Las consultas adaptadas, en el orden del informe (la de limpieza: solo el resumen final). */
export function consultasMias(): Record<IdConsulta, string> {
  const salida = {} as Record<IdConsulta, string>
  for (const id of Object.keys(CONSULTAS) as IdConsulta[]) {
    const sql = CONSULTAS[id].sql
    salida[id] = id === 'limpieza' ? sql.slice(sql.indexOf('-- Resumen de lo que quedó')) : adaptar(sql)
  }
  return salida
}

/** Cada cambio tiene que encontrar su texto: si alguien cambia una consulta de sql/, esto avisa. */
export function cambiosQueNoCalzan(): string[] {
  const todo = Object.values(CONSULTAS)
    .map((c) => c.sql)
    .join('\n')
  return CAMBIOS.filter(([de]) => !todo.includes(de)).map(([de]) => de)
}
