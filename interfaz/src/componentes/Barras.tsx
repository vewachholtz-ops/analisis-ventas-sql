// Barras horizontales en HTML para cuando las etiquetas son largas (nombres de productos): el nombre arriba, la
// barra abajo con su valor en la punta. Una fila puede ir destacada; el detalle de cada fila queda a la vista.
import type { ReactNode } from 'react'
import { cn } from '../lib/utiles'

export interface Barra {
  clave: string
  etiqueta: ReactNode
  valor: number
  texto: string
  detalle?: ReactNode
  destacada?: boolean
  /** baya en vez de verde: para lo que resta (cancelaciones). */
  resta?: boolean
}

export function Barras({ filas, etiqueta, maximo }: { filas: Barra[]; etiqueta: string; maximo?: number }) {
  const tope = maximo ?? Math.max(...filas.map((f) => f.valor))
  return (
    <ol className="space-y-3" aria-label={etiqueta}>
      {filas.map((f) => (
        <li key={f.clave} className="grid gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
            <span className={cn('min-w-0', f.destacada ? 'font-semibold text-tinta' : 'text-tinta-suave')}>{f.etiqueta}</span>
            {f.detalle && <span className="text-xs text-tinta-tenue">{f.detalle}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3.5 min-w-0 flex-1">
              <div
                className={cn('h-full rounded-r-[4px]', f.resta ? 'bg-baya' : f.destacada ? 'bg-dato' : 'bg-[var(--contexto)]')}
                style={{ width: `${Math.max(0.6, (100 * f.valor) / tope)}%` }}
              />
            </div>
            <span className={cn('w-24 shrink-0 text-right text-[13px]', f.destacada || f.resta ? 'font-semibold text-tinta' : 'text-tinta-suave')}>{f.texto}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
