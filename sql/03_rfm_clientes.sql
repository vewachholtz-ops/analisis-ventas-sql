-- Segmentación RFM: recencia (días desde la última compra), frecuencia (pedidos) y monto neto de cancelaciones.
-- Cada dimensión se puntúa de 1 a 5 por quintiles; 5 es lo mejor (más reciente, más pedidos, más monto).
-- Los puntajes usan rank(), así que dos clientes iguales reciben el mismo puntaje
-- (con ntile() un empate se reparte al azar entre quintiles y el resultado cambia entre corridas).
-- Solo clientes identificados: las ventas sin código de cliente quedan fuera.
CREATE OR REPLACE VIEW rfm AS
WITH por_cliente AS (
    SELECT
        cliente,
        date_diff(
            'day', max(fecha) FILTER (WHERE NOT es_cancelacion)::DATE, (SELECT max(fecha)::DATE + 1 FROM lineas)
        ) AS recencia_dias,
        count(DISTINCT factura) FILTER (WHERE NOT es_cancelacion) AS frecuencia,
        -- redondeado al centavo: un cliente que canceló todo lo que compró suma 0, pero en punto flotante puede dar
        -- 0,00000000000003 (y contarse como cliente con compras) según el orden en que se sumen las líneas
        round(sum(monto), 2) AS monto
    FROM lineas
    WHERE cliente IS NOT NULL
    GROUP BY cliente
    HAVING count(*) FILTER (WHERE NOT es_cancelacion) > 0 AND round(sum(monto), 2) > 0
),
puntajes AS (
    SELECT
        *,
        1 + floor(5 * (rank() OVER (ORDER BY recencia_dias DESC) - 1) / count(*) OVER ())::INTEGER AS r,
        1 + floor(5 * (rank() OVER (ORDER BY frecuencia) - 1) / count(*) OVER ())::INTEGER AS f,
        1 + floor(5 * (rank() OVER (ORDER BY monto) - 1) / count(*) OVER ())::INTEGER AS m
    FROM por_cliente
)
SELECT
    *,
    CASE
        WHEN r >= 4 AND f >= 4 THEN 'Campeones'
        WHEN r >= 3 AND f >= 3 THEN 'Leales'
        WHEN r >= 4 AND f <= 2 THEN 'Nuevos o recientes'
        WHEN r <= 2 AND f >= 3 THEN 'En riesgo'
        WHEN r <= 2 AND f <= 2 THEN 'Inactivos'
        ELSE 'Por desarrollar'
    END AS segmento
FROM puntajes;

SELECT
    segmento,
    count(*) AS clientes,
    round(100 * count(*) / sum(count(*)) OVER (), 1) AS pct_clientes,
    round(100 * sum(monto) / sum(sum(monto)) OVER (), 1) AS pct_ventas,
    round(median(recencia_dias)) AS recencia_mediana_dias,
    round(avg(frecuencia), 1) AS pedidos_promedio,
    round(avg(monto), 0) AS monto_promedio
FROM rfm
GROUP BY segmento
ORDER BY pct_ventas DESC;
