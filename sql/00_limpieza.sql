-- Limpieza: deja las líneas de producto válidas y separa ventas de cancelaciones.
-- Los montos de las cancelaciones son negativos, así que sum(monto) sobre `lineas` da la venta neta.
-- Reglas (ver README):
--   * la hoja 2010-2011 repite del 1 al 9 de diciembre de 2010 lo que ya trae la hoja 2009-2010;
--   * las facturas 'A' son ajustes de deuda, no ventas;
--   * precio 0 son ajustes y muestras;
--   * solo códigos de producto (5 dígitos y letras opcionales): fuera POST, M, DOT, BANK CHARGES, etc.
CREATE OR REPLACE VIEW lineas AS
SELECT
    factura,
    codigo,
    descripcion,
    cantidad,
    fecha,
    precio,
    cliente,
    pais,
    cantidad * precio AS monto,
    starts_with(factura, 'C') AS es_cancelacion
FROM crudo
WHERE NOT (hoja = 'Year 2009-2010' AND fecha >= TIMESTAMP '2010-12-01')
  AND NOT starts_with(factura, 'A')
  AND precio > 0
  AND regexp_full_match(codigo, '[0-9]{5}[A-Za-z]*');

-- Un nombre por producto: la descripción más frecuente del código (sin espacios sobrantes; empates por orden alfabético)
CREATE OR REPLACE VIEW nombres AS
SELECT codigo, descripcion
FROM (
    SELECT codigo, trim(descripcion) AS descripcion, count(*) AS n
    FROM lineas
    WHERE descripcion IS NOT NULL
    GROUP BY ALL
)
QUALIFY row_number() OVER (PARTITION BY codigo ORDER BY n DESC, descripcion) = 1;

CREATE OR REPLACE VIEW ventas AS
SELECT * FROM lineas
WHERE NOT es_cancelacion AND cantidad > 0;

CREATE OR REPLACE VIEW cancelaciones AS
SELECT * FROM lineas
WHERE es_cancelacion;

-- Resumen de lo que quedó
SELECT
    (SELECT count(*) FROM crudo) AS lineas_originales,
    (SELECT count(*) FROM lineas) AS lineas_validas,
    (SELECT count(*) FROM ventas) AS lineas_de_venta,
    (SELECT count(*) FROM cancelaciones) AS lineas_canceladas,
    (SELECT round(sum(monto), 2) FROM ventas) AS ventas_totales,
    (SELECT round(-sum(monto), 2) FROM cancelaciones) AS monto_cancelado,
    (SELECT round(sum(monto), 2) FROM lineas) AS ventas_netas,
    (SELECT count(DISTINCT cliente) FROM ventas) AS clientes,
    (SELECT count(DISTINCT codigo) FROM ventas) AS productos,
    (SELECT min(fecha) FROM ventas) AS desde,
    (SELECT max(fecha) FROM ventas) AS hasta;
