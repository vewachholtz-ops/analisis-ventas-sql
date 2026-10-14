// SQL en el navegador: DuckDB-WASM con los datos crudos (5,9 MB en formato Arrow comprimido). Se carga una sola vez,
// cuando alguien corre la primera consulta o abre la consola, y crea las mismas vistas que sql/00_limpieza.sql.
// Arrow y no Parquet: DuckDB-WASM lee Arrow sin extensiones, así que la página no depende de bajar nada más.
// solo los tipos: el código de DuckDB-WASM (y Arrow) se baja recién cuando hace falta
import type * as duckdb from '@duckdb/duckdb-wasm'
import { useSyncExternalStore } from 'react'
import type { Fila, Valor } from './datos'
import { CONSULTAS } from './datos'
import { excelACsv } from '../misdatos/excel'
import { type Config, sqlBase, sqlVistas } from '../misdatos/sql'

export type Estado =
  | { fase: 'sin-cargar' }
  | { fase: 'cargando'; paso: string; avance?: number }
  | { fase: 'lista'; version: string }
  | { fase: 'error'; mensaje: string }

let estado: Estado = { fase: 'sin-cargar' }
const oyentes = new Set<() => void>()
function publicar(e: Estado) {
  estado = e
  oyentes.forEach((o) => o())
}
export function useEstadoDuckDB() {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => estado,
  )
}

/** Los archivos de DuckDB: por defecto desde jsDelivr (comprimidos y en caché entre sitios); con
 * VITE_DUCKDB=local, desde la propia página (para las pruebas, que no salen a internet). */
async function paquetes(): Promise<duckdb.DuckDBBundles> {
  if (import.meta.env.VITE_DUCKDB === 'local') {
    const [mvp, eh, trabajadorMvp, trabajadorEh] = await Promise.all([
      import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'),
      import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'),
      import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'),
      import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'),
    ])
    return {
      mvp: { mainModule: mvp.default, mainWorker: trabajadorMvp.default },
      eh: { mainModule: eh.default, mainWorker: trabajadorEh.default },
    }
  }
  return (await import('@duckdb/duckdb-wasm')).getJsDelivrBundles()
}

/** Baja los datos mostrando cuánto lleva y los descomprime (el navegador sabe descomprimir gzip). */
async function bajar(url: string, avisar: (avance: number) => void): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok || !r.body) throw new Error(`No pude bajar los datos (${r.status}).`)
  const total = Number(r.headers.get('content-length')) || 5_930_000
  const lector = r.body.getReader()
  const partes: Uint8Array[] = []
  let llevo = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    partes.push(value)
    llevo += value.length
    avisar(Math.min(1, llevo / total))
  }
  const comprimido = new Blob(partes as BlobPart[]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(comprimido).arrayBuffer())
}

let conexion: Promise<duckdb.AsyncDuckDBConnection> | null = null
let baseDatos: duckdb.AsyncDuckDB | null = null

export function abrir(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conexion) return conexion
  conexion = (async () => {
    try {
      publicar({ fase: 'cargando', paso: 'Cargando DuckDB' })
      const duckdb = await import('@duckdb/duckdb-wasm')
      const paquete = await duckdb.selectBundle(await paquetes())
      const url = URL.createObjectURL(new Blob([`importScripts("${new URL(paquete.mainWorker!, location.href)}");`], { type: 'text/javascript' }))
      const trabajador = new Worker(url)
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), trabajador)
      await db.instantiate(new URL(paquete.mainModule, location.href).toString(), paquete.pthreadWorker)
      URL.revokeObjectURL(url)
      // los enteros grandes y los decimales llegan como números de JavaScript; las fechas, como Date
      await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true, castTimestampToDate: true } })
      publicar({ fase: 'cargando', paso: 'Bajando los datos', avance: 0 })
      const datos = await bajar(new URL('datos/online_retail_ii.arrow.gz', location.href).toString(), (avance) =>
        publicar({ fase: 'cargando', paso: 'Bajando los datos', avance }),
      )
      publicar({ fase: 'cargando', paso: 'Preparando las vistas' })
      const con = await db.connect()
      await con.insertArrowFromIPCStream(datos, { name: 'online_retail_ii', create: true })
      baseDatos = db
      await vistas(con)
      publicar({ fase: 'lista', version: await db.getVersion() })
      return con
    } catch (error) {
      conexion = null
      publicar({ fase: 'error', mensaje: (error as Error).message })
      throw error
    }
  })()
  return conexion
}

/** Separa un texto SQL en sentencias. Los «;» dentro de textos entre comillas o de comentarios no cuentan, y los
 * pedazos que son solo comentarios se descartan. */
export function sentencias(sql: string): string[] {
  const partes: string[] = []
  let inicio = 0
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'" || c === '"') {
      i++
      while (i < sql.length && !(sql[i] === c && sql[i + 1] !== c)) i += sql[i] === c ? 2 : 1
      i++
    } else if (c === '-' && sql[i + 1] === '-') {
      const fin = sql.indexOf('\n', i)
      i = fin < 0 ? sql.length : fin + 1
    } else if (c === '/' && sql[i + 1] === '*') {
      const fin = sql.indexOf('*/', i + 2)
      i = fin < 0 ? sql.length : fin + 2
    } else if (c === ';') {
      partes.push(sql.slice(inicio, i))
      inicio = ++i
    } else i++
  }
  partes.push(sql.slice(inicio))
  return partes.map((p) => p.trim()).filter((p) => p.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim())
}

// ---------------------------------------------------------------- de qué datos salen las vistas
/** Las vistas (crudo, lineas, ventas…) salen de la tienda de ejemplo o del archivo que cargó quien usa la página. */
export type Fuente = { tipo: 'ejemplo' } | { tipo: 'mios'; config: Config }
let fuente: Fuente = { tipo: 'ejemplo' }
const oyentesFuente = new Set<() => void>()
export function useFuente() {
  return useSyncExternalStore(
    (o) => {
      oyentesFuente.add(o)
      return () => oyentesFuente.delete(o)
    },
    () => fuente,
  )
}

/** Crea (o vuelve a crear) las vistas que usan las consultas. Con la tienda de ejemplo: crudo y las de
 * 00_limpieza.sql, más abc y rfm, que crean 02 y 03, para tenerlas a mano en la consola. Con un archivo propio: las
 * de misdatos/sql.ts. Son vistas: no calculan nada hasta que se consultan. */
async function vistas(con: duckdb.AsyncDuckDBConnection) {
  if (fuente.tipo === 'mios') {
    for (const s of sqlVistas(fuente.config)) await con.query(s)
    return
  }
  await con.query('CREATE OR REPLACE VIEW crudo AS SELECT * FROM online_retail_ii')
  for (const id of ['limpieza', 'abc', 'rfm'] as const) for (const s of sentencias(CONSULTAS[id].sql).slice(0, -1)) await con.query(s)
}

/** Deja las vistas como al principio (por si alguien las cambió en la consola). */
export async function restaurarVistas() {
  await vistas(await abrir())
}

/** Pasa las vistas a los datos de ejemplo o a los propios (ya cargados con cargarArchivo y prepararMios). */
export async function usarFuente(f: Fuente) {
  const con = await abrir()
  fuente = f
  await vistas(con)
  oyentesFuente.forEach((o) => o())
}

export interface ArchivoLeido {
  nombre: string
  columnas: string[]
  muestra: Record<string, string | null>[]
  filas: number
  hoja?: string
}

/** Lee el archivo de ventas de quien usa la página (CSV o Excel) como texto, tal cual, en la tabla mis_ventas_crudo.
 * Nada sale del navegador: DuckDB lo lee desde el disco. */
export async function cargarArchivo(archivo: File): Promise<ArchivoLeido> {
  const con = await abrir()
  const db = baseDatos!
  const { DuckDBDataProtocol } = await import('@duckdb/duckdb-wasm')
  let hoja: string | undefined
  await db.dropFile('mis_ventas.csv').catch(() => {})
  if (/\.xlsx$/i.test(archivo.name)) {
    const leido = excelACsv(await archivo.arrayBuffer())
    hoja = leido.hoja
    await db.registerFileText('mis_ventas.csv', leido.csv)
  } else if (/\.xls$/i.test(archivo.name)) {
    throw new Error('Los Excel antiguos (.xls) no se pueden leer aquí: guárdalo como .xlsx o como CSV.')
  } else await db.registerFileHandle('mis_ventas.csv', archivo, DuckDBDataProtocol.BROWSER_FILEREADER, true)
  const leer = (extra = '') => con.query(`CREATE OR REPLACE TABLE mis_ventas_crudo AS SELECT * FROM read_csv('mis_ventas.csv', all_varchar = true, header = true${extra})`)
  try {
    await leer()
  } catch (error) {
    // los CSV que guarda Excel en Windows suelen venir en Latin-1 y no en UTF-8
    if (/unicode|utf|encoding/i.test((error as Error).message)) await leer(", encoding = 'latin-1'")
    else throw new Error(`No pude leer el archivo como tabla: ${(error as Error).message.split('\n')[0]}`)
  }
  const columnas = (await con.query('SELECT * FROM mis_ventas_crudo LIMIT 0')).schema.fields.map((f) => f.name)
  const muestra = filasDe(await con.query('SELECT * FROM mis_ventas_crudo LIMIT 300')) as Record<string, string | null>[]
  const filas = Number((await con.query('SELECT count(*) AS n FROM mis_ventas_crudo')).get(0)!.n)
  if (!filas) throw new Error('El archivo no tiene filas debajo del encabezado.')
  return { nombre: archivo.name, columnas, muestra, filas, hoja }
}

/** Arma la tabla de líneas con el mapeo elegido y deja las vistas sobre ella. */
export async function prepararMios(config: Config) {
  const con = await abrir()
  await con.query(sqlBase(config))
  await usarFuente({ tipo: 'mios', config })
}

export interface Resultado {
  columnas: { nombre: string; tipo: string }[]
  filas: Fila[]
  ms: number
}

/** Convierte un valor de Arrow a lo que se muestra: BigInt a número, fechas a texto ISO. */
function valor(v: unknown, tipo: string): Valor {
  if (v === null || v === undefined) return null
  if (typeof v === 'bigint') return Number(v)
  const fecha = typeof v === 'number' ? new Date(v) : v instanceof Date ? v : null
  if (fecha && /^Date32|^Date<DAY>/.test(tipo)) return fecha.toISOString().slice(0, 10)
  if (fecha && /^(Date|Timestamp)/.test(tipo)) return fecha.toISOString().slice(0, 19).replace('T', ' ')
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return String(v)
}

type Tabla = Awaited<ReturnType<duckdb.AsyncDuckDBConnection['query']>>

/** Las filas de una tabla de Arrow como objetos simples (las primeras `maximo`). */
export function filasDe(tabla: Tabla, maximo = Infinity): Fila[] {
  const columnas = tabla.schema.fields.map((f) => ({ nombre: f.name, tipo: String(f.type) }))
  const filas: Fila[] = []
  for (let i = 0; i < Math.min(tabla.numRows, maximo); i++) {
    const fila = tabla.get(i)!
    const salida: Fila = {}
    for (const c of columnas) salida[c.nombre] = valor(fila[c.nombre], c.tipo)
    filas.push(salida)
  }
  return filas
}

/** Corre SQL: una o varias sentencias, en orden; vuelve el resultado de la última (y la tabla de Arrow entera,
 * para descargarla). */
export async function correr(sql: string, maximo = 5000): Promise<Resultado & { total: number; tabla: Tabla }> {
  const con = await abrir()
  const lista = sentencias(sql)
  if (!lista.length) throw new Error('No hay ninguna consulta que correr.')
  const t0 = performance.now()
  let tabla: Tabla | null = null
  for (const s of lista) tabla = await con.query(s)
  const ms = performance.now() - t0
  const columnas = tabla!.schema.fields.map((f) => ({ nombre: f.name, tipo: String(f.type) }))
  return { columnas, filas: filasDe(tabla!, maximo), ms, total: tabla!.numRows, tabla: tabla! }
}

/** Compara lo que dio el navegador con la tabla publicada: mismas columnas, filas y valores (los números, con
 * tolerancia de redondeo). Devuelve null si coinciden, o lo primero que no calza. */
export function diferencia(obtenido: Fila[], publicada: Fila[]): string | null {
  if (obtenido.length !== publicada.length) return `${obtenido.length} filas en vez de ${publicada.length}`
  for (let i = 0; i < publicada.length; i++) {
    for (const [k, esperado] of Object.entries(publicada[i])) {
      const v = obtenido[i][k]
      if (esperado === null || v === null) {
        if (esperado !== v && !(esperado === null && Number.isNaN(v))) return `fila ${i + 1}, ${k}: ${v} en vez de ${esperado}`
        continue
      }
      const a = Number(v)
      const b = Number(esperado)
      if (typeof esperado === 'number' && !Number.isNaN(a)) {
        if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(b))) return `fila ${i + 1}, ${k}: ${v} en vez de ${esperado}`
      } else if (String(v) !== String(esperado)) return `fila ${i + 1}, ${k}: ${v} en vez de ${esperado}`
    }
  }
  return null
}
