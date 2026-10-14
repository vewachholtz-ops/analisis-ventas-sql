// La portada: qué es esto, el recibo de los dos años (lo que entra, lo que se resta y lo que queda) y el pulso de
// las ventas mes a mes. Desde el recibo se pueden correr las ocho consultas en el navegador y ver cómo se «imprimen».
import { Check, CircleAlert, Code2, Play, SquareTerminal, Upload } from 'lucide-react'
import { Grafico } from '../componentes/Grafico'
import { Boton, estiloBoton } from '../componentes/ui'
import { comprobarTodas, ORDEN, useComprobaciones, useCorriendoTodas } from '../lib/comprobar'
import { CONSULTAS, LIMPIEZA as L } from '../lib/datos'
import { useEstadoDuckDB } from '../lib/duckdb'
import { enteros, numero, segundos } from '../lib/formato'
import { cn } from '../lib/utiles'
import { pulso } from './graficos'

export const REPO = 'https://github.com/vewachholtz-ops/analisis-ventas-sql'

const fecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('-')
const libra = (n: number) => `£ ${numero(n, 0)}`

export function Portada() {
  return (
    <header id="caso-uci" className="scroll-mt-6 pt-2 pb-12">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
        <div className="pt-2 lg:pt-6">
          <h1 className="max-w-[17ch] text-[2.35rem] leading-[1.06] font-semibold tracking-[-0.025em] sm:text-[2.9rem]">
            Ventas de una tienda del Reino Unido
          </h1>
          <p className="mt-5 max-w-[56ch] text-[1.1rem] leading-relaxed text-tinta-suave">
            Un millón de líneas de ventas reales de una tienda británica, de diciembre de 2009 a diciembre de 2011. Ocho consultas
            responden ocho preguntas sobre el negocio, y todas se pueden correr y cambiar aquí mismo: la base de datos funciona dentro de
            tu navegador. También puedes subir tus propias ventas y ver las mismas respuestas con tus números.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href="#consola" className={estiloBoton('principal')}>
              <SquareTerminal aria-hidden />
              Abrir la consola SQL
            </a>
            <a href="#mis-ventas" className={estiloBoton('contorno')}>
              <Upload aria-hidden />
              Usar mis ventas
            </a>
            <a href={REPO} target="_blank" rel="noreferrer" className={estiloBoton('fantasma')}>
              <Code2 aria-hidden />
              Ver el código
            </a>
          </div>
        </div>
        <Recibo />
      </div>

      <figure className="mt-12">
        <Grafico
          dibujar={pulso}
          etiqueta="Ventas netas por mes, de diciembre de 2009 a diciembre de 2011: noviembre es el máximo de cada año, con cerca de 1,2 y 1,4 millones de libras"
        />
        <figcaption className="mt-3 max-w-[62ch] text-[13.5px] text-tinta-tenue">
          Ventas netas por mes. Noviembre es el mes más alto de cada año; diciembre de 2011 llega solo hasta el día 9.
        </figcaption>
      </figure>
    </header>
  )
}

function Fila({ izquierda, derecha, fuerte, resta }: { izquierda: string; derecha: string; fuerte?: boolean; resta?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', fuerte && 'font-bold text-tinta')}>
      <span>{izquierda}</span>
      <span className={cn('cifras', resta && 'text-baya')}>{derecha}</span>
    </div>
  )
}

const Corte = ({ doble }: { doble?: boolean }) => (
  <div aria-hidden className={cn('my-3 border-t border-dashed border-[var(--eje)]', doble && 'border-t-[3px] border-double')} />
)

/** El recibo de los dos años. Abajo, la comprobación de las ocho consultas. */
function Recibo() {
  return (
    <div className="mx-auto w-full max-w-[21rem] [filter:drop-shadow(0_1px_0_var(--linea))_drop-shadow(0_14px_22px_rgb(10_30_20/0.10))]">
      <div className="recibo bg-superficie px-6 pt-6 pb-9 font-mono text-[12.5px] leading-[1.75] text-tinta-suave" aria-label="Resumen de los dos años, como un recibo">
        <div className="text-center">
          <p className="text-[15px] font-bold tracking-[0.18em] text-tinta">MOSTRADOR</p>
          <p>Tienda de regalos online, Reino Unido</p>
          <p className="cifras">
            {fecha(L.desde)} al {fecha(L.hasta)}
          </p>
        </div>
        <Corte />
        <Fila izquierda="Líneas del Excel" derecha={enteros(L.lineas_originales)} />
        <Fila izquierda="Fuera por limpieza" derecha={`−${enteros(L.lineas_originales - L.lineas_validas)}`} resta />
        <Fila izquierda="Líneas de producto" derecha={enteros(L.lineas_validas)} />
        <Corte />
        <Fila izquierda="Ventas" derecha={libra(L.ventas_totales)} />
        <Fila izquierda="Cancelaciones" derecha={`−${libra(L.monto_cancelado)}`} resta />
        <Corte doble />
        <Fila izquierda="VENTA NETA" derecha={libra(L.ventas_netas)} fuerte />
        <div className="mt-3 text-tinta-tenue">
          <p className="cifras">{enteros(L.clientes)} clientes</p>
          <p className="cifras">{enteros(L.productos)} productos</p>
        </div>
        <Corte />
        <Comprobacion />
      </div>
    </div>
  )
}

function Comprobacion() {
  const estados = useComprobaciones()
  const corriendo = useCorriendoTodas()
  const duckdb = useEstadoDuckDB()
  const hechas = ORDEN.filter((id) => estados[id]?.fase === 'lista' || estados[id]?.fase === 'error')
  const iguales = ORDEN.filter((id) => {
    const e = estados[id]
    return e?.fase === 'lista' && !e.distinta
  })
  const mostradas = ORDEN.filter((id) => estados[id] && estados[id]!.fase !== 'nada')
  return (
    <div>
      {mostradas.length === 0 ? (
        <>
          <p className="mb-3 font-sans text-[13px] leading-snug text-tinta-suave">
            Los totales salen de <span className="font-mono">resultados/</span>. ¿Quieres ver que las consultas dan lo mismo?
          </p>
          <Boton variante="principal" tamano="sm" className="w-full justify-center font-sans" onClick={() => void comprobarTodas()}>
            <Play aria-hidden />
            Correr las 8 consultas aquí
          </Boton>
        </>
      ) : (
        <ol aria-label="Comprobación de las consultas" aria-live="polite">
          {mostradas.map((id) => {
            const e = estados[id]!
            return (
              <li key={id} className="imprimir flex justify-between gap-3">
                <span className="truncate">{CONSULTAS[id].archivo.replace('.sql', '')}</span>
                {e.fase === 'corriendo' ? (
                  <span className="text-tinta-tenue">…</span>
                ) : e.fase === 'lista' && !e.distinta ? (
                  <span className="cifras flex items-center gap-1 text-acento">
                    <Check className="size-3.5" aria-label="igual" />
                    {segundos(e.ms)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-baya" title={e.fase === 'error' ? e.mensaje : e.fase === 'lista' ? (e.distinta ?? '') : ''}>
                    <CircleAlert className="size-3.5" aria-hidden />
                    {e.fase === 'error' ? 'error' : 'distinto'}
                  </span>
                )}
              </li>
            )
          })}
          {corriendo && duckdb.fase === 'cargando' && (
            <li className="text-tinta-tenue">
              {duckdb.paso}
              {duckdb.avance !== undefined && ` ${Math.round(duckdb.avance * 100)} %`}
            </li>
          )}
          {!corriendo && hechas.length === ORDEN.length && (
            <li className="imprimir mt-2 font-bold text-tinta">
              {iguales.length === ORDEN.length ? '8 de 8 iguales a resultados/' : `${iguales.length} de 8 iguales a resultados/`}
            </li>
          )}
        </ol>
      )}
    </div>
  )
}
