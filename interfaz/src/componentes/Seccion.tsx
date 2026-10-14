// Una sección del informe: la pregunta, la respuesta en una oración y la figura, con su tabla y su SQL.
// «Correr en tu navegador» vuelve a correr la consulta con DuckDB y la compara con la tabla publicada.
import { BarChart3, Check, CircleAlert, Code2, Play, SquarePen, Table2 } from 'lucide-react'
import { lazy, type ReactNode, Suspense, useState } from 'react'
import { CONSULTAS, type Fila, type IdConsulta } from '../lib/datos'
import { comprobar, useComprobacion } from '../lib/comprobar'
import { useEstadoDuckDB } from '../lib/duckdb'
import { enteros, segundos } from '../lib/formato'
import { cn } from '../lib/utiles'
import { type Columna, Tabla } from './Tabla'
import { Boton } from './ui'

type Vista = 'grafico' | 'tabla' | 'sql'

// el editor (CodeMirror) se baja solo si alguien abre la pestaña SQL
const SqlVista = lazy(() => import('./EditorSql').then((m) => ({ default: m.SqlVista })))

export function Seccion({
  id,
  pregunta,
  respuesta,
  consulta,
  grafico,
  tabla,
  columnas,
  resaltar,
  notas,
  children,
}: {
  id: string
  pregunta: string
  respuesta: ReactNode
  consulta: IdConsulta
  grafico?: ReactNode
  /** Las filas de la tabla (por omisión, la tabla publicada de la consulta). */
  tabla?: Fila[]
  columnas?: Columna[]
  resaltar?: (f: Fila) => boolean
  notas?: ReactNode
  children?: ReactNode
}) {
  const c = CONSULTAS[consulta]
  const [vista, setVista] = useState<Vista>(grafico ? 'grafico' : 'tabla')
  const numero_ = c.archivo.slice(0, 2)
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6 border-t pt-10 pb-12 first:border-t-0">
      <p className="mb-2 font-mono text-[12px] text-tinta-tenue">{c.archivo}</p>
      <h2 id={`${id}-titulo`} className="max-w-[30ch] text-[1.65rem] leading-tight font-semibold tracking-tight">
        <span className="sr-only">{numero_}. </span>
        {pregunta}
      </h2>
      <div className="mt-3 max-w-[62ch] text-[1.07rem] leading-relaxed text-tinta-suave">{respuesta}</div>
      {children}
      <figure className="mt-6 overflow-hidden rounded-lg border bg-superficie">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex gap-1" role="tablist" aria-label="Qué mostrar">
            {grafico && <BotonVista activa={vista === 'grafico'} alElegir={() => setVista('grafico')} icono={BarChart3} texto="Gráfico" />}
            <BotonVista activa={vista === 'tabla'} alElegir={() => setVista('tabla')} icono={Table2} texto="Tabla" />
            <BotonVista activa={vista === 'sql'} alElegir={() => setVista('sql')} icono={Code2} texto="SQL" />
          </div>
          <Comprobar consulta={consulta} />
        </div>
        <div className="p-4 sm:p-5">
          {vista === 'grafico' && grafico}
          {vista === 'tabla' && <Tabla filas={tabla ?? c.publicada} columnas={columnas} resaltar={resaltar} etiqueta={pregunta} />}
          {vista === 'sql' && (
            <div className="space-y-3">
              <Suspense fallback={<pre className="max-h-[28rem] overflow-auto rounded-md bg-hundida/60 p-3 font-mono text-[13px]">{c.sql.trim()}</pre>}>
                <SqlVista codigo={c.sql} />
              </Suspense>
              <a href={`#consola?sql=${encodeURIComponent(c.sql.trim())}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-acento hover:underline">
                <SquarePen className="size-4" aria-hidden />
                Editarla en la consola
              </a>
            </div>
          )}
        </div>
        {notas && <figcaption className="border-t px-4 py-3 text-[13px] text-tinta-tenue sm:px-5">{notas}</figcaption>}
      </figure>
    </section>
  )
}

function BotonVista({ activa, alElegir, icono: Icono, texto }: { activa: boolean; alElegir: () => void; icono: typeof Play; texto: string }) {
  return (
    <button
      role="tab"
      aria-selected={activa}
      onClick={alElegir}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-tinta-suave hover:text-tinta',
        activa && 'bg-hundida font-medium text-tinta',
      )}
    >
      <Icono className="size-4" aria-hidden />
      {texto}
    </button>
  )
}

/** Corre la consulta en el navegador y dice si da lo mismo que la tabla publicada. */
function Comprobar({ consulta }: { consulta: IdConsulta }) {
  const c = useComprobacion(consulta)
  const duckdb = useEstadoDuckDB()
  const archivoPublicado = CONSULTAS[consulta].archivo.replace('.sql', '.csv')
  if (c.fase === 'lista')
    return (
      <p className={cn('flex items-center gap-1.5 text-[13px]', c.distinta ? 'text-baya' : 'text-acento')} role="status">
        {c.distinta ? <CircleAlert className="size-4 shrink-0" aria-hidden /> : <Check className="size-4 shrink-0" aria-hidden />}
        {c.distinta
          ? `Distinto a ${archivoPublicado}: ${c.distinta}`
          : `Corrió en ${segundos(c.ms)} en tu navegador: mismo resultado que ${archivoPublicado}`}
      </p>
    )
  if (c.fase === 'error')
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-baya" role="alert">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {c.mensaje}
      </p>
    )
  return (
    <Boton variante="contorno" tamano="sm" onClick={() => void comprobar(consulta)} disabled={c.fase === 'corriendo'}>
      <Play aria-hidden />
      {c.fase === 'corriendo'
        ? duckdb.fase === 'cargando'
          ? `${duckdb.paso}${duckdb.avance !== undefined ? ` ${Math.round(duckdb.avance * 100)} %` : ''}`
          : 'Corriendo'
        : 'Correr en tu navegador'}
    </Boton>
  )
}

export const filas = (n: number) => `${enteros(n)} ${n === 1 ? 'fila' : 'filas'}`
