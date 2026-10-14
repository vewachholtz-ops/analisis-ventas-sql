// Las ocho consultas, en el orden en que se corren. Cada una responde una pregunta con una oración y la respalda
// con su gráfico, su tabla publicada y su SQL.
import { Barras } from '../componentes/Barras'
import { Grafico } from '../componentes/Grafico'
import { Seccion } from '../componentes/Seccion'
import { CANASTA, DEVOLUCIONES, LIMPIEZA, type Valor } from '../lib/datos'
import { enteros, libras, mes, numero, pct } from '../lib/formato'
import { cohortes, PAIS_ES, paises, pareto, rfm, temporadas } from './graficos'

const L = LIMPIEZA
const lb = (v: Valor) => libras(Number(v), { compacto: false })
const p = (v: Valor) => pct(Number(v))

function Leyenda({ items }: { items: { texto: string; clase: string; linea?: boolean }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave" aria-label="Leyenda">
      {items.map((i) => (
        <li key={i.texto} className="flex items-center gap-2">
          <span aria-hidden className={i.linea ? `h-0.5 w-4 rounded-full ${i.clase}` : `size-2.5 rounded-full ${i.clase}`} />
          {i.texto}
        </li>
      ))}
    </ul>
  )
}

/** El índice del informe, en el orden de las consultas (el de los archivos de sql/). */
export const INDICE = [
  { id: 'limpieza', archivo: '00', titulo: 'Qué líneas cuentan' },
  { id: 'ventas', archivo: '01', titulo: '¿Creció el negocio?' },
  { id: 'productos', archivo: '02', titulo: '¿Cuántos productos importan?' },
  { id: 'clientes', archivo: '03', titulo: '¿Quiénes sostienen las ventas?' },
  { id: 'retencion', archivo: '04', titulo: '¿Vuelven los clientes nuevos?' },
  { id: 'devoluciones', archivo: '05', titulo: '¿Qué se cancela?' },
  { id: 'paises', archivo: '06', titulo: '¿Dónde se vende?' },
  { id: 'canasta', archivo: '07', titulo: '¿Qué se compra junto?' },
]

export function Informe() {
  return (
    <div>
      <Seccion
        id="limpieza"
        consulta="limpieza"
        pregunta="Antes de sumar: qué líneas cuentan"
        respuesta={
          <>
            El Excel trae {enteros(L.lineas_originales)} líneas, pero no todas son ventas. Cinco reglas dejan{' '}
            {enteros(L.lineas_validas)} líneas de producto; las {enteros(L.lineas_canceladas)} cancelaciones se restan en vez de
            ignorarse, y por eso la venta neta es {libras(L.ventas_netas)} y no {libras(L.ventas_totales)}.
          </>
        }
        grafico={
          <Barras
            etiqueta="Líneas del Excel y lo que queda después de limpiar"
            filas={[
              { clave: 'o', etiqueta: 'Líneas en el Excel', valor: L.lineas_originales, texto: enteros(L.lineas_originales) },
              { clave: 'v', etiqueta: 'Líneas de producto válidas', valor: L.lineas_validas, texto: enteros(L.lineas_validas), destacada: true },
              { clave: 'd', etiqueta: 'de ellas, ventas', valor: L.lineas_de_venta, texto: enteros(L.lineas_de_venta) },
              {
                clave: 'c',
                etiqueta: 'de ellas, cancelaciones (restan)',
                valor: L.lineas_canceladas,
                texto: enteros(L.lineas_canceladas),
                resta: true,
                detalle: `−${libras(L.monto_cancelado, { compacto: false })}`,
              },
            ]}
          />
        }
        columnas={[
          { clave: 'lineas_originales', titulo: 'Líneas' },
          { clave: 'lineas_validas', titulo: 'Válidas' },
          { clave: 'lineas_canceladas', titulo: 'Canceladas' },
          { clave: 'ventas_totales', titulo: 'Ventas', formato: lb },
          { clave: 'monto_cancelado', titulo: 'Cancelado', formato: lb },
          { clave: 'ventas_netas', titulo: 'Netas', formato: lb },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'productos', titulo: 'Productos' },
        ]}
      >
        <ol className="mt-5 max-w-[62ch] list-decimal space-y-1.5 pl-5 text-[14.5px] text-tinta-suave marker:text-tinta-tenue">
          <li>
            <strong className="font-semibold text-tinta">Días repetidos.</strong> La hoja 2010-2011 repite del 1 al 9 de diciembre de 2010,
            que ya están en la hoja anterior.
          </li>
          <li>
            <strong className="font-semibold text-tinta">Ajustes contables.</strong> Las facturas que empiezan con «A» son ajustes de deuda.
          </li>
          <li>
            <strong className="font-semibold text-tinta">Precio cero.</strong> Muestras y ajustes de inventario.
          </li>
          <li>
            <strong className="font-semibold text-tinta">Códigos que no son productos:</strong> envío (POST), manuales, comisiones del banco.
          </li>
          <li>
            <strong className="font-semibold text-tinta">Cancelaciones</strong> (facturas «C»): se restan.
          </li>
        </ol>
      </Seccion>

      <Seccion
        id="ventas"
        consulta="mensual"
        pregunta="¿Creció el negocio?"
        respuesta={
          <>
            Casi nada: +1,8 % el segundo año. Lo que manda es la temporada: de septiembre a noviembre se hace más de un tercio de las
            ventas de cada año, y noviembre solo, el 15 %. Diciembre de 2011 queda fuera del gráfico porque el dataset termina el día 9.
          </>
        }
        grafico={
          <>
            <Leyenda
              items={[
                { texto: 'dic 2010 a nov 2011', clase: 'bg-dato', linea: true },
                { texto: 'dic 2009 a nov 2010', clase: 'bg-[var(--contexto)]', linea: true },
              ]}
            />
            <Grafico dibujar={temporadas} etiqueta="Ventas netas por mes de las dos temporadas, una sobre otra: las curvas casi coinciden, con el máximo en noviembre" />
          </>
        }
        columnas={[
          { clave: 'mes', titulo: 'Mes', formato: (v) => mes(String(v)) },
          { clave: 'ventas_netas', titulo: 'Ventas netas', formato: lb, barra: true },
          { clave: 'canceladas', titulo: 'Canceladas', formato: lb },
          { clave: 'pedidos', titulo: 'Pedidos' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'ticket_promedio', titulo: 'Ticket', formato: lb },
          { clave: 'variacion_anual_pct', titulo: 'vs. año anterior', formato: (v) => (v === null ? '—' : `${Number(v) > 0 ? '+' : ''}${numero(Number(v), 1)} %`) },
        ]}
      />

      <Seccion
        id="productos"
        consulta="abc"
        pregunta="¿Cuántos productos importan?"
        respuesta={
          <>
            Pocos. En el último año completo (diciembre de 2010 a noviembre de 2011), el 21,6 % de los productos hace el 80 % de las ventas
            (clase A), y más de la mitad, la clase C, apenas el 5 %.
          </>
        }
        grafico={<Grafico dibujar={pareto} etiqueta="Curva ABC: las ventas acumuladas suben rápido con los primeros productos y se aplanan después" />}
        columnas={[
          { clave: 'clase', titulo: 'Clase' },
          { clave: 'productos', titulo: 'Productos' },
          { clave: 'pct_productos', titulo: '% productos', formato: p },
          { clave: 'ventas', titulo: 'Ventas', formato: lb, barra: true },
          { clave: 'pct_ventas', titulo: '% ventas', formato: p },
        ]}
      />

      <Seccion
        id="clientes"
        consulta="rfm"
        pregunta="¿Quiénes sostienen las ventas?"
        respuesta={
          <>
            Los «Campeones»: 1 de cada 4 clientes identificados compra seguido y hace poco, y se lleva el 69 % de las ventas con cliente
            identificado. Los inactivos son más (28 %) y hacen el 4 %. Los segmentos salen de puntuar a cada cliente de 1 a 5 en recencia,
            frecuencia y monto (RFM).
          </>
        }
        grafico={
          <>
            <Leyenda
              items={[
                { texto: '% de los clientes', clase: 'bg-[var(--contexto)]' },
                { texto: '% de las ventas', clase: 'bg-dato' },
              ]}
            />
            <Grafico dibujar={rfm} etiqueta="Por segmento, la parte de los clientes y la parte de las ventas: los Campeones son el 23,7 % de los clientes y hacen el 69,3 % de las ventas" />
          </>
        }
        columnas={[
          { clave: 'segmento', titulo: 'Segmento' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'pct_clientes', titulo: '% clientes', formato: p },
          { clave: 'pct_ventas', titulo: '% ventas', formato: p, barra: true },
          { clave: 'recencia_mediana_dias', titulo: 'Días desde la última compra' },
          { clave: 'pedidos_promedio', titulo: 'Pedidos', formato: (v) => numero(Number(v), 1) },
          { clave: 'monto_promedio', titulo: 'Monto promedio', formato: lb },
        ]}
        notas="El 13,5 % de las ventas no tiene código de cliente y queda fuera de esta segmentación."
      />

      <Seccion
        id="retencion"
        consulta="cohortes"
        pregunta="¿Vuelven los clientes nuevos?"
        respuesta={
          <>
            Poco: de los clientes que compran por primera vez, solo 1 de cada 5 vuelve al mes siguiente. La cohorte de diciembre de 2009
            retiene más porque el dataset parte ese mes y junta a clientes que ya compraban antes.
          </>
        }
        grafico={<Grafico dibujar={cohortes} etiqueta="Retención por cohorte en los doce meses siguientes a la primera compra: entre 6 y 33 %, más alta en la cohorte de diciembre de 2009" />}
        columnas={[
          { clave: 'cohorte', titulo: 'Cohorte', formato: (v) => mes(String(v)) },
          { clave: 'meses_desde', titulo: 'Meses después' },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'retencion_pct', titulo: 'Retención', formato: p, barra: true },
        ]}
      />

      <Seccion
        id="devoluciones"
        consulta="devoluciones"
        pregunta="¿Qué se cancela?"
        respuesta={
          <>
            Un solo pedido: 80.995 unidades de <em>Paper Craft, Little Birdie</em> por {libras(168469.6, { compacto: false })}, cancelado el
            mismo día. Si las cancelaciones no se restaran, ese producto estaría entre los más vendidos con una demanda que nunca existió, y
            diciembre de 2011 se vería un 40 % más grande.
          </>
        }
        grafico={
          <Barras
            etiqueta="Los productos con más monto cancelado"
            filas={DEVOLUCIONES.slice(0, 8).map((d, i) => ({
              clave: String(d.codigo),
              etiqueta: (
                <>
                  <span className="font-mono text-xs text-tinta-tenue">{d.codigo}</span> {d.descripcion}
                </>
              ),
              valor: d.monto_cancelado,
              texto: libras(d.monto_cancelado, { compacto: false }),
              resta: i === 0,
              detalle: `${pct(d.cancelado_sobre_ventas_pct)} de lo vendido, ${enteros(d.facturas_cancelacion)} ${d.facturas_cancelacion === 1 ? 'factura' : 'facturas'}`,
            }))}
          />
        }
        columnas={[
          { clave: 'codigo', titulo: 'Código', formato: (v) => <span className="font-mono text-xs">{String(v)}</span> },
          { clave: 'descripcion', titulo: 'Producto' },
          { clave: 'monto_cancelado', titulo: 'Cancelado', formato: lb, barra: true },
          { clave: 'facturas_cancelacion', titulo: 'Facturas' },
          { clave: 'ventas', titulo: 'Ventas', formato: lb },
          { clave: 'cancelado_sobre_ventas_pct', titulo: '% cancelado', formato: p },
        ]}
        resaltar={(f) => String(f.codigo) === '23843'}
      />

      <Seccion
        id="paises"
        consulta="paises"
        pregunta="¿Dónde se vende?"
        respuesta={
          <>
            En el Reino Unido: el 84,5 % de las ventas del último año completo. Afuera hay pocos clientes, pero algunos compran en grande:
            Países Bajos y Australia tienen 9 clientes cada uno y pedidos promedio de £ 3.019 y £ 2.446, cinco veces el británico.
          </>
        }
        grafico={<Grafico dibujar={paises} etiqueta="Ticket promedio por pedido según país: Países Bajos y Australia, muy por encima del resto" />}
        columnas={[
          { clave: 'pais', titulo: 'País', formato: (v) => PAIS_ES[String(v)] ?? String(v) },
          { clave: 'ventas_netas', titulo: 'Ventas netas', formato: lb, barra: true },
          { clave: 'pct_ventas', titulo: '% ventas', formato: p },
          { clave: 'clientes', titulo: 'Clientes' },
          { clave: 'ticket_promedio', titulo: 'Ticket promedio', formato: lb },
        ]}
        notas="Gráfico: ticket promedio por pedido de los diez países con más ventas. Irlanda (EIRE) son 3 clientes."
      />

      <Seccion
        id="canasta"
        consulta="canasta"
        pregunta="¿Qué se compra junto?"
        respuesta={
          <>
            Productos de la misma colección. Las dos habitaciones de la casa de muñecas <em>Poppy&apos;s Playhouse</em> aparecen juntas en un
            pedido 33 veces más que si se eligieran al azar (el «lift»): una pista para ofrecerlas como set.
          </>
        }
        grafico={
          <Barras
            etiqueta="Pares de productos que se compran juntos, por lift"
            filas={CANASTA.slice(0, 8).map((d, i) => ({
              clave: `${d.producto_a}-${d.producto_b}`,
              etiqueta: (
                <>
                  {d.producto_a} <span className="text-tinta-tenue">+</span> {d.producto_b}
                </>
              ),
              valor: d.lift,
              texto: `${numero(d.lift, 1)} veces`,
              destacada: i === 0,
              detalle: `${enteros(d.pedidos_juntos)} pedidos juntos`,
            }))}
          />
        }
        columnas={[
          { clave: 'producto_a', titulo: 'Producto A' },
          { clave: 'producto_b', titulo: 'Producto B' },
          { clave: 'pedidos_juntos', titulo: 'Pedidos juntos' },
          { clave: 'soporte_pct', titulo: 'Soporte', formato: (v) => pct(Number(v), 2) },
          { clave: 'confianza_a_b_pct', titulo: 'Confianza', formato: p },
          { clave: 'lift', titulo: 'Lift', formato: (v) => numero(Number(v), 1), barra: true },
        ]}
        notas="Soporte: % de los pedidos con los dos productos. Confianza: de los pedidos con A, cuántos llevan B. Lift: cuántas veces más que por azar. Se consideran los 300 productos con más pedidos y los pares que aparecen en al menos 100."
      />
    </div>
  )
}
