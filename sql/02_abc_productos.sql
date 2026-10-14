-- Clasificación ABC de productos por ventas netas del último año completo (dic-2010 a nov-2011).
-- Un producto es A si, antes de sumarlo, el acumulado no llegaba al 80 %; B hasta el 95 %; C el resto.
CREATE OR REPLACE VIEW abc AS
WITH por_producto AS (
    SELECT codigo, sum(monto) AS ventas, sum(cantidad) AS unidades
    FROM lineas
    WHERE fecha >= DATE '2010-12-01' AND fecha < DATE '2011-12-01'
    GROUP BY codigo
    HAVING sum(monto) > 0
),
acumulado AS (
    SELECT
        *,
        row_number() OVER (ORDER BY ventas DESC, codigo) AS ranking,
        sum(ventas) OVER (ORDER BY ventas DESC, codigo ROWS UNBOUNDED PRECEDING) / sum(ventas) OVER () AS acum,
        ventas / sum(ventas) OVER () AS participacion
    FROM por_producto
)
SELECT
    ranking,
    codigo,
    n.descripcion,
    ventas,
    unidades,
    acum,
    CASE
        WHEN acum - participacion < 0.80 THEN 'A'
        WHEN acum - participacion < 0.95 THEN 'B'
        ELSE 'C'
    END AS clase
FROM acumulado
LEFT JOIN nombres n USING (codigo);

SELECT
    clase,
    count(*) AS productos,
    round(100 * count(*) / sum(count(*)) OVER (), 1) AS pct_productos,
    round(sum(ventas), 2) AS ventas,
    round(100 * sum(ventas) / sum(sum(ventas)) OVER (), 1) AS pct_ventas
FROM abc
GROUP BY clase
ORDER BY clase;
