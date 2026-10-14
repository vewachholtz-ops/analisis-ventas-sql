// Los gráficos del informe con Observable Plot. Un solo tono para el dato (verde), gris para el contexto: el
// color marca lo que la sección cuenta, no cada serie. Cada gráfico tiene su tabla en la pestaña de al lado.
import * as Plot from '@observablehq/plot'
import { ABC, COHORTES, CURVA_ABC, MENSUAL, PAISES, RFM } from '../lib/datos'
import { enteros, libras, mes, numero, pct } from '../lib/formato'
import { color } from '../lib/tema'

const MESES_TEMPORADA = ['dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov']

function colores() {
  return {
    dato: color('dato'),
    contexto: color('contexto'),
    tinta: color('tinta'),
    suave: color('tinta-suave'),
    tenue: color('tinta-tenue'),
    superficie: color('superficie'),
    grilla: color('grilla'),
    eje: color('eje'),
    baya: color('baya'),
    rampa: [1, 2, 3, 4, 5, 6, 7].map((i) => color(`r${i}`)),
  }
}

const base = (ancho: number, alto: number) => ({
  width: ancho,
  height: alto,
  // sin esto Plot usa system-ui; así toma la tipografía de la página
  style: { fontSize: '12px', fontFamily: 'inherit' },
})

// ---- portada: el pulso de la temporada ----
export function pulso(ancho: number) {
  const c = colores()
  const datos = MENSUAL.map((d) => ({ ...d, noviembre: d.mes.slice(5, 7) === '11' }))
  const trimestres = ancho < 600 ? ['01', '07'] : ['01', '04', '07', '10']
  const marcas = datos.filter((d) => trimestres.includes(d.mes.slice(5, 7))).map((d) => d.mes)
  return Plot.plot({
    ...base(ancho, ancho < 600 ? 220 : 280),
    marginLeft: 56,
    marginTop: 28,
    x: { type: 'band', padding: 0.32, label: null, ticks: marcas, tickFormat: (d: string) => mes(d), tickSize: 0 },
    y: { label: null, grid: true, ticks: 4, tickFormat: (d: number) => (d ? `£ ${numero(d / 1e6, 1)} M` : '0') },
    marks: [
      Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.barY(datos, {
        x: 'mes',
        y: 'ventas_netas',
        fill: (d) => (d.noviembre ? c.dato : c.contexto),
        fillOpacity: (d) => (d.mes_parcial ? 0.5 : 1),
        ry2: 4,
      }),
      Plot.ruleY([0], { stroke: c.eje }),
      Plot.text(
        datos.filter((d) => d.noviembre),
        { x: 'mes', y: 'ventas_netas', text: (d) => `${mes(d.mes)}: ${libras(d.ventas_netas)}`, dy: -12, fill: c.tinta, fontWeight: 600, textAnchor: 'end', dx: 14 },
      ),
      Plot.tip(
        datos,
        Plot.pointerX({
          x: 'mes',
          y: 'ventas_netas',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) =>
            [
              `${mes(d.mes, true)}${d.mes_parcial ? ' (hasta el día 9)' : ''}`,
              `${libras(d.ventas_netas)} netas`,
              `${enteros(d.pedidos)} pedidos de ${enteros(d.clientes)} clientes`,
              d.variacion_anual_pct !== null ? `${d.variacion_anual_pct > 0 ? '+' : ''}${numero(d.variacion_anual_pct, 1)} % contra el año anterior` : '',
            ]
              .filter(Boolean)
              .join('\n'),
        }),
      ),
    ],
  })
}

// ---- 01: las dos temporadas, una sobre otra ----
export function temporadas(ancho: number) {
  const c = colores()
  const completos = MENSUAL.filter((d) => !d.mes_parcial)
  const datos = completos.map((d) => {
    const m = Number(d.mes.slice(5, 7))
    return {
      ...d,
      orden: m === 12 ? 0 : m,
      temporada: d.mes >= '2010-12-01' ? 'dic 2010 a nov 2011' : 'dic 2009 a nov 2010',
    }
  })
  const pares = MESES_TEMPORADA.map((nombre, orden) => {
    const del = datos.filter((d) => d.orden === orden)
    const [a, b] = [del.find((d) => d.temporada.startsWith('dic 2009')), del.find((d) => d.temporada.startsWith('dic 2010'))]
    return { orden, nombre, a: a?.ventas_netas ?? null, b: b?.ventas_netas ?? null, y: Math.max(a?.ventas_netas ?? 0, b?.ventas_netas ?? 0) }
  })
  const ultimo = datos.filter((d) => d.orden === 11)
  return Plot.plot({
    ...base(ancho, 300),
    marginLeft: 56,
    marginRight: ancho < 600 ? 20 : 120,
    x: { domain: [0, 11], label: null, ticks: ancho < 500 ? [0, 2, 4, 6, 8, 10] : 12, tickFormat: (i: number) => MESES_TEMPORADA[i], tickSize: 0 },
    y: { label: null, grid: true, ticks: 4, domain: [0, 1_550_000], tickFormat: (d: number) => (d ? `£ ${numero(d / 1e6, 1)} M` : '0') },
    color: { domain: ['dic 2009 a nov 2010', 'dic 2010 a nov 2011'], range: [c.contexto, c.dato] },
    marks: [
      Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.ruleY([0], { stroke: c.eje }),
      Plot.lineY(datos, { x: 'orden', y: 'ventas_netas', stroke: 'temporada', strokeWidth: 2, curve: 'monotone-x' }),
      Plot.dot(datos, { x: 'orden', y: 'ventas_netas', fill: 'temporada', r: 4, stroke: c.superficie, strokeWidth: 2 }),
      ...(ancho < 600
        ? []
        : [
            ...[0, 1].map((k) =>
              Plot.text(
                ultimo.filter((d) => d.temporada.startsWith('dic 2010') === (k === 0)),
                {
                  x: 'orden',
                  y: 'ventas_netas',
                  text: (d) => `${d.temporada.slice(-8)}: ${libras(d.ventas_netas)}`,
                  dx: 10,
                  dy: k === 0 ? -8 : 8,
                  textAnchor: 'start',
                  fill: k === 0 ? c.tinta : c.suave,
                },
              ),
            ),
          ]),
      Plot.ruleX(pares, Plot.pointerX({ x: 'orden', stroke: c.eje })),
      Plot.tip(
        pares,
        Plot.pointerX({
          x: 'orden',
          y: 'y',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) =>
            `${d.nombre}\n${d.b !== null ? `${libras(d.b)} en 2010-2011` : ''}\n${d.a !== null ? `${libras(d.a)} en 2009-2010` : ''}`,
        }),
      ),
    ],
  })
}

// ---- 02: la curva ABC ----
export function pareto(ancho: number) {
  const c = colores()
  const [a, b] = ABC
  const cortes = [
    { x: a.pct_productos / 100, y: 0.8, texto: `A: el ${numero(a.pct_productos, 1)} % de los productos hace el 80 % de las ventas` },
    { x: (a.pct_productos + b.pct_productos) / 100, y: 0.95, texto: `B: con el ${numero(a.pct_productos + b.pct_productos, 1)} % se llega al 95 %` },
  ]
  return Plot.plot({
    ...base(ancho, 320),
    marginLeft: 48,
    marginBottom: 46,
    x: { domain: [0, 1], label: 'Productos, de mayor a menor venta', labelAnchor: 'center', labelArrow: 'none', labelOffset: 40, tickFormat: (d: number) => `${Math.round(d * 100)} %`, ticks: 5 },
    y: { domain: [0, 1], label: null, grid: true, tickFormat: (d: number) => `${Math.round(d * 100)} %`, ticks: 5 },
    marks: [
      Plot.gridY({ stroke: c.grilla, strokeOpacity: 1, ticks: 5 }),
      Plot.areaY(CURVA_ABC, { x: 'pct_productos', y: 'acum', fill: c.dato, fillOpacity: 0.1, curve: 'monotone-x' }),
      Plot.lineY(CURVA_ABC, { x: 'pct_productos', y: 'acum', stroke: c.dato, strokeWidth: 2, curve: 'monotone-x' }),
      Plot.ruleX(cortes, { x: 'x', y1: 0, y2: 'y', stroke: c.eje }),
      Plot.ruleY(cortes, { y: 'y', x1: 0, x2: 'x', stroke: c.eje }),
      Plot.dot(cortes, { x: 'x', y: 'y', r: 5, fill: c.dato, stroke: c.superficie, strokeWidth: 2 }),
      Plot.text(cortes, {
        x: 'x',
        y: 'y',
        text: 'texto',
        dx: 10,
        dy: 13,
        textAnchor: 'start',
        fill: c.tinta,
        lineWidth: ancho < 600 ? 11 : 30,
      }),
      Plot.ruleY([0], { stroke: c.eje }),
      Plot.tip(
        CURVA_ABC,
        Plot.pointerX({
          x: 'pct_productos',
          y: 'acum',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `El ${numero(d.pct_productos * 100, 1)} % de los productos\nhace el ${numero(d.acum * 100, 1)} % de las ventas\nclase ${d.clase}`,
        }),
      ),
    ],
  })
}

// ---- 03: cuántos clientes son y cuánto venden ----
export function rfm(ancho: number) {
  const c = colores()
  const datos = [...RFM].sort((x, y) => y.pct_ventas - x.pct_ventas)
  const campeones = datos.filter((d) => d.segmento === 'Campeones')
  return Plot.plot({
    ...base(ancho, 290),
    marginLeft: ancho < 600 ? 112 : 132,
    marginRight: 24,
    x: { domain: [0, 75], label: null, grid: true, ticks: 4, tickFormat: (d: number) => `${d} %` },
    y: { domain: datos.map((d) => d.segmento), label: null, tickSize: 0 },
    marks: [
      Plot.gridX({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.link(datos, { x1: 'pct_clientes', x2: 'pct_ventas', y1: 'segmento', y2: 'segmento', stroke: c.eje, strokeWidth: 2 }),
      Plot.dot(datos, { x: 'pct_clientes', y: 'segmento', r: 5, fill: c.contexto, stroke: c.superficie, strokeWidth: 2 }),
      Plot.dot(datos, { x: 'pct_ventas', y: 'segmento', r: 5, fill: c.dato, stroke: c.superficie, strokeWidth: 2 }),
      Plot.text(campeones, { x: 'pct_clientes', y: 'segmento', text: (d) => pct(d.pct_clientes), dy: -14, fill: c.suave }),
      Plot.text(campeones, { x: 'pct_ventas', y: 'segmento', text: (d) => pct(d.pct_ventas), dy: -14, fill: c.tinta, fontWeight: 600 }),
      Plot.tip(
        datos,
        Plot.pointerY({
          y: 'segmento',
          x: 'pct_ventas',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) =>
            `${d.segmento}\n${pct(d.pct_clientes)} de los clientes (${enteros(d.clientes)})\n${pct(d.pct_ventas)} de las ventas\n${numero(d.pedidos_promedio, 1)} pedidos y ${libras(d.monto_promedio)} en promedio\núltima compra hace ${enteros(d.recencia_mediana_dias)} días (mediana)`,
        }),
      ),
    ],
  })
}

// ---- 04: retención por cohorte ----
export function cohortes(ancho: number) {
  const c = colores()
  const datos = COHORTES.filter((d) => d.meses_desde >= 1 && d.meses_desde <= 12 && d.cohorte < '2010-12-01')
  const filas = [...new Set(datos.map((d) => d.cohorte))]
  return Plot.plot({
    ...base(ancho, 34 * filas.length + 70),
    marginLeft: 72,
    marginTop: 34,
    padding: 0,
    x: { label: 'Meses desde la primera compra', labelAnchor: 'center', labelArrow: 'none', tickSize: 0, axis: 'top', domain: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    y: { label: null, tickSize: 0, domain: filas, tickFormat: (d: string) => mes(d) },
    color: {
      type: 'linear',
      domain: [0, 40],
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
        datos.filter((d) => d.meses_desde === 1),
        { x: 'meses_desde', y: 'cohorte', text: (d) => numero(d.retencion_pct, 0), fill: (d) => (d.retencion_pct > 26 ? c.superficie : c.tinta), fontWeight: 600 },
      ),
      Plot.tip(
        datos,
        Plot.pointer({
          x: 'meses_desde',
          y: 'cohorte',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `Clientes que compraron por primera vez en ${mes(d.cohorte, true)}:\n${pct(d.retencion_pct)} volvió ${d.meses_desde === 1 ? 'al mes siguiente' : `${d.meses_desde} meses después`} (${enteros(d.clientes)})`,
        }),
      ),
    ],
  })
}

// ---- 06: el ticket por país ----
export function paises(ancho: number) {
  const c = colores()
  const datos = PAISES.filter((d) => d.pais !== 'Otros').sort((x, y) => y.ticket_promedio - x.ticket_promedio)
  const destacados = new Set(['Netherlands', 'Australia'])
  return Plot.plot({
    ...base(ancho, 30 * datos.length + 40),
    marginLeft: 118,
    marginRight: ancho < 600 ? 60 : 150,
    x: { label: null, grid: true, ticks: 4, tickFormat: (d: number) => `£ ${numero(d, 0)}` },
    y: { domain: datos.map((d) => d.pais), label: null, tickSize: 0, tickFormat: (p: string) => PAIS_ES[p] ?? p, padding: 0.35 },
    marks: [
      Plot.gridX({ stroke: c.grilla, strokeOpacity: 1, ticks: 4 }),
      Plot.barX(datos, { x: 'ticket_promedio', y: 'pais', fill: (d) => (destacados.has(d.pais) ? c.dato : c.contexto), rx2: 4 }),
      Plot.ruleX([0], { stroke: c.eje }),
      ...[true, false].map((destacado) =>
        Plot.text(
          datos.filter((d) => destacados.has(d.pais) === destacado),
          {
            x: 'ticket_promedio',
            y: 'pais',
            text: (d) => (ancho < 600 ? libras(d.ticket_promedio, { decimales: 0 }) : `${libras(d.ticket_promedio, { decimales: 0 })}, ${enteros(d.clientes)} ${d.clientes === 1 ? 'cliente' : 'clientes'}`),
            dx: 6,
            textAnchor: 'start',
            fill: destacado ? c.tinta : c.suave,
            fontWeight: destacado ? 600 : 400,
          },
        ),
      ),
      Plot.tip(
        datos,
        Plot.pointerY({
          x: 'ticket_promedio',
          y: 'pais',
          fill: c.superficie,
          stroke: c.eje,
          title: (d) => `${PAIS_ES[d.pais] ?? d.pais}\n${libras(d.ticket_promedio)} por pedido\n${enteros(d.clientes)} clientes, ${libras(d.ventas_netas)} en el año (${pct(d.pct_ventas)})`,
        }),
      ),
    ],
  })
}

export const PAIS_ES: Record<string, string> = {
  'United Kingdom': 'Reino Unido',
  Netherlands: 'Países Bajos',
  EIRE: 'Irlanda',
  Germany: 'Alemania',
  France: 'Francia',
  Australia: 'Australia',
  Switzerland: 'Suiza',
  Spain: 'España',
  Japan: 'Japón',
  Belgium: 'Bélgica',
  Otros: 'Otros',
}
