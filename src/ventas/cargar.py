"""Descarga Online Retail II (UCI) y lo convierte a Parquet para consultarlo con DuckDB.

El Excel tiene dos hojas (2009-2010 y 2010-2011) y tarda alrededor de un minuto en leerse;
el Parquet resultante se lee en menos de un segundo.
"""

from __future__ import annotations

import io
import urllib.request
import zipfile
from pathlib import Path

import duckdb
import pandas as pd

URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
COLUMNAS = {
    "Invoice": "factura",
    "StockCode": "codigo",
    "Description": "descripcion",
    "Quantity": "cantidad",
    "InvoiceDate": "fecha",
    "Price": "precio",
    "Customer ID": "cliente",
    "Country": "pais",
}


def descargar(destino: Path) -> Path:
    """Baja el zip de UCI y extrae el Excel en `destino`."""
    destino.mkdir(parents=True, exist_ok=True)
    xlsx = destino / "online_retail_II.xlsx"
    if not xlsx.exists():
        print(f"Descargando {URL} …")
        with urllib.request.urlopen(URL, timeout=120) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(destino)
    return xlsx


def excel_a_parquet(xlsx: Path, parquet: Path) -> int:
    """Une las dos hojas con nombres de columna en español y guarda un Parquet. Devuelve las filas."""
    hojas = pd.read_excel(xlsx, sheet_name=None, dtype={"Invoice": str, "StockCode": str})
    df = pd.concat([h.assign(hoja=nombre) for nombre, h in hojas.items()], ignore_index=True)
    df = df.rename(columns=COLUMNAS)
    df["cliente"] = df["cliente"].astype("Int64")
    con = duckdb.connect()
    con.register("df", df)
    con.execute(f"COPY (SELECT * FROM df) TO '{parquet.as_posix()}' (FORMAT parquet)")
    return len(df)


def preparar(carpeta: Path = Path("datos")) -> Path:
    """Deja `datos/online_retail_ii.parquet` listo, descargando y convirtiendo solo si falta."""
    parquet = carpeta / "online_retail_ii.parquet"
    if not parquet.exists():
        filas = excel_a_parquet(descargar(carpeta), parquet)
        print(f"{filas:,} filas guardadas en {parquet}".replace(",", "."))
    return parquet


if __name__ == "__main__":
    preparar()
