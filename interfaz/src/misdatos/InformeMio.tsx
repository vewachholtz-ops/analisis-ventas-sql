// El informe con los datos de quien usa la página: las mismas ocho preguntas, con la respuesta escrita a partir de
// sus números, el gráfico, la tabla y la consulta tal como se corrió. Las secciones que necesitan una columna que el
// archivo no tiene (cliente, país) lo dicen en vez de mostrar algo vacío.
import { BarChart3, Code2, Table2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Barras } from '../componentes/Barras'
import { SqlVista } from '../componentes/EditorSql'
import { Grafico } from '../componentes/Grafico'
import { type Columna, Tabla } from '../componentes/Tabla'
import type { Fila } from '../lib/datos'
import { dinero, enteros, mes, NB, numero, pct } from '../lib/formato'
import { cn } from '../lib/utiles'
import type { Analisis } from './analisis'
import { cohortes, lugares, mensual, pareto, rfm } from './graficos'

const n = (v: unknown) => Number(v)
const s = (v: unknown) => String(v)

export function InformeMio({ a, moneda }: { a: Analisis; moneda: string }) {
  const $ = (v: number, compacto = true) => dinero(v, moneda, compacto ? {} : { decimales: moneda === '$' ? 0 : 2 })
  const L = a.limpieza
  const periodo = `entre ${mes(a.periodo.desde, true)} y ${mes(mesAnterior(a.periodo.hasta), true)}`
  const meses = a.mensual.filter((m) => m.mes_parcial !== true)
  const tieneClientes = n(L.clientes) > 0
  const tienePais = !(a.paises.length === 1 && a.paises[0].pais === 'Sin dato')

  return (
    <div>
      <SeccionMia
        id="mi-limpieza"
        archivo="00_limpieza.sql"
        pregunta="Antes de sumar: qué líneas cuentan"
        respuesta={
          <>
            Tu archivo trae {enteros(n(L.lineas_originales))} líneas y {enteros(n(L.lineas_validas))} son líneas de producto válidas
            {n(L.lineas_canceladas) > 0 && (
              <>
                ; {n(L.lineas_canceladas) === 1 ? 'una de ellas es una devolución, que se resta' : `${enteros(n(L.lineas_canceladas))} de ellas son devoluciones, que se restan`}
              </>
            )}
            . La venta neta es {$(n(L.ventas_netas))}
            {n(L.monto_cancelado) > 0 && <> después de descontar {$(n(L.monto_cancelado))} devueltos</>}.
          </>
        }
        grafico={
          <Barras
            etiqueta="Líneas del archivo y lo que queda"
            filas={[
              { clave: 'o', etiqueta: 'Líneas en el archivo', valor: n(L.lineas_originales), texto: enteros(n(L.lineas_originales)) },
              { clave: 'v', etiqueta: 'Líneas válidas', valor: n(L.lineas_validas), texto: enteros(n(L.lineas_validas)), destacada: true },
              { clave: 'd', etiqueta: 'de ellas, ventas', valor: n(L.lineas_de_venta), texto: enteros(n(L.lineas_de_venta)) },
              { clave: 'c', etiqueta: 'de ellas, devoluciones (restan)', valor: n(L.lineas_canceladas), texto: enteros(n(L.lineas_canceladas)), resta: true },
            ]}
          />
        }
        filas={[L]}
        sql={a.sql.limpieza}
      >
        {a.fuera.length > 0 && (
          <p className="mt-4 max-w-[62ch] text-[14px] text-tinta-suave">
            {a.fuera.reduce((t, f) => t + n(f.lineas), 0) === 1 ? 'Quedó' : 'Quedaron'} fuera{' '}
            {a.fuera.map((f, i) => `${i ? (i === a.fuera.length - 1 ? ' y ' : ', ') : ''}${enteros(n(f.lineas))} ${n(f.lineas) === 1 ? 'línea' : 'líneas'} ${f.motivo}`).join('')}.
            Si son muchas, revisa las columnas o el formato de fecha y números.
          </p>
        )}
      </SeccionMia>

      <SeccionMia
        id="mi-ventas"
        archivo="01_ventas_mensuales.sql"
        pregunta={meses.length >= 24 ? '¿Creció el negocio?' : '¿Cómo van las ventas mes a mes?'}
        respuesta={frasesMensual(meses, $)}
        grafico={<Grafico dibujar={(w) => mensual(w, a.mensual, moneda)} etiqueta="Ventas netas por mes" />}
        filas={a.mensual}
        columnas={[
          { clave: 'mes', titulo: 'Mes', formato: (v) => mes(s(v)) },
          { clave: 'ventas_netas', titulo: 'Ventas netas', formato: (v) => $(n(v), false), barra: true },
          { clave: 'canceladas', titulo: 'Devuelto', formato: (v) => $(n(v), false) },
          { clave: 'pedidos', titulo: 'Pedidos' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'ticket_promedio', titulo: 'Ticket', formato: (v) => $(n(v), false) },
          { clave: 'variacion_anual_pct', titulo: 'vs. año anterior', formato: (v) => (v === null ? '—' : `${n(v) > 0 ? '+' : ''}${numero(n(v), 1)}${NB}%`) },
        ]}
        sql={a.sql.mensual}
      />

      <SeccionMia
        id="mi-productos"
        archivo="02_abc_productos.sql"
        pregunta="¿Cuántos productos importan?"
        respuesta={frasesAbc(a.abc, periodo)}
        grafico={<Grafico dibujar={(w) => pareto(w, a.curva, a.abc)} etiqueta="Curva ABC de tus productos" />}
        filas={a.abc}
        columnas={[
          { clave: 'clase', titulo: 'Clase' },
          { clave: 'productos', titulo: 'Productos' },
          { clave: 'pct_productos', titulo: '% productos', formato: (v) => pct(n(v)) },
          { clave: 'ventas', titulo: 'Ventas', formato: (v) => $(n(v), false), barra: true },
          { clave: 'pct_ventas', titulo: '% ventas', formato: (v) => pct(n(v)) },
        ]}
        sql={a.sql.abc}
        notas={`El último año completo de tu archivo: ${periodo}.`}
      />

      <SeccionMia
        id="mi-clientes"
        archivo="03_rfm_clientes.sql"
        pregunta="¿Quiénes sostienen las ventas?"
        respuesta={tieneClientes ? frasesRfm(a.rfm) : 'Para segmentar a los clientes hace falta la columna de cliente, y tu archivo no la tiene (o no la elegiste).'}
        grafico={tieneClientes && a.rfm.length ? <Grafico dibujar={(w) => rfm(w, a.rfm)} etiqueta="Clientes y ventas por segmento" /> : undefined}
        filas={a.rfm}
        columnas={[
          { clave: 'segmento', titulo: 'Segmento' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'pct_clientes', titulo: '% clientes', formato: (v) => pct(n(v)) },
          { clave: 'pct_ventas', titulo: '% ventas', formato: (v) => pct(n(v)), barra: true },
          { clave: 'recencia_mediana_dias', titulo: 'Días desde la última compra' },
          { clave: 'pedidos_promedio', titulo: 'Pedidos', formato: (v) => numero(n(v), 1) },
          { clave: 'monto_promedio', titulo: 'Monto promedio', formato: (v) => $(n(v), false) },
        ]}
        sql={a.sql.rfm}
        omitir={!tieneClientes}
      />

      <SeccionMia
        id="mi-retencion"
        archivo="04_cohortes.sql"
        pregunta="¿Vuelven los clientes nuevos?"
        respuesta={tieneClientes ? frasesCohortes(a.cohortes) : 'Para medir si vuelven hace falta la columna de cliente.'}
        grafico={tieneClientes && a.cohortes.length ? <Grafico dibujar={(w) => cohortes(w, a.cohortes)} etiqueta="Retención por cohorte" /> : undefined}
        filas={a.cohortes}
        columnas={[
          { clave: 'cohorte', titulo: 'Cohorte', formato: (v) => mes(s(v)) },
          { clave: 'meses_desde', titulo: 'Meses después' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'retencion_pct', titulo: 'Retención', formato: (v) => pct(n(v)), barra: true },
        ]}
        sql={a.sql.cohortes}
        omitir={!tieneClientes}
      />

      <SeccionMia
        id="mi-devoluciones"
        archivo="05_devoluciones.sql"
        pregunta="¿Qué se devuelve?"
        respuesta={frasesDevoluciones(a.devoluciones, $)}
        grafico={
          a.devoluciones.length ? (
            <Barras
              etiqueta="Los productos con más monto devuelto"
              filas={a.devoluciones.slice(0, 8).map((d, i) => ({
                clave: s(d.codigo),
                etiqueta: s(d.descripcion ?? d.codigo),
                valor: n(d.monto_cancelado),
                texto: $(n(d.monto_cancelado), false),
                resta: i === 0,
                detalle: `${pct(n(d.cancelado_sobre_ventas_pct))} de lo vendido`,
              }))}
            />
          ) : undefined
        }
        filas={a.devoluciones}
        columnas={[
          { clave: 'codigo', titulo: 'Código' },
          { clave: 'descripcion', titulo: 'Producto' },
          { clave: 'monto_cancelado', titulo: 'Devuelto', formato: (v) => $(n(v), false), barra: true },
          { clave: 'facturas_cancelacion', titulo: 'Documentos' },
          { clave: 'ventas', titulo: 'Ventas', formato: (v) => $(n(v), false) },
          { clave: 'cancelado_sobre_ventas_pct', titulo: '% devuelto', formato: (v) => pct(n(v)) },
        ]}
        sql={a.sql.devoluciones}
      />

      <SeccionMia
        id="mi-lugares"
        archivo="06_paises.sql"
        pregunta="¿Dónde se vende?"
        respuesta={
          tienePais && a.paises.length
            ? `${s(a.paises[0].pais)} hace el ${pct(n(a.paises[0].pct_ventas))} de las ventas ${periodo}${a.paises[1] && a.paises[1].pais !== 'Otros' ? `; le sigue ${s(a.paises[1].pais)}, con el ${pct(n(a.paises[1].pct_ventas))}` : ''}.`
            : 'Para ver dónde se vende hace falta una columna de país, región, comuna o sucursal.'
        }
        grafico={tienePais && a.paises.length ? <Grafico dibujar={(w) => lugares(w, a.paises, moneda)} etiqueta="Ventas por lugar" /> : undefined}
        filas={a.paises}
        columnas={[
          { clave: 'pais', titulo: 'Lugar' },
          { clave: 'ventas_netas', titulo: 'Ventas netas', formato: (v) => $(n(v), false), barra: true },
          { clave: 'pct_ventas', titulo: '% ventas', formato: (v) => pct(n(v)) },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'ticket_promedio', titulo: 'Ticket promedio', formato: (v) => $(n(v), false) },
        ]}
        sql={a.sql.paises}
        omitir={!tienePais}
      />

      <SeccionMia
        id="mi-canasta"
        archivo="07_canasta.sql"
        pregunta="¿Qué se compra junto?"
        respuesta={
          a.canasta.length
            ? `${s(a.canasta[0].producto_a)} y ${s(a.canasta[0].producto_b)} aparecen juntos en una compra ${numero(n(a.canasta[0].lift), 1)} veces más que si se eligieran al azar.`
            : 'No hay pares de productos que aparezcan juntos en suficientes compras como para medirlo.'
        }
        grafico={
          a.canasta.length ? (
            <Barras
              etiqueta="Pares de productos que se compran juntos, por lift"
              filas={a.canasta.slice(0, 8).map((d, i) => ({
                clave: `${s(d.producto_a)}-${s(d.producto_b)}`,
                etiqueta: `${s(d.producto_a)} + ${s(d.producto_b)}`,
                valor: n(d.lift),
                texto: `${numero(n(d.lift), 1)} veces`,
                destacada: i === 0,
                detalle: `${enteros(n(d.pedidos_juntos))} compras juntos`,
              }))}
            />
          ) : undefined
        }
        filas={a.canasta}
        columnas={[
          { clave: 'producto_a', titulo: 'Producto A' },
          { clave: 'producto_b', titulo: 'Producto B' },
          { clave: 'pedidos_juntos', titulo: 'Compras juntos' },
          { clave: 'soporte_pct', titulo: 'Soporte', formato: (v) => pct(n(v), 2) },
          { clave: 'confianza_a_b_pct', titulo: 'Confianza', formato: (v) => pct(n(v)) },
          { clave: 'lift', titulo: 'Lift', formato: (v) => numero(n(v), 1), barra: true },
        ]}
        sql={a.sql.canasta}
        notas="Soporte: % de las compras con los dos productos. Confianza: de las compras con A, cuántas llevan B. Lift: cuántas veces más que por azar."
      />
    </div>
  )
}

// ---------------------------------------------------------------- respuestas escritas con los números
function mesAnterior(iso: string) {
  const [a, m] = iso.split('-').map(Number)
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`
}

function frasesMensual(meses: Fila[], $: (v: number) => string): ReactNode {
  if (!meses.length) return 'Tu archivo no alcanza a cubrir un mes completo.'
  const total = (xs: Fila[]) => xs.reduce((t, m) => t + n(m.ventas_netas), 0)
  const mejor = meses.reduce((a, b) => (n(b.ventas_netas) > n(a.ventas_netas) ? b : a))
  if (meses.length >= 24) {
    const ultimos = meses.slice(-12)
    const anteriores = meses.slice(-24, -12)
    const cambio = 100 * (total(ultimos) / total(anteriores) - 1)
    const parte = (100 * n(mejor.ventas_netas)) / total(meses.slice(-12).includes(mejor) ? ultimos : anteriores)
    return `En los últimos 12 meses completos las ventas ${cambio >= 0 ? 'subieron' : 'bajaron'} un ${pct(Math.abs(cambio))} contra los 12 anteriores (${$(total(ultimos))} contra ${$(total(anteriores))}). El mejor mes fue ${mes(s(mejor.mes), true)}, con el ${pct(parte)} de las ventas de su año.`
  }
  return `Tu archivo cubre ${meses.length} ${meses.length === 1 ? 'mes completo' : 'meses completos'}, con ${$(total(meses))} en ventas netas. El mejor fue ${mes(s(mejor.mes), true)}, con ${$(n(mejor.ventas_netas))}${meses.length < 24 ? '; con dos años de datos se podría comparar un año contra el otro' : ''}.`
}

function frasesAbc(abc: Fila[], periodo: string): string {
  const a = abc.find((x) => x.clase === 'A')
  const c = abc.find((x) => x.clase === 'C')
  if (!a) return 'No hay ventas en el período para clasificar productos.'
  return `${periodo[0].toUpperCase()}${periodo.slice(1)}, el ${pct(n(a.pct_productos))} de tus productos hace el 80 % de las ventas (clase A)${c ? `, y el ${pct(n(c.pct_productos))}, la clase C, apenas el ${pct(n(c.pct_ventas))}` : ''}.`
}

function frasesRfm(filas: Fila[]): string {
  const campeones = filas.find((x) => x.segmento === 'Campeones')
  if (!campeones) return 'Con tan pocos clientes identificados no se forman segmentos.'
  return `Los «Campeones», que compran seguido y hace poco, son el ${pct(n(campeones.pct_clientes))} de tus clientes identificados y hacen el ${pct(n(campeones.pct_ventas))} de sus ventas. Los segmentos salen de puntuar a cada cliente de 1 a 5 en recencia, frecuencia y monto (RFM).`
}

function frasesCohortes(filas: Fila[]): string {
  const primeras = [...new Set(filas.map((d) => s(d.cohorte)))].sort()
  // la primera cohorte junta a todos los que ya compraban antes de que parta el archivo: no se cuenta
  const al1 = filas.filter((d) => n(d.meses_desde) === 1 && s(d.cohorte) !== primeras[0]).map((d) => n(d.retencion_pct))
  if (!al1.length) return 'Hace falta más de un mes de datos para ver si los clientes vuelven.'
  const media = al1.reduce((a, b) => a + b, 0) / al1.length
  return `En promedio, el ${pct(media)} de los clientes nuevos vuelve a comprar al mes siguiente. La primera cohorte no cuenta en ese promedio: junta a quienes ya compraban antes de que empiece tu archivo.`
}

function frasesDevoluciones(filas: Fila[], $: (v: number, c?: boolean) => string): string {
  if (!filas.length) return 'No hay devoluciones en tu archivo (o no se marcan como elegiste).'
  const d = filas[0]
  return `Lo que más se devuelve es ${s(d.descripcion ?? d.codigo)}: ${$(n(d.monto_cancelado), false)}, el ${pct(n(d.cancelado_sobre_ventas_pct))} de lo que se vendió de ese producto.`
}

// ---------------------------------------------------------------- una sección
type Vista = 'grafico' | 'tabla' | 'sql'

function SeccionMia({
  id,
  archivo,
  pregunta,
  respuesta,
  grafico,
  filas,
  columnas,
  sql,
  notas,
  omitir,
  children,
}: {
  id: string
  archivo: string
  pregunta: string
  respuesta: ReactNode
  grafico?: ReactNode
  filas: Fila[]
  columnas?: Columna[]
  sql: string
  notas?: ReactNode
  omitir?: boolean
  children?: ReactNode
}) {
  const [vista, setVista] = useState<Vista>(grafico ? 'grafico' : 'tabla')
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 border-t pt-10 pb-12">
      <p className="mb-2 font-mono text-[12px] text-tinta-tenue">{archivo}</p>
      <h2 id={`${id}-titulo`} className="max-w-[30ch] text-[1.65rem] leading-tight font-semibold tracking-tight">
        {pregunta}
      </h2>
      <div className="mt-3 max-w-[62ch] text-[1.07rem] leading-relaxed text-tinta-suave">{respuesta}</div>
      {children}
      {!omitir && (
        <figure className="mt-6 overflow-hidden rounded-lg border bg-superficie">
          <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2" role="tablist" aria-label="Qué mostrar">
            {grafico && <Pestana activa={vista === 'grafico'} alElegir={() => setVista('grafico')} icono={BarChart3} texto="Gráfico" />}
            <Pestana activa={vista === 'tabla'} alElegir={() => setVista('tabla')} icono={Table2} texto="Tabla" />
            <Pestana activa={vista === 'sql'} alElegir={() => setVista('sql')} icono={Code2} texto="SQL" />
          </div>
          <div className="p-4 sm:p-5">
            {vista === 'grafico' && grafico}
            {vista === 'tabla' &&
              (filas.length ? (
                <div className="max-h-[30rem] overflow-auto">
                  <Tabla filas={filas} columnas={columnas} etiqueta={pregunta} />
                </div>
              ) : (
                <p className="py-4 text-center text-[14px] text-tinta-tenue">La consulta no devolvió filas.</p>
              ))}
            {vista === 'sql' && <SqlVista codigo={sql} />}
          </div>
          {notas && <figcaption className="border-t px-4 py-3 text-[13px] text-tinta-tenue sm:px-5">{notas}</figcaption>}
        </figure>
      )}
    </section>
  )
}

function Pestana({ activa, alElegir, icono: Icono, texto }: { activa: boolean; alElegir: () => void; icono: typeof Table2; texto: string }) {
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
