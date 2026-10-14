"""Deja una copia compacta de los datos crudos para la app web (interfaz/public/datos/online_retail_ii.arrow.gz).

La app corre las mismas consultas de sql/ en el navegador con DuckDB-WASM, así que necesita las 1.067.371 líneas
originales. Van en formato Arrow (el que DuckDB-WASM carga sin extensiones ni descargas extra), con los textos
codificados como diccionario y comprimido con gzip, que el navegador descomprime solo: pesa lo mismo que un Parquet
y no depende de nada fuera de la página. Online Retail II tiene licencia CC BY 4.0, que permite redistribuirlo
citando la fuente (la app, el README y TERCEROS.md la citan).

Uso: uv run python scripts/datos_web.py   (después de `uv run ventas`, que deja datos/online_retail_ii.parquet)
"""

from __future__ import annotations

import gzip
import io
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.ipc as ipc

RAIZ = Path(__file__).resolve().parents[1]
ORIGEN = RAIZ / "datos" / "online_retail_ii.parquet"
DESTINO = RAIZ / "interfaz" / "public" / "datos" / "online_retail_ii.arrow.gz"


def tabla_web(origen: Path = ORIGEN) -> pa.Table:
    """Las líneas ordenadas por fecha, con cada columna de texto como diccionario (un texto repetido se guarda una
    sola vez)."""
    crudo = duckdb.sql(f"SELECT * FROM read_parquet('{origen.as_posix()}') ORDER BY fecha, factura, codigo").arrow()
    if isinstance(crudo, pa.RecordBatchReader):
        crudo = crudo.read_all()
    columnas = [
        pc.dictionary_encode(crudo[n].cast(pa.string()))
        if pa.types.is_string(t) or pa.types.is_large_string(t)
        else crudo[n]
        for n, t in zip(crudo.column_names, crudo.schema.types, strict=True)
    ]
    return pa.table(columnas, names=crudo.column_names).combine_chunks()


def comprimir(tabla: pa.Table) -> bytes:
    buffer = io.BytesIO()
    with ipc.new_stream(buffer, tabla.schema) as escritor:
        escritor.write_table(tabla, max_chunksize=1 << 17)
    # mtime=0: el mismo contenido da siempre el mismo archivo
    return gzip.compress(buffer.getvalue(), compresslevel=9, mtime=0)


def leer(ruta: Path = DESTINO) -> pa.Table:
    """Lo inverso: la tabla que va a ver el navegador (para las pruebas)."""
    return ipc.open_stream(gzip.decompress(ruta.read_bytes())).read_all()


def main() -> None:
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    tabla = tabla_web()
    DESTINO.write_bytes(comprimir(tabla))
    print(f"{tabla.num_rows:,} filas en {DESTINO} ({DESTINO.stat().st_size / 1e6:.1f} MB)".replace(",", "."))


if __name__ == "__main__":
    main()
