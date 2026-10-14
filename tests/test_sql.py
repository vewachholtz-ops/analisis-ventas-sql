"""Cada consulta se prueba con un dataset chico inventado cuyo resultado se calcula a mano."""

from datetime import datetime as dt
from pathlib import Path

import duckdb
import pandas as pd
import pytest

from ventas.analisis import SQL, conectar, correr, curva_abc

H1, H2 = "Year 2009-2010", "Year 2010-2011"
FILAS = [
    # factura, codigo, descripcion, cantidad, fecha, precio, cliente, pais, hoja
    ("500000", "10001", "TAZA", 5, dt(2009, 12, 20), 2.0, 2, "France", H1),  # 10
    ("500001", "10001", "TAZA", 10, dt(2010, 1, 5), 2.0, 1, "United Kingdom", H1),  # 20
    ("500001", "10002", "PLATO", 5, dt(2010, 1, 5), 4.0, 1, "United Kingdom", H1),  # 20
    ("500002", "10001", "TAZA", 3, dt(2010, 2, 10), 2.0, 2, "France", H1),  # 6
    ("500010", "10001", "TAZA ", 1, dt(2010, 1, 20), 2.0, 4, "Germany", H1),  # 2 (descripción con espacio)
    ("500003", "POST", "POSTAGE", 1, dt(2010, 2, 10), 18.0, 2, "France", H1),  # fuera: no es producto
    ("500004", "10003", "VASO", 4, dt(2010, 2, 11), 0.0, 3, "United Kingdom", H1),  # fuera: precio 0
    ("A500005", "B", "Adjust bad debt", 1, dt(2010, 3, 1), 100.0, None, "United Kingdom", H1),  # fuera: ajuste
    ("500006", "10001", "TAZA", 2, dt(2010, 12, 5), 2.0, 1, "United Kingdom", H1),  # fuera: repetida en H2
    ("500006", "10001", "TAZA", 2, dt(2010, 12, 5), 2.0, 1, "United Kingdom", H2),  # 4
    ("C500007", "10002", "PLATO", -1, dt(2010, 12, 6), 4.0, 1, "United Kingdom", H2),  # cancelación -4
    ("500008", "10002B", "PLATO AZUL", 1, dt(2011, 1, 15), 10.0, 3, "United Kingdom", H2),  # 10
    ("500008", "10001", "TAZA", 1, dt(2011, 1, 15), 2.0, 3, "United Kingdom", H2),  # 2
    ("500009", "10004", "CUCHARA", 1, dt(2011, 2, 1), 1.0, 3, "United Kingdom", H2),  # 1
    ("500009", "10005", "TENEDOR", 1, dt(2011, 2, 1), 0.5, 3, "United Kingdom", H2),  # 0,5
]
COLUMNAS = ["factura", "codigo", "descripcion", "cantidad", "fecha", "precio", "cliente", "pais", "hoja"]


@pytest.fixture(scope="module")
def con(tmp_path_factory) -> duckdb.DuckDBPyConnection:
    df = pd.DataFrame(FILAS, columns=COLUMNAS)
    df["cliente"] = df["cliente"].astype("Int64")
    ruta = tmp_path_factory.mktemp("datos") / "mini.parquet"
    c = duckdb.connect()
    c.register("df", df)
    c.execute(f"COPY (SELECT * FROM df) TO '{ruta.as_posix()}' (FORMAT parquet)")
    return conectar(ruta)


@pytest.fixture(scope="module")
def res(con) -> dict[str, pd.DataFrame]:
    return correr(con)


def test_limpieza_aplica_todas_las_reglas(res):
    r = res["00_limpieza"].iloc[0]
    assert r["lineas_originales"] == 15
    assert r["lineas_validas"] == 11  # fuera POST, precio 0, factura A y la repetida
    assert r["lineas_de_venta"] == 10
    assert r["lineas_canceladas"] == 1
    assert r["ventas_totales"] == pytest.approx(75.5)
    assert r["monto_cancelado"] == pytest.approx(4)
    assert r["ventas_netas"] == pytest.approx(71.5)
    assert r["clientes"] == 4 and r["productos"] == 5


def test_un_nombre_por_producto(con):
    nombres = dict(con.execute("SELECT codigo, descripcion FROM nombres").fetchall())
    assert nombres["10001"] == "TAZA"  # la variante "TAZA " se limpia y se cuenta junto con las demás


def test_ventas_mensuales_y_variacion_anual(res):
    m = res["01_ventas_mensuales"].set_index("mes")
    assert m.loc["2010-01-01", "ventas_netas"] == pytest.approx(42)
    assert m.loc["2010-01-01", "pedidos"] == 2
    dic = m.loc["2010-12-01"]
    assert (dic["ventas_brutas"], dic["canceladas"], dic["ventas_netas"]) == pytest.approx((4, 4, 0))
    assert dic["variacion_anual_pct"] == pytest.approx(-100)  # contra los 10 de dic-2009
    assert m.loc["2011-01-01", "variacion_anual_pct"] == pytest.approx(-71.4)  # 12 contra 42 de ene-2010
    assert pd.isna(m.loc["2010-01-01", "variacion_anual_pct"])  # no hay ene-2009 con qué comparar
    assert m["mes_parcial"].sum() == 1 and m.loc["2011-02-01", "mes_parcial"]


def test_abc(con, res):
    clases = con.execute("SELECT codigo, clase FROM abc ORDER BY ranking").df()
    # último año: 10002B 10, 10001 6, 10004 1, 10005 0,5 (10002 queda con venta neta negativa y sale)
    assert clases.values.tolist() == [["10002B", "A"], ["10001", "A"], ["10004", "B"], ["10005", "C"]]
    assert res["02_abc_productos"]["pct_ventas"].sum() == pytest.approx(100, abs=0.2)


def test_curva_abc_reducida_conserva_extremos(con, res):
    completa = curva_abc(con, puntos=10_000)
    assert completa["acum"].tolist() == pytest.approx([10 / 17.5, 16 / 17.5, 17 / 17.5, 1.0])
    reducida = curva_abc(con, puntos=2)
    assert reducida["ranking"].tolist() == [1, 3, 4]  # cada 2 productos y siempre el último


def test_rfm(con, res):
    rfm = con.execute(
        "SELECT cliente, recencia_dias, frecuencia, monto, r, f, m, segmento FROM rfm ORDER BY cliente"
    ).df()
    # fecha de referencia: el día siguiente a la última venta (2011-02-02)
    assert rfm[["cliente", "recencia_dias", "frecuencia", "monto"]].values.tolist() == [
        [1, 59, 2, 40.0],
        [2, 357, 2, 16.0],
        [3, 1, 2, 13.5],
        [4, 378, 1, 2.0],
    ]
    # puntaje = 1 + piso(5 · (rango - 1) / 4); los tres clientes con 2 pedidos empatan y reciben el mismo f
    assert rfm["r"].tolist() == [3, 2, 4, 1]
    assert rfm["f"].tolist() == [2, 2, 2, 1]
    assert rfm["m"].tolist() == [4, 3, 2, 1]
    assert rfm["segmento"].tolist() == ["Por desarrollar", "Inactivos", "Nuevos o recientes", "Inactivos"]
    assert res["03_rfm_clientes"]["clientes"].sum() == 4


def test_cohortes(res):
    c = res["04_cohortes"]
    fila = c[(c["cohorte"] == pd.Timestamp("2009-12-01")) & (c["meses_desde"] == 2)]
    assert fila["retencion_pct"].item() == 100  # el cliente 2 vuelve en feb-2010
    enero = c[c["cohorte"] == pd.Timestamp("2010-01-01")].set_index("meses_desde")
    assert enero.loc[0, "clientes"] == 2  # clientes 1 y 4
    assert enero.loc[11, "retencion_pct"] == 50  # solo el cliente 1 vuelve, en dic-2010


def test_devoluciones(res):
    d = res["05_devoluciones"].iloc[0]
    assert d["codigo"] == "10002"
    assert d["cancelado_sobre_ventas_pct"] == pytest.approx(20)


def test_paises(res):
    p = res["06_paises"]
    assert p["pais"].tolist() == ["United Kingdom"]
    assert p["ventas_netas"].item() == pytest.approx(13.5)


def test_canasta_calcula_soporte_confianza_y_lift(con):
    sql = (SQL / "07_canasta.sql").read_text(encoding="utf-8").replace("p.juntos >= 100", "p.juntos >= 1")
    c = con.execute(sql).df()
    # 3 pedidos en el último año: {10001}, {10001, 10002B}, {10004, 10005}
    primero = c.iloc[0]
    assert (primero["producto_a"], primero["producto_b"]) == ("CUCHARA", "TENEDOR")
    assert primero["lift"] == pytest.approx(3.0)
    assert primero["confianza_a_b_pct"] == pytest.approx(100)
    assert c.iloc[1]["lift"] == pytest.approx(1.5)


def test_hay_ocho_consultas():
    archivos = {f.stem for f in Path(SQL).glob("*.sql")}
    assert len(archivos) == 8
