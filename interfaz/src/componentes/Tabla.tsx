// Una tabla que se ordena tocando su encabezado. Los números van alineados a la derecha, con cifras tabulares.
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import type { Fila, Valor } from '../lib/datos'
import { celda } from '../lib/formato'
import { cn } from '../lib/utiles'

export interface Columna {
  clave: string
  titulo: string
  /** Cómo se muestra el valor; por omisión, con el formato chileno. */
  formato?: (v: Valor, fila: Fila) => ReactNode
  /** Una barra detrás del número, proporcional al máximo de la columna. */
  barra?: boolean
  ancho?: string
}

export function Tabla({
  filas,
  columnas,
  resaltar,
  maximo,
  etiqueta,
}: {
  filas: Fila[]
  columnas?: Columna[]
  resaltar?: (f: Fila) => boolean
  maximo?: number
  etiqueta: string
}) {
  const cols: Columna[] = columnas ?? Object.keys(filas[0] ?? {}).map((clave) => ({ clave, titulo: clave }))
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(null)
  const ordenadas = useMemo(() => {
    if (!orden) return filas
    return [...filas].sort((a, b) => {
      const x = a[orden.clave]
      const y = b[orden.clave]
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'es')
      return orden.asc ? r : -r
    })
  }, [filas, orden])
  const maximos = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of cols) if (c.barra) m[c.clave] = Math.max(...filas.map((f) => Math.abs(Number(f[c.clave]) || 0)))
    return m
  }, [filas, cols])
  const visibles = maximo ? ordenadas.slice(0, maximo) : ordenadas
  return (
    <div className="overflow-x-auto">
      <table className="cifras w-full border-collapse text-[13.5px]" aria-label={etiqueta}>
        <thead>
          <tr className="border-b">
            {cols.map((c) => {
              const numerica = filas.some((f) => typeof f[c.clave] === 'number')
              const activa = orden?.clave === c.clave
              return (
                <th
                  key={c.clave}
                  aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : undefined}
                  className={cn('px-3 py-2 align-bottom font-medium whitespace-nowrap text-tinta-suave', numerica ? 'text-right' : 'text-left', c.ancho)}
                >
                  <button
                    className="inline-flex items-center gap-1 hover:text-tinta"
                    onClick={() => setOrden(activa ? { clave: c.clave, asc: !orden.asc } : { clave: c.clave, asc: !numerica })}
                  >
                    {c.titulo}
                    {activa && (orden.asc ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visibles.map((f, i) => (
            <tr key={i} className={cn('border-b border-linea/70 last:border-0', resaltar?.(f) && 'bg-baya-tinte/70')}>
              {cols.map((c) => {
                const v = f[c.clave]
                const numerica = typeof v === 'number'
                return (
                  <td key={c.clave} className={cn('px-3 py-1.5 align-top', numerica ? 'text-right whitespace-nowrap' : 'text-left')}>
                    {c.barra && numerica ? (
                      <span className="relative block">
                        <span
                          aria-hidden
                          className="absolute inset-y-0.5 right-0 rounded-sm bg-dato/15"
                          style={{ width: `${(100 * Math.abs(v)) / (maximos[c.clave] || 1)}%` }}
                        />
                        <span className="relative">{c.formato ? c.formato(v, f) : celda(v)}</span>
                      </span>
                    ) : c.formato ? (
                      c.formato(v, f)
                    ) : (
                      celda(v)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {maximo && ordenadas.length > maximo && (
        <p className="px-3 pt-2 text-xs text-tinta-tenue">Se muestran {maximo} de {ordenadas.length.toLocaleString('es-CL')} filas.</p>
      )}
    </div>
  )
}
