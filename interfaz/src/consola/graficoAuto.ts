// Un gráfico automático para lo que devuelve la consola, cuando tiene forma de gráfico: la primera columna es la
// etiqueta (fechas, textos o números) y la primera columna numérica que le sigue es el valor. Un solo tono.
import * as Plot from '@observablehq/plot'
import type { Fila } from '../lib/datos'
import { celda, mes } from '../lib/formato'
import { color } from '../lib/tema'

export interface Forma {
  x: string
  y: string
  tipo: 'tiempo' | 'categorias' | 'numeros'
}

const FECHA = /^\d{4}-\d{2}-\d{2}/

export function forma(columnas: string[], filas: Fila[]): Forma | null {
  if (filas.length < 2 || filas.length > 120 || columnas.length < 2) return null
  const x = columnas[0]
  const y = columnas.slice(1).find((c) => filas.every((f) => f[c] === null || typeof f[c] === 'number'))
  if (!y) return null
  const xs = filas.map((f) => f[x])
  if (xs.every((v) => typeof v === 'string' && FECHA.test(v))) return { x, y, tipo: 'tiempo' }
  if (filas.length > 40) return null
  if (xs.every((v) => typeof v === 'number')) return { x, y, tipo: 'numeros' }
  return { x, y, tipo: 'categorias' }
}

const corto = (t: string, n = 30) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

export function dibujar(f: Forma, filas: Fila[], ancho: number) {
  const c = { dato: color('dato'), grilla: color('grilla'), eje: color('eje'), superficie: color('superficie'), tinta: color('tinta') }
  const titulo = (d: Fila) => `${celda(d[f.x])}\n${f.y}: ${celda(d[f.y])}`
  const comun = { width: ancho, style: { fontSize: '12px', fontFamily: 'inherit' } }
  const ejeY = { label: null, grid: false, tickFormat: (v: number) => celda(v) }

  if (f.tipo === 'tiempo') {
    const datos = filas.map((fila) => ({ fila, x: new Date(String(fila[f.x]).slice(0, 10)), y: fila[f.y] as number | null }))
    const mensual = filas.every((d) => String(d[f.x]).slice(8, 10) === '01')
    return Plot.plot({
      ...comun,
      height: 300,
      marginLeft: 64,
      x: {
        type: 'utc',
        label: null,
        ticks: ancho < 600 ? 4 : 8,
        // los meses en español: «ene 2010» para enero, el resto solo el mes
        tickFormat: (d: Date) => (d.getUTCMonth() === 0 ? mes(d.toISOString()) : mes(d.toISOString()).split(' ')[0]),
      },
      y: { ...ejeY, ticks: 5 },
      marks: [
        Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 5 }),
        Plot.ruleY([0], { stroke: c.eje }),
        Plot.lineY(datos, { x: 'x', y: 'y', stroke: c.dato, strokeWidth: 2 }),
        Plot.dot(datos, Plot.pointerX({ x: 'x', y: 'y', r: 4.5, fill: c.dato, stroke: c.superficie, strokeWidth: 2 })),
        Plot.tip(
          datos,
          Plot.pointerX({
            x: 'x',
            y: 'y',
            fill: c.superficie,
            stroke: c.eje,
            title: (d: (typeof datos)[number]) => `${mensual ? mes(String(d.fila[f.x]), true) : String(d.fila[f.x])}\n${f.y}: ${celda(d.y)}`,
          }),
        ),
      ],
    })
  }

  if (f.tipo === 'numeros')
    return Plot.plot({
      ...comun,
      height: 300,
      marginLeft: 64,
      x: { type: 'band', padding: 0.3, label: f.x, tickSize: 0, tickFormat: (v: number) => String(v) },
      y: { ...ejeY, ticks: 5 },
      marks: [
        Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 5 }),
        Plot.barY(filas, { x: f.x, y: f.y, fill: c.dato, ry2: 4, insetLeft: 0.5, insetRight: 0.5 }),
        Plot.ruleY([0], { stroke: c.eje }),
        Plot.tip(filas, Plot.pointerX({ x: f.x, y: f.y, fill: c.superficie, stroke: c.eje, title: titulo })),
      ],
    })

  const etiquetas = filas.map((d) => corto(String(d[f.x] ?? '—')))
  const largo = Math.max(...etiquetas.map((e) => e.length))
  const izquierda = Math.min(ancho * 0.45, Math.max(60, largo * 6.6 + 12))
  const datos = filas.map((d, i) => ({ ...d, _i: i }))
  return Plot.plot({
    ...comun,
    height: Math.max(120, filas.length * 26 + 40),
    marginLeft: izquierda,
    marginRight: 24,
    x: { label: null, grid: false, ticks: 4, tickFormat: (v: number) => celda(v) },
    y: { label: null, domain: datos.map((d) => d._i), tickFormat: (i: number) => etiquetas[i], tickSize: 0, padding: 0.28 },
    marks: [
      Plot.gridX({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.barX(datos, { y: '_i', x: f.y, fill: c.dato, rx2: 4 }),
      Plot.ruleX([0], { stroke: c.eje }),
      Plot.tip(datos, Plot.pointerY({ y: '_i', x: f.y, fill: c.superficie, stroke: c.eje, title: titulo })),
    ],
  })
}
