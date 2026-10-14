// Cifras en español de Chile: punto para los miles, coma para los decimales. Entre la cifra y su unidad va un
// espacio que no se corta (NBSP), para que «21,6 %» no quede partido en dos líneas.
export const NB = '\u00a0'
const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function numero(n: number, decimales = 0) {
  return n.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

export const enteros = (n: number) => entero.format(n)

/** £ 18,98 M · £ 719.656 · £ 460,57 */
export function libras(n: number, { compacto = true, decimales }: { compacto?: boolean; decimales?: number } = {}) {
  const signo = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (compacto && a >= 1_000_000) return `${signo}£${NB}${numero(a / 1_000_000, decimales ?? 2)}${NB}M`
  if (compacto && a >= 10_000) return `${signo}£${NB}${numero(a / 1_000, decimales ?? 0)}${NB}mil`
  return `${signo}£${NB}${numero(a, decimales ?? (a < 1000 ? 2 : 0))}`
}

export const pct = (n: number, decimales = 1) => `${numero(n, decimales)}${NB}%`

/** "2010-11-01" → "nov 2010" */
export function mes(iso: string, largo = false) {
  const [a, m] = iso.split('-').map(Number)
  return `${(largo ? MESES_LARGOS : MESES)[m - 1]} ${a}`
}

/** Un valor cualquiera de una tabla, como se muestra en una celda. */
export function celda(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? enteros(v) : numero(v, Math.abs(v) < 1 ? 4 : 2)
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  return String(v)
}

/** 412 ms → «0,41 s»; 3.200 ms → «3,2 s» */
export const segundos = (ms: number) => `${numero(ms / 1000, ms < 1000 ? 2 : 1)} s`

/** Plata con el símbolo que se elija («$ 18,98 M», «US$ 719 mil»…); libras() es el caso de la tienda de ejemplo. */
export function dinero(n: number, simbolo: string, opciones: { compacto?: boolean; decimales?: number } = {}) {
  return libras(n, opciones).replace('£', simbolo).replace(/^(−?) /, '$1')
}
