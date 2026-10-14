// Lee la primera hoja de un Excel (.xlsx) en el navegador y la pasa a CSV, para que DuckDB la lea como cualquier
// archivo. Un .xlsx es un zip con XML: los textos están en sharedStrings.xml, las celdas en sheet1.xml y los
// formatos de fecha en styles.xml (Excel guarda las fechas como número de días desde 1899-12-30).
import { strFromU8, unzipSync } from 'fflate'

const FORMATOS_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

function xml(archivos: Record<string, Uint8Array>, ruta: string): Document | null {
  const datos = archivos[ruta]
  return datos ? new DOMParser().parseFromString(strFromU8(datos), 'application/xml') : null
}

const hijos = (el: Element | Document, nombre: string) => Array.from(el.getElementsByTagName(nombre))

/** Columna de Excel («A», «AB») a índice desde 0. */
function indice(ref: string) {
  let n = 0
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function fechaExcel(serie: number) {
  const ms = Math.round((serie - 25569) * 86400 * 1000)
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

const csvCelda = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)

export function excelACsv(contenido: ArrayBuffer): { csv: string; hoja: string } {
  const archivos = unzipSync(new Uint8Array(contenido), { filter: (f) => f.name.startsWith('xl/') })
  const libro = xml(archivos, 'xl/workbook.xml')
  const primera = libro ? hijos(libro, 'sheet')[0] : null
  // la primera hoja: su archivo sale de las relaciones del libro
  let ruta = 'xl/worksheets/sheet1.xml'
  const rels = xml(archivos, 'xl/_rels/workbook.xml.rels')
  const id = primera?.getAttribute('r:id')
  if (rels && id) {
    const destino = hijos(rels, 'Relationship').find((r) => r.getAttribute('Id') === id)?.getAttribute('Target')
    if (destino) ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`
  }
  const hoja = xml(archivos, ruta)
  if (!hoja) throw new Error('No encontré la primera hoja del Excel.')

  const compartidos = (() => {
    const doc = xml(archivos, 'xl/sharedStrings.xml')
    return doc ? hijos(doc, 'si').map((si) => hijos(si, 't').map((t) => t.textContent ?? '').join('')) : []
  })()
  // qué estilos de celda son fechas
  const esFecha: boolean[] = (() => {
    const doc = xml(archivos, 'xl/styles.xml')
    if (!doc) return []
    const propios = new Map(hijos(doc, 'numFmt').map((f) => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '']))
    const xfs = doc.getElementsByTagName('cellXfs')[0]
    return xfs
      ? hijos(xfs, 'xf').map((xf) => {
          const n = Number(xf.getAttribute('numFmtId') ?? 0)
          const codigo = propios.get(n)
          return FORMATOS_FECHA.has(n) || (!!codigo && /[dmy]/i.test(codigo.replace(/\[[^\]]*\]|"[^"]*"/g, '')) && !/^[#0.,%]+$/.test(codigo))
        })
      : []
  })()

  const filas: string[][] = []
  let ancho = 0
  for (const fila of hijos(hoja, 'row')) {
    const valores: string[] = []
    for (const c of hijos(fila, 'c')) {
      const i = indice(c.getAttribute('r') ?? '')
      const tipo = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let texto = v
      if (tipo === 's') texto = compartidos[Number(v)] ?? ''
      else if (tipo === 'inlineStr') texto = hijos(c, 't').map((t) => t.textContent ?? '').join('')
      else if (tipo === 'b') texto = v === '1' ? 'VERDADERO' : 'FALSO'
      else if (v !== '' && esFecha[Number(c.getAttribute('s') ?? 0)]) texto = fechaExcel(Number(v))
      valores[i >= 0 ? i : valores.length] = texto
    }
    ancho = Math.max(ancho, valores.length)
    filas.push(valores)
  }
  const csv = filas.map((f) => Array.from({ length: ancho }, (_, i) => csvCelda(f[i] ?? '')).join(',')).join('\n')
  return { csv, hoja: primera?.getAttribute('name') ?? 'Hoja 1' }
}
