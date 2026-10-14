"""Los datos que usa la app web (interfaz/public/datos) son los mismos del Excel: con ellos, las consultas de sql/
dan exactamente las tablas publicadas en resultados/."""

import runpy
from pathlib import Path

import duckdb
import pytest

from ventas.analisis import correr, curva_abc

RAIZ = Path(__file__).resolve().parents[1]
DATOS_WEB = runpy.run_path(str(RAIZ / "scripts" / "datos_web.py"))


@pytest.fixture(scope="module")
def con() -> duckdb.DuckDBPyConnection:
    tabla = DATOS_WEB["leer"]()
    c = duckdb.connect()
    c.register("datos_web", tabla)
    # como en el navegador: una tabla con los datos y la vista crudo encima
    c.execute("CREATE TABLE online_retail_ii AS SELECT * FROM datos_web")
    c.execute("CREATE VIEW crudo AS SELECT * FROM online_retail_ii")
    return c


def test_datos_web_tienen_las_columnas_y_lineas_del_excel(con):
    columnas = [f[0] for f in con.execute("SELECT * FROM crudo LIMIT 0").description]
    assert columnas == ["factura", "codigo", "descripcion", "cantidad", "fecha", "precio", "cliente", "pais", "hoja"]
    assert con.execute("SELECT count(*) FROM crudo").fetchone()[0] == 1_067_371


def test_con_los_datos_web_las_consultas_dan_los_resultados_publicados(con):
    resultados = correr(con)
    assert len(resultados) == 8
    for nombre, df in resultados.items():
        publicado = (RAIZ / "resultados" / f"{nombre}.csv").read_text(encoding="utf-8")
        assert df.to_csv(index=False, lineterminator="\n") == publicado, nombre
    curva = (RAIZ / "resultados" / "02_abc_curva.csv").read_text(encoding="utf-8")
    assert curva_abc(con).to_csv(index=False, lineterminator="\n") == curva
