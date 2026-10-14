-- Retención por cohorte: de los clientes que compraron por primera vez en un mes,
-- qué porcentaje vuelve a comprar 1, 2, 3… meses después. Solo meses completos (hasta nov-2011).
-- Un mes cuenta como compra aunque después se haya cancelado.
WITH compras AS (
    SELECT DISTINCT cliente, date_trunc('month', fecha)::DATE AS mes
    FROM ventas
    WHERE cliente IS NOT NULL AND fecha < DATE '2011-12-01'
),
primera AS (
    SELECT cliente, min(mes) AS cohorte FROM compras GROUP BY cliente
),
actividad AS (
    SELECT p.cohorte, date_diff('month', p.cohorte, c.mes) AS meses_desde, count(*) AS clientes
    FROM compras c
    JOIN primera p USING (cliente)
    GROUP BY 1, 2
)
SELECT
    cohorte,
    meses_desde,
    clientes,
    round(100 * clientes / first_value(clientes) OVER (PARTITION BY cohorte ORDER BY meses_desde), 1) AS retencion_pct
FROM actividad
ORDER BY cohorte, meses_desde;
