// «Usar mis ventas»: subir un archivo propio, decir qué es cada columna y ver el informe con esos números. Todo pasa en
// el navegador: DuckDB lee el archivo desde el disco y no se envía a ningún lado.
import { CircleAlert, FileSpreadsheet, LoaderCircle, Play, RotateCcw, SquareTerminal, Upload } from 'lucide-react'
import { type DragEvent, type ReactNode, useRef, useState } from 'react'
import { Boton, estiloBoton } from '../componentes/ui'
import { type ArchivoLeido, cargarArchivo, useEstadoDuckDB, usarFuente } from '../lib/duckdb'
import { enteros, mes, segundos } from '../lib/formato'
import { cn } from '../lib/utiles'
import { type Analisis, analizar } from './analisis'
import { adivinar, CAMPOS, type Decimal, detectarDecimal, detectarFecha, type FormatoFecha, faltantes, type Mapeo } from './campos'
import { InformeMio } from './InformeMio'
import type { Config, Devoluciones } from './sql'

const MONEDAS = ['$', 'US$', '€', '£', '']

export function MisVentas() {
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null)
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [fecha, setFecha] = useState<FormatoFecha>('dmy')
  const [decimal, setDecimal] = useState<Decimal>('coma')
  const [devoluciones, setDevoluciones] = useState<Devoluciones>({ tipo: 'negativas' })
  const [moneda, setMoneda] = useState('$')
  const [paso, setPaso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analisis, setAnalisis] = useState<{ a: Analisis; moneda: string } | null>(null)
  const duckdb = useEstadoDuckDB()
  const informe = useRef<HTMLDivElement>(null)

  const leer = async (f: File) => {
    setError(null)
    setAnalisis(null)
    setPaso('Leyendo el archivo')
    try {
      const leido = await cargarArchivo(f)
      const m = adivinar(leido.columnas, leido.muestra)
      setArchivo(leido)
      setMapeo(m)
      if (m.fecha) setFecha(detectarFecha(leido.muestra.map((x) => x[m.fecha!])))
      const numeros = [m.precio, m.monto, m.cantidad].filter(Boolean).flatMap((c) => leido.muestra.map((x) => x[c!]))
      setDecimal(detectarDecimal(numeros))
      const cantidades = m.cantidad ? leido.muestra.map((x) => x[m.cantidad!] ?? '') : []
      setDevoluciones(cantidades.some((c) => /^\s*-/.test(c)) ? { tipo: 'negativas' } : { tipo: 'ninguna' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPaso(null)
    }
  }

  const probarEjemplo = async () => {
    setPaso('Bajando el archivo de ejemplo')
    const r = await fetch(new URL('datos/ventas-ejemplo.csv', location.href))
    await leer(new File([await r.blob()], 'ventas-papeleria-inventada.csv', { type: 'text/csv' }))
  }

  const correr = async () => {
    if (!archivo) return
    setError(null)
    const config: Config = { archivo: archivo.nombre, mapeo, fecha, decimal, devoluciones, moneda }
    try {
      const a = await analizar(config, setPaso)
      setAnalisis({ a, moneda })
      requestAnimationFrame(() => informe.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (e) {
      setError((e as Error).message.split('\n')[0])
    } finally {
      setPaso(null)
    }
  }

  const faltan = faltantes(mapeo)
  const ocupado = paso !== null

  return (
    <div className="pt-2 pb-16">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.02em]">Usar mis ventas</h1>
      <p className="mt-2 max-w-[62ch] text-[1.02rem] text-tinta-suave">
        Sube un archivo de ventas y Mostrador hace los mismos ocho análisis con tus números. El archivo no sale de tu computador: DuckDB lo lee aquí,
        en el navegador.
      </p>

      <Paso numero={1} titulo="Tu archivo">
        {archivo ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-superficie px-4 py-3">
            <FileSpreadsheet className="size-5 text-acento" aria-hidden />
            <p className="mr-auto text-[14px]">
              <span className="font-medium">{archivo.nombre}</span>
              <span className="text-tinta-tenue">
                {' '}
                {archivo.hoja ? `(hoja «${archivo.hoja}») ` : ''}
                {enteros(archivo.filas)} filas, {archivo.columnas.length} columnas
              </span>
            </p>
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => {
                setArchivo(null)
                setAnalisis(null)
              }}
            >
              Cambiar archivo
            </Boton>
          </div>
        ) : (
          <Zona alElegir={(f) => void leer(f)} ocupado={ocupado} paso={paso ?? (duckdb.fase === 'cargando' ? duckdb.paso : null)} alProbar={() => void probarEjemplo()} />
        )}
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-[14px] text-baya">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </Paso>

      {archivo && (
        <Paso numero={2} titulo="Qué es cada columna">
          <p className="-mt-1 mb-4 max-w-[62ch] text-[14px] text-tinta-suave">Las adiviné por los encabezados; revísalas. Una fila del archivo debe ser una línea de venta: un producto de una compra.</p>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="space-y-3">
              {CAMPOS.map((d) => (
                <label key={d.campo} className="block">
                  <span className="flex items-baseline justify-between gap-2 text-[13.5px] font-medium">
                    {d.nombre}
                    <span className="text-[12px] font-normal text-tinta-tenue">{d.obligatorio === true ? 'obligatoria' : d.obligatorio ? 'una de dos' : 'opcional'}</span>
                  </span>
                  <select
                    value={mapeo[d.campo] ?? ''}
                    onChange={(e) => setMapeo((m) => ({ ...m, [d.campo]: e.target.value || undefined }))}
                    className="mt-1 h-9 w-full rounded-md border bg-superficie px-2 text-[14px]"
                  >
                    <option value="">— no está —</option>
                    {archivo.columnas.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span className="mt-0.5 block text-[12px] text-tinta-tenue">{d.ayuda}</span>
                </label>
              ))}
            </div>
            <div className="min-w-0 space-y-5">
              <Vistazo archivo={archivo} mapeo={mapeo} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Opcion titulo="Fechas" ejemplo={mapeo.fecha ? ejemploFecha(archivo.muestra[0]?.[mapeo.fecha], fecha) : undefined}>
                  <select value={fecha} onChange={(e) => setFecha(e.target.value as FormatoFecha)} className="h-9 w-full rounded-md border bg-superficie px-2 text-[14px]">
                    <option value="dmy">día-mes-año (31-12-2024)</option>
                    <option value="mdy">mes-día-año (12/31/2024)</option>
                    <option value="ymd">año-mes-día (2024-12-31)</option>
                  </select>
                </Opcion>
                <Opcion titulo="Números" ejemplo={ejemploNumero(archivo.muestra[0]?.[mapeo.precio ?? mapeo.monto ?? ''], decimal)}>
                  <select value={decimal} onChange={(e) => setDecimal(e.target.value as Decimal)} className="h-9 w-full rounded-md border bg-superficie px-2 text-[14px]">
                    <option value="coma">1.234,56 (punto de miles, coma decimal)</option>
                    <option value="punto">1,234.56 (coma de miles, punto decimal)</option>
                  </select>
                </Opcion>
                <Opcion titulo="Devoluciones">
                  <select
                    value={devoluciones.tipo}
                    onChange={(e) =>
                      setDevoluciones(e.target.value === 'prefijo' ? { tipo: 'prefijo', prefijo: 'C' } : { tipo: e.target.value as 'negativas' | 'ninguna' })
                    }
                    className="h-9 w-full rounded-md border bg-superficie px-2 text-[14px]"
                  >
                    <option value="negativas">Vienen con cantidad negativa</option>
                    <option value="prefijo">Su factura empieza con una letra</option>
                    <option value="ninguna">No hay devoluciones</option>
                  </select>
                  {devoluciones.tipo === 'prefijo' && (
                    <label className="mt-2 flex items-center gap-2 text-[13px] text-tinta-suave">
                      Letra o prefijo
                      <input
                        value={devoluciones.prefijo}
                        onChange={(e) => setDevoluciones({ tipo: 'prefijo', prefijo: e.target.value })}
                        className="h-8 w-20 rounded-md border bg-superficie px-2 font-mono text-[13px]"
                      />
                    </label>
                  )}
                </Opcion>
                <Opcion titulo="Moneda">
                  <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="h-9 w-full rounded-md border bg-superficie px-2 text-[14px]">
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>
                        {m || 'sin símbolo'}
                      </option>
                    ))}
                  </select>
                </Opcion>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Boton variante="principal" onClick={() => void correr()} disabled={faltan.length > 0 || ocupado}>
              {ocupado ? <LoaderCircle className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {ocupado ? paso : analisis ? 'Volver a analizar' : 'Analizar mis ventas'}
            </Boton>
            {faltan.length > 0 && <p className="text-[13.5px] text-baya">Falta elegir {faltan.join(', ')}.</p>}
          </div>
        </Paso>
      )}

      {analisis && (
        <div ref={informe} className="scroll-mt-20">
          <Paso numero={3} titulo="Tu informe">
            <Resumen a={analisis.a} archivo={archivo?.nombre ?? ''} />
          </Paso>
          <InformeMio a={analisis.a} moneda={analisis.moneda} />
        </div>
      )}
    </div>
  )
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`paso-${numero}`} className="mt-9">
      <h2 id={`paso-${numero}`} className="mb-3 flex items-baseline gap-3 text-[1.2rem] font-semibold">
        <span className="font-mono text-[13px] text-tinta-tenue">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Zona({ alElegir, alProbar, ocupado, paso }: { alElegir: (f: File) => void; alProbar: () => void; ocupado: boolean; paso: string | null }) {
  const [encima, setEncima] = useState(false)
  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setEncima(false)
    const f = e.dataTransfer.files[0]
    if (f) alElegir(f)
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      className={cn('rounded-lg border-2 border-dashed bg-superficie px-5 py-8 text-center transition-colors', encima ? 'border-acento bg-acento-tinte/40' : 'border-[var(--eje)]')}
    >
      {ocupado ? (
        <p className="flex items-center justify-center gap-2 text-[14.5px] text-tinta-suave" role="status">
          <LoaderCircle className="size-5 animate-spin text-acento" aria-hidden />
          {paso ?? 'Un momento'}
        </p>
      ) : (
        <>
          <Upload className="mx-auto size-7 text-tinta-tenue" aria-hidden />
          <p className="mt-2 text-[15px]">
            Suelta aquí tu archivo o{' '}
            <label className="cursor-pointer font-medium text-acento hover:underline">
              elígelo
              <input
                type="file"
                accept=".csv,.txt,.tsv,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) alElegir(f)
                  e.target.value = ''
                }}
              />
            </label>
          </p>
          <p className="mt-1 text-[13px] text-tinta-tenue">CSV o Excel (.xlsx), con una fila por línea de venta y los nombres de las columnas en la primera fila.</p>
          <button onClick={alProbar} className="mt-4 text-[13.5px] text-tinta-suave underline decoration-[var(--eje)] underline-offset-2 hover:text-tinta">
            ¿No tienes uno a mano? Prueba con las ventas inventadas de una papelería
          </button>
        </>
      )}
    </div>
  )
}

/** Las primeras filas del archivo, con el campo elegido bajo cada encabezado. */
function Vistazo({ archivo, mapeo }: { archivo: ArchivoLeido; mapeo: Mapeo }) {
  const campoDe = new Map(Object.entries(mapeo).map(([campo, columna]) => [columna, CAMPOS.find((c) => c.campo === campo)!.nombre]))
  return (
    <div className="overflow-x-auto rounded-lg border bg-superficie">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b">
            {archivo.columnas.map((c) => (
              <th key={c} className="px-3 py-2 text-left align-bottom font-medium whitespace-nowrap">
                {c}
                <span className={cn('block text-[11.5px] font-normal', campoDe.has(c) ? 'text-acento' : 'text-tinta-tenue')}>{campoDe.get(c) ?? 'no se usa'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {archivo.muestra.slice(0, 6).map((f, i) => (
            <tr key={i} className="border-b last:border-b-0">
              {archivo.columnas.map((c) => (
                <td key={c} className={cn('px-3 py-1.5 whitespace-nowrap', !campoDe.has(c) && 'text-tinta-tenue')}>
                  {f[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Opcion({ titulo, ejemplo, children }: { titulo: string; ejemplo?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13.5px] font-medium">{titulo}</p>
      {children}
      {ejemplo && <p className="mt-1 text-[12px] text-tinta-tenue">{ejemplo}</p>}
    </div>
  )
}

/** «02-01-2023 12:01 → 2 de enero de 2023», para ver si el formato elegido lee bien la primera fecha. */
function ejemploFecha(valor: string | null | undefined, f: FormatoFecha) {
  if (!valor) return undefined
  const m = valor.trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/)
  if (!m) return `${valor} → no parece una fecha`
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [dia, mesN, anio] = f === 'dmy' ? [a, b, c] : f === 'mdy' ? [b, a, c] : [c, b, a]
  const anioCompleto = anio < 100 ? 2000 + anio : anio
  if (mesN < 1 || mesN > 12 || dia < 1 || dia > 31) return `${valor} → no calza con este formato`
  return `${valor} → ${dia} de ${mes(`${anioCompleto}-${String(mesN).padStart(2, '0')}-01`, true).replace(' ', ' de ')}`
}

function ejemploNumero(valor: string | null | undefined, d: Decimal) {
  if (!valor) return undefined
  const limpio = valor.replace(/[^0-9,.-]/g, '')
  const n = Number(d === 'coma' ? limpio.replaceAll('.', '').replace(',', '.') : limpio.replaceAll(',', ''))
  // sin separador de miles, para que se vea qué número quedó: «1.490 → 1490», «2.55 → 2,55»
  return Number.isFinite(n) ? `${valor} → ${String(n).replace('.', ',')}` : `${valor} → no se entiende como número`
}

function Resumen({ a, archivo }: { a: Analisis; archivo: string }) {
  const fuente = { desde: String(a.limpieza.desde).slice(0, 10), hasta: String(a.limpieza.hasta).slice(0, 10) }
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-superficie px-4 py-3 text-[14px]">
      <p className="mr-auto">
        <span className="font-medium">{archivo}</span>
        <span className="text-tinta-tenue">
          {' '}
          del {fuente.desde.split('-').reverse().join('-')} al {fuente.hasta.split('-').reverse().join('-')}, analizado en {segundos(a.ms)}
        </span>
      </p>
      <a href="#consola" className={estiloBoton('contorno', 'sm')}>
        <SquareTerminal aria-hidden />
        Abrir la consola con tus datos
      </a>
      <Boton
        variante="fantasma"
        tamano="sm"
        onClick={() => {
          void usarFuente({ tipo: 'ejemplo' })
          location.hash = '#inicio'
        }}
      >
        <RotateCcw aria-hidden />
        Volver a la tienda de ejemplo
      </Boton>
    </div>
  )
}
