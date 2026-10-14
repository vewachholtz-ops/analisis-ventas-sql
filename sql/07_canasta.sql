-- Análisis de canasta: pares de productos que se compran juntos en el mismo pedido.
-- soporte = % de pedidos con ambos; confianza = P(B | A); lift = cuánto más que por azar.
-- Se consideran los 300 productos presentes en más pedidos del último año completo.
WITH pedidos AS (
    SELECT DISTINCT factura, codigo
    FROM ventas
    WHERE fecha >= DATE '2010-12-01' AND fecha < DATE '2011-12-01'
),
total AS (SELECT count(DISTINCT factura) AS n FROM pedidos),
frecuentes AS (
    SELECT codigo, count(*) AS n_pedidos FROM pedidos GROUP BY codigo ORDER BY n_pedidos DESC, codigo LIMIT 300
),
pares AS (
    SELECT a.codigo AS a, b.codigo AS b, count(*) AS juntos
    FROM pedidos a
    JOIN pedidos b ON a.factura = b.factura AND a.codigo < b.codigo
    WHERE a.codigo IN (SELECT codigo FROM frecuentes) AND b.codigo IN (SELECT codigo FROM frecuentes)
    GROUP BY 1, 2
)
SELECT
    na.descripcion AS producto_a,
    nb.descripcion AS producto_b,
    p.juntos AS pedidos_juntos,
    round(100 * p.juntos / t.n, 2) AS soporte_pct,
    round(100 * p.juntos / fa.n_pedidos, 1) AS confianza_a_b_pct,
    round(p.juntos * t.n / (fa.n_pedidos * fb.n_pedidos), 1) AS lift
FROM pares p
CROSS JOIN total t
JOIN frecuentes fa ON fa.codigo = p.a
JOIN frecuentes fb ON fb.codigo = p.b
JOIN nombres na ON na.codigo = p.a
JOIN nombres nb ON nb.codigo = p.b
WHERE p.juntos >= 100
ORDER BY lift DESC, pedidos_juntos DESC, producto_a, producto_b
LIMIT 15;
