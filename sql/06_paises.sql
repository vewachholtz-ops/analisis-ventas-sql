-- Ventas netas por país en el último año completo: los 10 principales y el resto agrupado.
WITH por_pais AS (
    SELECT
        pais,
        sum(monto) AS ventas,
        count(DISTINCT cliente) FILTER (WHERE NOT es_cancelacion) AS clientes,
        count(DISTINCT factura) FILTER (WHERE NOT es_cancelacion) AS pedidos
    FROM lineas
    WHERE fecha >= DATE '2010-12-01' AND fecha < DATE '2011-12-01'
    GROUP BY pais
),
agrupado AS (
    SELECT
        CASE WHEN row_number() OVER (ORDER BY ventas DESC) <= 10 THEN pais ELSE 'Otros' END AS pais,
        ventas, clientes, pedidos
    FROM por_pais
)
SELECT
    pais,
    round(sum(ventas), 2) AS ventas_netas,
    round(100 * sum(ventas) / sum(sum(ventas)) OVER (), 1) AS pct_ventas,
    sum(clientes)::INTEGER AS clientes,
    round(sum(ventas) / sum(pedidos), 2) AS ticket_promedio
FROM agrupado
GROUP BY pais
ORDER BY pais = 'Otros', ventas_netas DESC;
