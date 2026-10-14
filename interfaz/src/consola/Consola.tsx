// La consola: un editor de SQL sobre las mismas vistas del informe, con DuckDB corriendo en el navegador. Los datos
// no salen de la página: se bajan una vez y las consultas se resuelven en este computador.
import { csvFormat } from 'd3-dsv'
import { BarChart3, ChevronRight, CircleAlert, Download, Link2, Play, Table2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Editor } from '../componentes/EditorSql'
import { Grafico } from '../componentes/Grafico'
import { type Columna, Tabla } from '../componentes/Tabla'
import { Boton } from '../componentes/ui'
import { abrir, correr, filasDe, useEstadoDuckDB, useFuente } from '../lib/duckdb'
import { VISTAS } from '../lib/esquema'
import { enteros, segundos } from '../lib/formato'
import { cn } from '../lib/utiles'
import { EJEMPLOS } from './ejemplos'
import { dibujar, forma } from './graficoAuto'

const BORRADOR = 'mostrador.consulta'
const VISIBLES = 200
/** Columnas que son identificadores: se muestran tal cual, sin separador de miles. */
const IDENTIFICADORES = /^(cliente|factura|codigo|hora|ranking|r|f|m|anio|ano)$/i
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

type Salida = Awaited<ReturnType<typeof correr>>

function borrador(): string | null {
  try {
    return localStorage.getItem(BORRADOR)
  } catch {
    return null
  }
}

export function Consola({ sqlInicial }: { sqlInicial?: string }) {
  const [texto, setTexto] = useState(() => sqlInicial ?? borrador() ?? EJEMPLOS[0].sql)
  const [salida, setSalida] = useState<Salida | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  const [vista, setVista] = useState<'tabla' | 'grafico'>('tabla')
  const [copiado, setCopiado] = useState(false)
  const fuente = useFuente()

  // la consola es para correr SQL: DuckDB empieza a cargar apenas se abre
  useEffect(() => {
    abrir().catch(() => {})
  }, [])
  useEffect(() => {
    if (sqlInicial) setTexto(sqlInicial)
  }, [sqlInicial])
  useEffect(() => {
    try {
      localStorage.setItem(BORRADOR, texto)
    } catch {
      /* sin almacenamiento, no se guarda el borrador */
    }
  }, [texto])

  const ejecutar = useCallback(async () => {
    setCorriendo(true)
    setError(null)
    try {
      const r = await correr(texto, VISIBLES)
      setSalida(r)
      setVista((v) => (v === 'grafico' && !forma(r.columnas.map((c) => c.nombre), r.filas) ? 'tabla' : v))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCorriendo(false)
    }
  }, [texto])

  const compartir = async () => {
    const url = `${location.origin}${location.pathname}#consola?sql=${encodeURIComponent(texto.trim())}`
    history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2200)
    } catch {
      /* sin portapapeles: el enlace queda en la barra de direcciones */
    }
  }

  const descargar = () => {
    if (!salida) return
    const blob = new Blob([csvFormat(filasDe(salida.tabla))], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'consulta.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const columnas: Columna[] = useMemo(
    () =>
      (salida?.columnas ?? []).map((c) => ({
        clave: c.nombre,
        titulo: c.nombre,
        formato: IDENTIFICADORES.test(c.nombre) ? (v) => (v === null ? '—' : String(v)) : undefined,
      })),
    [salida],
  )
  const grafico = useMemo(() => (salida ? forma(salida.columnas.map((c) => c.nombre), salida.filas) : null), [salida])
  const dibujo = useCallback((ancho: number) => dibujar(grafico!, salida!.filas, ancho), [grafico, salida])

  return (
    <div className="pt-2 pb-16">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.02em]">Consola SQL</h1>
      <p className="mt-2 max-w-[62ch] text-[1.02rem] text-tinta-suave">
        Las mismas vistas que usa el informe, en DuckDB dentro de tu navegador: los datos se bajan una vez y las consultas no salen de
        este computador.
      </p>
      <EstadoCarga />
      {fuente.tipo === 'mios' && (
        <p className="mt-3 max-w-[62ch] rounded-md bg-acento-tinte px-3 py-2 text-[13.5px] text-tinta">
          Las vistas tienen tus datos ({fuente.config.archivo}): <span className="font-mono">crudo</span> es tu archivo tal cual, con todas las columnas como texto, y{' '}
          <span className="font-mono">lineas</span>, <span className="font-mono">ventas</span>, <span className="font-mono">cancelaciones</span> y{' '}
          <span className="font-mono">nombres</span> tienen las mismas columnas que en el ejemplo.
        </p>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_15.5rem]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Ejemplos">
            {EJEMPLOS.filter((e) => fuente.tipo === 'ejemplo' || !e.soloEjemplo).map((e) => (
              <button
                key={e.titulo}
                onClick={() => setTexto(e.sql)}
                className={cn(
                  'h-8 rounded-full border px-3 text-[13px] text-tinta-suave transition-colors hover:border-acento hover:text-tinta',
                  texto === e.sql && 'border-acento bg-acento-tinte font-medium text-tinta',
                )}
              >
                {e.titulo}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border bg-superficie">
            <Editor valor={texto} alCambiar={setTexto} alCorrer={() => void ejecutar()} />
            <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <Boton variante="principal" tamano="sm" onClick={() => void ejecutar()} disabled={corriendo || !texto.trim()}>
                <Play aria-hidden />
                {corriendo ? 'Corriendo' : 'Correr'}
              </Boton>
              <span className="text-[12.5px] text-tinta-tenue">
                o <kbd className="font-sans">{MAC ? '⌘' : 'Ctrl'}</kbd> + <kbd className="font-sans">Enter</kbd>
              </span>
              <Boton variante="fantasma" tamano="sm" className="ml-auto" onClick={() => void compartir()}>
                <Link2 aria-hidden />
                {copiado ? 'Enlace copiado' : 'Copiar enlace'}
              </Boton>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-baya/40 bg-baya-tinte px-4 py-3">
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-baya">
                <CircleAlert className="size-4" aria-hidden />
                DuckDB no pudo correr la consulta
              </p>
              <pre className="mt-2 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-tinta">{error}</pre>
            </div>
          )}

          {salida && !error && (
            <section aria-label="Resultado" className="mt-4 overflow-hidden rounded-lg border bg-superficie">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <p className="mr-auto text-[13px] text-tinta-suave" role="status">
                  {salida.columnas.length === 0
                    ? `Listo en ${segundos(salida.ms)}`
                    : `${enteros(salida.total)} ${salida.total === 1 ? 'fila' : 'filas'} en ${segundos(salida.ms)}`}
                </p>
                {grafico && (
                  <div className="flex gap-1" role="tablist" aria-label="Qué mostrar">
                    <Pestana activa={vista === 'tabla'} alElegir={() => setVista('tabla')} icono={Table2} texto="Tabla" />
                    <Pestana activa={vista === 'grafico'} alElegir={() => setVista('grafico')} icono={BarChart3} texto="Gráfico" />
                  </div>
                )}
                {salida.total > 0 && (
                  <Boton variante="fantasma" tamano="sm" onClick={descargar}>
                    <Download aria-hidden />
                    CSV
                  </Boton>
                )}
              </div>
              <div className="p-3 sm:p-4">
                {salida.total === 0 ? (
                  <p className="py-6 text-center text-[14px] text-tinta-tenue">La consulta no devolvió filas.</p>
                ) : vista === 'grafico' && grafico ? (
                  <>
                    <p className="mb-2 text-[13px] text-tinta-suave">
                      <span className="font-mono">{grafico.y}</span> según <span className="font-mono">{grafico.x}</span>
                    </p>
                    <Grafico key={salida.ms} dibujar={dibujo} etiqueta={`${grafico.y} según ${grafico.x}`} />
                  </>
                ) : (
                  <div className="max-h-[32rem] overflow-auto">
                    <Tabla filas={salida.filas} columnas={columnas} etiqueta="Resultado de la consulta" />
                  </div>
                )}
                {salida.total > VISIBLES && vista === 'tabla' && (
                  <p className="mt-3 text-[13px] text-tinta-tenue">
                    Se ven las primeras {enteros(VISIBLES)} de {enteros(salida.total)} filas; el CSV las trae todas.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="vistas-titulo" className="xl:pt-11">
          <h2 id="vistas-titulo" className="text-[15px] font-semibold">
            Vistas
          </h2>
          <p className="mt-1 mb-3 text-[13px] text-tinta-tenue">Toca una para ver sus columnas.</p>
          <ul className="space-y-1">
            {VISTAS.map((v) => (
              <li key={v.nombre}>
                <details className="group rounded-md">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-hundida [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-3.5 text-tinta-tenue transition-transform group-open:rotate-90" aria-hidden />
                    <span className="font-mono text-[13px] font-medium text-tinta">{v.nombre}</span>
                  </summary>
                  <div className="pt-1 pb-2 pl-7">
                    <p className="mb-2 text-[12.5px] leading-snug text-tinta-suave">{v.descripcion}</p>
                    <ul className="font-mono text-[12px] leading-relaxed">
                      {v.columnas.map(([c, t]) => (
                        <li key={c} className="flex justify-between gap-2">
                          <span className="text-tinta">{c}</span>
                          <span className="text-tinta-tenue">{t.toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function EstadoCarga() {
  const e = useEstadoDuckDB()
  if (e.fase === 'lista') return null
  if (e.fase === 'error')
    return (
      <p role="alert" className="mt-4 flex items-center gap-2 text-[13.5px] text-baya">
        <CircleAlert className="size-4" aria-hidden />
        No pude cargar DuckDB: {e.mensaje}
      </p>
    )
  if (e.fase === 'sin-cargar') return null
  return (
    <div className="mt-4 max-w-sm" role="status">
      <p className="text-[13px] text-tinta-suave">
        {e.paso}
        {e.avance !== undefined && ` (${Math.round(e.avance * 100)} % de 5,9 MB)`}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hundida">
        <div
          className={cn('h-full rounded-full bg-acento transition-[width]', e.avance === undefined && 'w-1/3 animate-pulse')}
          style={e.avance !== undefined ? { width: `${Math.max(4, e.avance * 100)}%` } : undefined}
        />
      </div>
    </div>
  )
}

function Pestana({ activa, alElegir, icono: Icono, texto }: { activa: boolean; alElegir: () => void; icono: typeof Play; texto: string }) {
  return (
    <button
      role="tab"
      aria-selected={activa}
      onClick={alElegir}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-tinta-suave hover:text-tinta', activa && 'bg-hundida font-medium text-tinta')}
    >
      <Icono className="size-4" aria-hidden />
      {texto}
    </button>
  )
}

