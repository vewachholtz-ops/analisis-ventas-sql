// Corre las ocho consultas sobre el archivo propio y devuelve sus tablas, más la curva ABC para el gráfico.
import type { Fila } from '../lib/datos'
import { correr, filasDe, prepararMios } from '../lib/duckdb'
import type { Config } from './sql'
import { consultasMias } from './sql'

export interface Analisis {
  limpieza: Fila
  mensual: Fila[]
  abc: Fila[]
  curva: Fila[]
  rfm: Fila[]
  cohortes: Fila[]
  devoluciones: Fila[]
  paises: Fila[]
  canasta: Fila[]
  periodo: { desde: string; hasta: string }
  /** Líneas que quedaron fuera, por motivo. */
  fuera: { motivo: string; lineas: number }[]
  ms: number
  sql: ReturnType<typeof consultasMias>
}

export async function analizar(config: Config, avisar?: (paso: string) => void): Promise<Analisis> {
  avisar?.('Preparando tus líneas')
  await prepararMios(config)
  const sql = consultasMias()
  const t0 = performance.now()
  const tabla = async (id: keyof typeof sql, paso: string) => {
    avisar?.(paso)
    return (await correr(sql[id], 100_000)).filas
  }
  const limpieza = (await tabla('limpieza', 'Contando lo que quedó'))[0]
  const mensual = await tabla('mensual', 'Ventas por mes')
  const abc = await tabla('abc', 'Clasificación ABC')
  const { tabla: curvaArrow } = await correr('SELECT ranking, ranking / count(*) OVER () AS pct_productos, acum, clase FROM abc ORDER BY ranking', 0)
  const curvaToda = filasDe(curvaArrow)
  const paso = Math.max(1, Math.floor(curvaToda.length / 300))
  const curva = curvaToda.filter((_, i) => i % paso === 0 || i === curvaToda.length - 1)
  const tieneClientes = Number(limpieza.clientes) > 0
  const rfm = tieneClientes ? await tabla('rfm', 'Segmentos de clientes') : []
  const cohortes = tieneClientes ? await tabla('cohortes', 'Retención') : []
  const devoluciones = await tabla('devoluciones', 'Devoluciones')
  const paises = await tabla('paises', 'Dónde se vende')
  const canasta = await tabla('canasta', 'Qué se compra junto')
  const periodo = (await correr('SELECT desde::VARCHAR AS desde, hasta::VARCHAR AS hasta FROM periodo')).filas[0] as { desde: string; hasta: string }
  avisar?.('Revisando lo que quedó fuera')
  const fuera = (
    await correr(`SELECT motivo, count(*) AS lineas FROM (
      SELECT CASE
        WHEN fecha IS NULL THEN 'sin fecha o con una fecha que no se entiende'
        WHEN factura IS NULL THEN 'sin factura'
        WHEN codigo IS NULL THEN 'sin producto'
        WHEN cantidad IS NULL OR cantidad = 0 THEN 'sin cantidad'
        WHEN precio IS NULL OR precio <= 0 THEN 'sin precio o con precio cero'
      END AS motivo FROM mis_lineas) WHERE motivo IS NOT NULL GROUP BY motivo ORDER BY lineas DESC`)
  ).filas as { motivo: string; lineas: number }[]
  return { limpieza, mensual, abc, curva, rfm, cohortes, devoluciones, paises, canasta, periodo, fuera, ms: performance.now() - t0, sql }
}
