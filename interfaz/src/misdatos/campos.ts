// Qué columnas necesita el análisis y cómo adivinar cuál es cuál en un archivo cualquiera: por el nombre del
// encabezado (en español o inglés) y, para fechas y números, mirando unos cuantos valores.

export type Campo = 'factura' | 'fecha' | 'codigo' | 'descripcion' | 'cantidad' | 'precio' | 'monto' | 'cliente' | 'pais'

export interface DefinicionCampo {
  campo: Campo
  nombre: string
  ayuda: string
  /** true: obligatorio; un texto: basta uno de los campos con ese grupo; false: opcional. */
  obligatorio: boolean | 'producto' | 'valor'
  pistas: RegExp
}

export const CAMPOS: DefinicionCampo[] = [
  {
    campo: 'factura',
    nombre: 'Factura o boleta',
    ayuda: 'Las líneas de una misma compra comparten este número.',
    obligatorio: true,
    pistas: /factura|boleta|invoice|documento|^doc|pedido|orden|order|ticket|folio|transacci|venta.?id|n[°º]/i,
  },
  { campo: 'fecha', nombre: 'Fecha', ayuda: 'Día (y hora, si viene) de la compra.', obligatorio: true, pistas: /fecha|date|d[ií]a|time|emisi/i },
  {
    campo: 'codigo',
    nombre: 'Código del producto',
    ayuda: 'SKU o código. Si no hay, se usa el nombre.',
    obligatorio: 'producto',
    pistas: /sku|c[oó]digo|code|stock|^item$|art[ií]culo|id.?prod|product.?id|^ref/i,
  },
  {
    campo: 'descripcion',
    nombre: 'Nombre del producto',
    ayuda: 'Si no hay, se usa el código.',
    obligatorio: 'producto',
    pistas: /producto|descrip|nombre|product|detalle|item.?name|glosa/i,
  },
  { campo: 'cantidad', nombre: 'Cantidad', ayuda: 'Unidades de la línea.', obligatorio: true, pistas: /cantidad|^cant|qty|quantity|unidades|units/i },
  {
    campo: 'precio',
    nombre: 'Precio unitario',
    ayuda: 'O el total de la línea, más abajo.',
    obligatorio: 'valor',
    pistas: /precio|price|valor.?unit|unit/i,
  },
  {
    campo: 'monto',
    nombre: 'Total de la línea',
    ayuda: 'Solo si no hay precio unitario: precio = total ÷ cantidad.',
    obligatorio: 'valor',
    pistas: /total|monto|importe|amount|^sales$|subtotal|neto/i,
  },
  { campo: 'cliente', nombre: 'Cliente', ayuda: 'Para segmentar clientes y medir si vuelven.', obligatorio: false, pistas: /cliente|customer|client|comprador|rut/i },
  {
    campo: 'pais',
    nombre: 'País, región o comuna',
    ayuda: 'Para ver dónde se vende.',
    obligatorio: false,
    pistas: /pa[ií]s|country|regi[oó]n|comuna|ciudad|city|sucursal|tienda|zona|local/i,
  },
]

export type Mapeo = Partial<Record<Campo, string>>

/** Adivina el mapeo por los encabezados: cada columna se usa una sola vez, en el orden de CAMPOS. */
export function adivinar(columnas: string[], muestra: Record<string, string | null>[]): Mapeo {
  const usadas = new Set<string>()
  const mapeo: Mapeo = {}
  for (const d of CAMPOS) {
    const candidatas = columnas.filter((c) => !usadas.has(c) && d.pistas.test(c.trim()))
    // entre varias, la que parece del tipo correcto (una fecha que parezca fecha, una cantidad que sea número)
    const buena = candidatas.find((c) => calza(d.campo, muestra.map((f) => f[c]))) ?? candidatas[0]
    if (buena) {
      mapeo[d.campo] = buena
      usadas.add(buena)
    }
  }
  // con precio unitario no hace falta el total
  if (mapeo.precio && mapeo.monto) delete mapeo.monto
  return mapeo
}

function calza(campo: Campo, valores: (string | null)[]) {
  const v = valores.filter((x): x is string => !!x && x.trim() !== '').slice(0, 50)
  if (!v.length) return false
  if (campo === 'fecha') return v.filter((x) => /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(x)).length >= v.length * 0.8
  if (campo === 'cantidad' || campo === 'precio' || campo === 'monto') return v.filter((x) => /^[-$€£\s\d.,US]+$/.test(x.trim())).length >= v.length * 0.8
  return true
}

/** Lo que falta para poder analizar, en palabras. */
export function faltantes(m: Mapeo): string[] {
  const f: string[] = []
  if (!m.factura) f.push('la factura o boleta')
  if (!m.fecha) f.push('la fecha')
  if (!m.codigo && !m.descripcion) f.push('el código o el nombre del producto')
  if (!m.cantidad) f.push('la cantidad')
  if (!m.precio && !m.monto) f.push('el precio unitario o el total de la línea')
  return f
}

// ---------------------------------------------------------------- formatos
export type FormatoFecha = 'dmy' | 'mdy' | 'ymd'
export type Decimal = 'coma' | 'punto'

/** Día-mes-año, mes-día-año o año-mes-día, mirando los valores: si el primer número pasa de 12 es el día. */
export function detectarFecha(valores: (string | null)[]): FormatoFecha {
  const v = valores.filter((x): x is string => !!x).map((x) => x.trim())
  if (v.length && v.filter((x) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(x)).length >= v.length * 0.8) return 'ymd'
  let primeroGrande = false
  let segundoGrande = false
  for (const x of v) {
    const m = x.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/)
    if (!m) continue
    if (Number(m[1]) > 12) primeroGrande = true
    if (Number(m[2]) > 12) segundoGrande = true
  }
  return segundoGrande && !primeroGrande ? 'mdy' : 'dmy'
}

/** Coma o punto decimal: «1.490» y «12,5» son de Chile; «1,490.00» y «12.5», de Estados Unidos. */
export function detectarDecimal(valores: (string | null)[]): Decimal {
  let coma = 0
  let punto = 0
  for (const x of valores) {
    if (!x) continue
    const s = x.replace(/[^\d.,-]/g, '')
    if (/,\d{1,2}$/.test(s) || /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) coma++
    else if (/\.\d{1,2}$/.test(s) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) punto++
  }
  return coma > punto ? 'coma' : 'punto'
}
