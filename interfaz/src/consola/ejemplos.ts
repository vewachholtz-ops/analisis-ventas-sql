// Consultas de ejemplo para la consola: preguntas que el informe no responde, para partir de algo que funciona.
export interface Ejemplo {
  titulo: string
  sql: string
  /** Usa columnas que solo tiene el archivo de la tienda de ejemplo (la hoja del Excel). */
  soloEjemplo?: boolean
}

export const EJEMPLOS: Ejemplo[] = [
  {
    titulo: 'Ventas por día de la semana',
    sql: `-- Ventas netas y pedidos por día de la semana.
-- isodow va de 1 (lunes) a 7 (domingo); las listas de DuckDB parten en 1.
SELECT
    ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][isodow(fecha)] AS dia,
    round(sum(monto)) AS ventas_netas,
    count(DISTINCT factura) AS pedidos
FROM lineas
GROUP BY isodow(fecha), dia
ORDER BY isodow(fecha);`,
  },
  {
    titulo: 'Pedidos por hora',
    sql: `-- A qué hora llegan los pedidos (hora del Reino Unido).
SELECT
    hour(fecha) AS hora,
    count(DISTINCT factura) AS pedidos,
    round(sum(monto)) AS ventas_netas
FROM lineas
GROUP BY hora
ORDER BY hora;`,
  },
  {
    titulo: 'Clientes nuevos por mes',
    sql: `-- Cuántos clientes compran por primera vez cada mes.
-- Diciembre de 2009 junta a todos los que ya compraban antes de que parta el dataset.
WITH primera AS (
    SELECT cliente, min(fecha)::DATE AS dia
    FROM ventas
    WHERE cliente IS NOT NULL
    GROUP BY cliente
)
SELECT date_trunc('month', dia)::DATE AS mes, count(*) AS clientes_nuevos
FROM primera
GROUP BY mes
ORDER BY mes;`,
  },
  {
    titulo: 'Los productos con más unidades',
    sql: `-- Desde lineas y no desde ventas, para que las cancelaciones resten.
SELECT
    n.descripcion AS producto,
    sum(l.cantidad) AS unidades,
    round(sum(l.monto)) AS ventas_netas
FROM lineas l
JOIN nombres n USING (codigo)
GROUP BY ALL
ORDER BY unidades DESC
LIMIT 15;`,
  },
  {
    titulo: 'Los pedidos más grandes',
    sql: `-- Los dos primeros se cancelaron enteros: búscalos en 05_devoluciones.sql.
SELECT
    factura,
    round(sum(monto)) AS total,
    count(*) AS lineas,
    cliente,
    pais,
    min(fecha)::DATE AS dia
FROM ventas
GROUP BY factura, cliente, pais
ORDER BY total DESC
LIMIT 20;`,
  },
  {
    titulo: 'Lo que dejó fuera la limpieza',
    soloEjemplo: true,
    sql: `-- Las líneas del Excel que no pasan las reglas de 00_limpieza.sql, por motivo.
SELECT
    CASE
        WHEN hoja = 'Year 2009-2010' AND fecha >= TIMESTAMP '2010-12-01' THEN 'Día repetido en las dos hojas'
        WHEN starts_with(factura, 'A') THEN 'Ajuste contable (factura A)'
        WHEN precio <= 0 THEN 'Precio cero'
        ELSE 'Código que no es un producto'
    END AS motivo,
    count(*) AS lineas
FROM crudo
WHERE (hoja = 'Year 2009-2010' AND fecha >= TIMESTAMP '2010-12-01')
   OR starts_with(factura, 'A')
   OR precio <= 0
   OR NOT regexp_full_match(codigo, '[0-9]{5}[A-Za-z]*')
GROUP BY motivo
ORDER BY lineas DESC;`,
  },
]
