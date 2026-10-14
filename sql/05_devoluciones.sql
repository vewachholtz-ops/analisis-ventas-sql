-- Productos con más monto cancelado (dic-2009 a dic-2011) y qué parte de sus ventas representa.
WITH vendido AS (
    SELECT codigo, sum(monto) AS ventas FROM ventas GROUP BY codigo
),
cancelado AS (
    SELECT codigo, -sum(monto) AS cancelado, count(DISTINCT factura) AS facturas_cancelacion
    FROM cancelaciones GROUP BY codigo
)
SELECT
    c.codigo,
    n.descripcion,
    round(c.cancelado, 2) AS monto_cancelado,
    c.facturas_cancelacion,
    round(v.ventas, 2) AS ventas,
    round(100 * c.cancelado / v.ventas, 1) AS cancelado_sobre_ventas_pct
FROM cancelado c
JOIN vendido v USING (codigo)
LEFT JOIN nombres n USING (codigo)
ORDER BY c.cancelado DESC, c.codigo
LIMIT 15;
