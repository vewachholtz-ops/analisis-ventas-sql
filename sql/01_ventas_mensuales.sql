-- Ventas por mes: brutas, canceladas y netas, con pedidos, clientes y la variación anual de las netas.
-- Diciembre de 2011 es parcial (el dataset termina el día 9).
WITH mensual AS (
    SELECT
        date_trunc('month', fecha)::DATE AS mes,
        sum(monto) FILTER (WHERE NOT es_cancelacion) AS brutas,
        -coalesce(sum(monto) FILTER (WHERE es_cancelacion), 0) AS canceladas,
        count(DISTINCT factura) FILTER (WHERE NOT es_cancelacion) AS pedidos,
        count(DISTINCT cliente) FILTER (WHERE NOT es_cancelacion) AS clientes
    FROM lineas
    GROUP BY 1
)
SELECT
    m.mes,
    round(brutas, 2) AS ventas_brutas,
    round(canceladas, 2) AS canceladas,
    round(brutas - canceladas, 2) AS ventas_netas,
    pedidos,
    clientes,
    round((brutas - canceladas) / pedidos, 2) AS ticket_promedio,
    -- se compara con el mismo mes del año anterior por fecha, no por posición, por si falta algún mes
    round(100 * ((brutas - canceladas) / anterior.netas - 1), 1) AS variacion_anual_pct,
    m.mes = (SELECT date_trunc('month', max(fecha))::DATE FROM lineas) AS mes_parcial
FROM mensual m
LEFT JOIN (SELECT mes, brutas - canceladas AS netas FROM mensual) anterior
    ON anterior.mes = m.mes - INTERVAL 12 MONTH
ORDER BY m.mes;
