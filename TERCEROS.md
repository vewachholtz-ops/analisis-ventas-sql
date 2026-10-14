# Datos y código de terceros

## Datos

**Online Retail II** — Daqing Chen (2012), UCI Machine Learning Repository, <https://doi.org/10.24432/C5CG6D>.
Licencia [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

La app web incluye una copia de estos datos en `interfaz/public/datos/online_retail_ii.arrow.gz`: las mismas
1.067.371 líneas de las dos hojas del Excel original, con las columnas renombradas al español (`factura`, `codigo`,
`descripcion`, `cantidad`, `fecha`, `precio`, `cliente`, `pais`, `hoja`), ordenadas por fecha y guardadas en formato
Arrow comprimido con gzip. No se agregó, quitó ni corrigió ninguna línea; la limpieza la hacen las consultas de `sql/`.

`interfaz/public/datos/ventas-ejemplo.csv` (las ventas de una papelería para probar «Usar mis ventas») son datos
inventados por `scripts/ventas_ejemplo.py`; van con la licencia MIT del repositorio.

## Código incluido en la app web

| Paquete | Licencia | Para qué |
|---|---|---|
| [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm) | MIT | La base de datos que corre las consultas en el navegador |
| [Observable Plot](https://github.com/observablehq/plot) | ISC | Los gráficos |
| [CodeMirror](https://codemirror.net/) | MIT | El editor de SQL |
| [React](https://react.dev/) | MIT | La interfaz |
| [Lucide](https://lucide.dev/) | ISC | Los íconos |
| [d3-dsv](https://github.com/d3/d3-dsv) | ISC | Leer y escribir CSV |
| [fflate](https://github.com/101arrowz/fflate) | MIT | Abrir los Excel (.xlsx) que sube cada persona |
| [Schibsted Grotesk](https://github.com/schibsted/schibsted-grotesk) | SIL Open Font License 1.1 | La tipografía |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | SIL Open Font License 1.1 | La tipografía del código |

El texto completo de cada licencia se publica junto a la app, en `licencias.txt`.
