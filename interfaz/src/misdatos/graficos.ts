// Los gráficos del informe con datos propios: los mismos del informe de ejemplo, pero sin las anotaciones que solo
// valen para la tienda de Online Retail II (noviembre, Países Bajos…). Lo que se destaca sale de los datos.
import * as Plot from '@observablehq/plot'
import type { Fila } from '../lib/datos'
import { dinero, enteros, mes, numero, pct } from '../lib/formato'
import { color } from '../lib/tema'

const base = (ancho: number, alto: number) => ({ width: ancho, height: alto, style: { fontSize: '12px', fontFamily: 'inherit' } })

function colores() {
  return {
    dato: color('dato'),
    contexto: color('contexto'),
    tinta: color('tinta'),
    suave: color('tinta-suave'),
    superficie: color('superficie'),
    grilla: color('grilla'),
    eje: color('eje'),
    rampa: [1, 2, 3, 4, 5, 6, 7].map((i) => color(`r${i}`)),
  }
}

const n = (v: unknown) => Number(v)
const s = (v: unknown) => String(v)

/** Ventas netas por mes; el mejor mes, destacado; el mes sin terminar, más claro. */
export function mensual(ancho: number, filas: Fila[], moneda: string) {
  const c = colores()
  const datos = filas.map((d) => ({ mes: s(d.mes).slice(0, 10), ventas: n(d.ventas_netas), parcial: d.mes_parcial === true, pedidos: n(d.pedidos), clientes: n(d.clientes) }))
  const completos = datos.filter((d) => !d.parcial)
  const mejor = (completos.length ? completos : datos).reduce((a, b) => (b.ventas > a.ventas ? b : a))
  const cada = Math.max(1, Math.ceil(datos.length / (ancho < 600 ? 4 : 8)))
  const marcas = datos.filter((_, i) => i % cada === 0).map((d) => d.mes)
  return Plot.plot({
    ...base(ancho, ancho < 600 ? 220 : 280),
    marginLeft: 64,
    marginTop: 28,
    x: { type: 'band', padding: 0.28, label: null, ticks: marcas, tickFormat: (d: string) => mes(d), tickSize: 0 },
    y: { label: null, grid: true, ticks: 4, tickFormat: (d: number) => (d ? dinero(d, moneda, { decimales: Number.isInteger(d / 1e6) || Number.isInteger(d / 1e3) ? 0 : 1 }) : '0') },
    marks: [
      Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.barY(datos, { x: 'mes', y: 'ventas', fill: (d) => (d === mejor ? c.dato : c.contexto), fillOpacity: (d) => (d.parcial ? 0.5 : 1), ry2: 4 }),
      Plot.ruleY([0], { stroke: c.eje }),
      Plot.text([mejor], { x: 'mes', y: 'ventas', text: (d) => `${mes(d.mes)}: ${dinero(d.ventas, moneda)}`, dy: -12, fill: c.tinta, fontWeight: 600 }),
      Plot.tip(
        datos,
        Plot.pointerX({
          x: 'mes',
          y: 'ventas',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `${mes(d.mes, true)}${d.parcial ? ' (sin terminar)' : ''}\n${dinero(d.ventas, moneda)} netas\n${enteros(d.pedidos)} pedidos`,
        }),
      ),
    ],
  })
}

/** La curva ABC con los cortes del 80 y el 95 %. */
export function pareto(ancho: number, curva: Fila[], abc: Fila[]) {
  const c = colores()
  const a = abc.find((x) => x.clase === 'A')
  const b = abc.find((x) => x.clase === 'B')
  const cortes = [
    ...(a ? [{ x: n(a.pct_productos) / 100, y: 0.8, texto: `A: el ${numero(n(a.pct_productos), 1)} % de los productos hace el 80 % de las ventas` }] : []),
    ...(a && b ? [{ x: (n(a.pct_productos) + n(b.pct_productos)) / 100, y: 0.95, texto: `B: con el ${numero(n(a.pct_productos) + n(b.pct_productos), 1)} % se llega al 95 %` }] : []),
  ]
  return Plot.plot({
    ...base(ancho, 320),
    marginLeft: 48,
    marginBottom: 46,
    x: { domain: [0, 1], label: 'Productos, de mayor a menor venta', labelAnchor: 'center', labelArrow: 'none', labelOffset: 40, tickFormat: (d: number) => `${Math.round(d * 100)} %`, ticks: 5 },
    y: { domain: [0, 1], label: null, grid: true, tickFormat: (d: number) => `${Math.round(d * 100)} %`, ticks: 5 },
    marks: [
      Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 5 }),
      Plot.areaY(curva, { x: 'pct_productos', y: 'acum', fill: c.dato, fillOpacity: 0.1, curve: 'monotone-x' }),
      Plot.lineY(curva, { x: 'pct_productos', y: 'acum', stroke: c.dato, strokeWidth: 2, curve: 'monotone-x' }),
      Plot.ruleX(cortes, { x: 'x', y1: 0, y2: 'y', stroke: c.eje }),
      Plot.ruleY(cortes, { y: 'y', x1: 0, x2: 'x', stroke: c.eje }),
      Plot.dot(cortes, { x: 'x', y: 'y', r: 5, fill: c.dato, stroke: c.superficie, strokeWidth: 2 }),
      // los rótulos van a la derecha del punto; si el punto está muy a la derecha, a su izquierda
      ...cortes.map((k) =>
        Plot.text([k], { x: 'x', y: 'y', text: 'texto', dx: k.x > 0.6 ? -10 : 10, dy: 13, textAnchor: k.x > 0.6 ? 'end' : 'start', fill: c.tinta, lineWidth: ancho < 600 ? 11 : 30 }),
      ),
      Plot.ruleY([0], { stroke: c.eje }),
      Plot.tip(
        curva,
        Plot.pointerX({
          x: 'pct_productos',
          y: 'acum',
          fill: c.superficie,
          stroke: c.eje,
          title: (d: Fila) => `El ${numero(n(d.pct_productos) * 100, 1)} % de los productos\nhace el ${numero(n(d.acum) * 100, 1)} % de las ventas\nclase ${s(d.clase)}`,
        }),
      ),
    ],
  })
}

/** Por segmento RFM, qué parte de los clientes son y qué parte de las ventas hacen. */
export function rfm(ancho: number, filas: Fila[]) {
  const c = colores()
  const datos = [...filas].sort((x, y) => n(y.pct_ventas) - n(x.pct_ventas))
  const tope = Math.min(100, Math.ceil((Math.max(...datos.flatMap((d) => [n(d.pct_ventas), n(d.pct_clientes)])) + 8) / 10) * 10)
  const primero = datos.slice(0, 1)
  return Plot.plot({
    ...base(ancho, 40 * datos.length + 50),
    marginLeft: ancho < 600 ? 112 : 132,
    marginRight: 24,
    x: { domain: [0, tope], label: null, grid: true, ticks: 4, tickFormat: (d: number) => `${d} %` },
    y: { domain: datos.map((d) => s(d.segmento)), label: null, tickSize: 0 },
    marks: [
      Plot.gridX({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.link(datos, { x1: 'pct_clientes', x2: 'pct_ventas', y1: 'segmento', y2: 'segmento', stroke: c.eje, strokeWidth: 2 }),
      Plot.dot(datos, { x: 'pct_clientes', y: 'segmento', r: 5, fill: c.contexto, stroke: c.superficie, strokeWidth: 2 }),
      Plot.dot(datos, { x: 'pct_ventas', y: 'segmento', r: 5, fill: c.dato, stroke: c.superficie, strokeWidth: 2 }),
      Plot.text(primero, { x: 'pct_clientes', y: 'segmento', text: (d: Fila) => pct(n(d.pct_clientes)), dy: -14, fill: c.suave }),
      Plot.text(primero, { x: 'pct_ventas', y: 'segmento', text: (d: Fila) => pct(n(d.pct_ventas)), dy: -14, fill: c.tinta, fontWeight: 600 }),
      Plot.tip(
        datos,
        Plot.pointerY({
          y: 'segmento',
          x: 'pct_ventas',
          fill: c.superficie,
          stroke: c.eje,
          title: (d: Fila) => `${s(d.segmento)}\n${pct(n(d.pct_clientes))} de los clientes (${enteros(n(d.clientes))})\n${pct(n(d.pct_ventas))} de las ventas`,
        }),
      ),
    ],
  })
}

/** Retención de las últimas cohortes (hasta 12) en los meses que siguen a la primera compra (hasta 12). */
export function cohortes(ancho: number, filas: Fila[]) {
  const c = colores()
  const todas = [...new Set(filas.map((d) => s(d.cohorte)))].sort()
  const conSeguimiento = todas.filter((k) => filas.some((d) => s(d.cohorte) === k && n(d.meses_desde) >= 1))
  const elegidas = new Set(conSeguimiento.slice(-12))
  const datos = filas
    .filter((d) => elegidas.has(s(d.cohorte)) && n(d.meses_desde) >= 1 && n(d.meses_desde) <= 12)
    .map((d) => ({ cohorte: s(d.cohorte).slice(0, 10), meses_desde: n(d.meses_desde), retencion_pct: n(d.retencion_pct) }))
  const filasY = [...new Set(datos.map((d) => d.cohorte))].sort()
  const meses = Math.max(1, ...datos.map((d) => n(d.meses_desde)))
  const tope = Math.max(10, Math.ceil(Math.max(...datos.map((d) => n(d.retencion_pct))) / 10) * 10)
  return Plot.plot({
    ...base(ancho, 30 * filasY.length + 80),
    marginLeft: 72,
    marginTop: 34,
    padding: 0,
    x: { label: 'Meses desde la primera compra', labelAnchor: 'center', labelArrow: 'none', tickSize: 0, axis: 'top', domain: Array.from({ length: meses }, (_, i) => i + 1) },
    y: { label: null, tickSize: 0, domain: filasY, tickFormat: (d: string) => mes(d) },
    color: {
      type: 'linear',
      domain: [0, tope],
      range: [c.rampa[0], c.rampa[6]],
      interpolate: () => (t: number) => c.rampa[Math.max(0, Math.min(6, Math.round(t * 6)))],
      clamp: true,
      legend: true,
      label: '% que vuelve a comprar',
      tickFormat: (d: number) => `${d} %`,
      ticks: 5,
    },
    marks: [
      Plot.cell(datos, { x: 'meses_desde', y: 'cohorte', fill: 'retencion_pct', inset: 1, rx: 3 }),
      Plot.text(
        datos.filter((d) => n(d.meses_desde) === 1),
        { x: 'meses_desde', y: 'cohorte', text: (d) => numero(n(d.retencion_pct), 0), fill: (d) => (n(d.retencion_pct) > tope * 0.6 ? c.superficie : c.tinta), fontWeight: 600 },
      ),
      Plot.tip(
        datos,
        Plot.pointer({
          x: 'meses_desde',
          y: 'cohorte',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `Clientes nuevos de ${mes(d.cohorte, true)}:\n${pct(n(d.retencion_pct))} volvió ${n(d.meses_desde) === 1 ? 'al mes siguiente' : `${d.meses_desde} meses después`}`,
        }),
      ),
    ],
  })
}

/** Ventas por país, región o comuna; el primero, destacado. */
export function lugares(ancho: number, filas: Fila[], moneda: string) {
  const c = colores()
  const datos = filas.filter((d) => d.pais !== 'Otros')
  const primero = datos[0]
  return Plot.plot({
    ...base(ancho, 30 * datos.length + 40),
    marginLeft: Math.min(180, Math.max(80, Math.max(...datos.map((d) => s(d.pais).length)) * 7 + 12)),
    marginRight: ancho < 600 ? 60 : 120,
    x: { label: null, grid: true, ticks: 4, tickFormat: (d: number) => dinero(d, moneda) },
    y: { domain: datos.map((d) => s(d.pais)), label: null, tickSize: 0, padding: 0.35 },
    marks: [
      Plot.gridX({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.barX(datos, { x: 'ventas_netas', y: 'pais', fill: (d) => (d === primero ? c.dato : c.contexto), rx2: 4 }),
      Plot.ruleX([0], { stroke: c.eje }),
      Plot.text(datos, { x: 'ventas_netas', y: 'pais', text: (d) => pct(n(d.pct_ventas)), dx: 6, textAnchor: 'start', fill: c.suave }),
      Plot.tip(
        datos,
        Plot.pointerY({
          x: 'ventas_netas',
          y: 'pais',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `${s(d.pais)}\n${dinero(n(d.ventas_netas), moneda)} (${pct(n(d.pct_ventas))})\n${enteros(n(d.clientes))} clientes\n${dinero(n(d.ticket_promedio), moneda, { compacto: false })} por pedido`,
        }),
      ),
    ],
  })
}
