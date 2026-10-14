"""La app web en un navegador de verdad: corre las ocho consultas con DuckDB-WASM y cada una da lo mismo que su tabla
de resultados/; la consola corre SQL escrito a mano y muestra los errores de DuckDB; «Usar mis ventas» lee un CSV y
un Excel ajenos y arma el informe con ellos.

Necesita la app construida con DuckDB incluido (sin internet) y Chromium para Playwright:

    cd interfaz && npm ci && VITE_DUCKDB=local npm run build && cd ..
    uv run playwright install chromium
    uv run pytest tests/test_navegador.py

Con otro Chromium ya instalado: CHROMIUM=/ruta/al/chrome uv run pytest tests/test_navegador.py
"""

import functools
import http.server
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import ClassVar

import pytest

DIST = Path(__file__).resolve().parents[1] / "interfaz" / "dist"
playwright = pytest.importorskip("playwright.sync_api")
if not (DIST / "index.html").exists() or not any(DIST.glob("assets/duckdb-eh*.wasm")):
    pytest.skip("falta construir la app con VITE_DUCKDB=local", allow_module_level=True)


class _Servidor(http.server.SimpleHTTPRequestHandler):
    extensions_map: ClassVar[dict[str, str]] = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
    }

    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def url():
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(_Servidor, directory=str(DIST)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{servidor.server_address[1]}/"
    servidor.shutdown()


@pytest.fixture(scope="module")
def navegador():
    with playwright.sync_playwright() as p:
        try:
            b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM") or None)
        except Exception as e:  # sin Chromium instalado
            pytest.skip(f"no hay Chromium para Playwright: {e}")
        yield b
        b.close()


@pytest.fixture
def pagina(navegador):
    pg = navegador.new_page(viewport={"width": 1280, "height": 900})
    errores: list[str] = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    yield pg
    pg.close()
    assert not errores


def test_las_ocho_consultas_dan_lo_publicado(pagina, url):
    pagina.goto(f"{url}#caso-uci")
    pagina.get_by_role("button", name="Correr las 8 consultas aquí").click()
    pagina.get_by_text("8 de 8 iguales a resultados/").wait_for(timeout=180_000)
    estados = pagina.locator("section[id] [role=status]").all_inner_texts()
    assert len(estados) == 8
    assert all("mismo resultado que" in e for e in estados), estados


def test_la_consola_corre_sql_y_muestra_errores(pagina, url):
    pagina.goto(f"{url}#consola")
    pagina.get_by_role("button", name="Ventas por día de la semana").click()
    pagina.get_by_role("button", name="Correr", exact=True).click()
    resultado = pagina.locator("section[aria-label=Resultado]")
    resultado.get_by_role("status").wait_for(timeout=120_000)
    assert resultado.get_by_role("status").inner_text().startswith("7 filas")
    assert resultado.locator("tbody tr").first.inner_text().startswith("lunes")
    resultado.get_by_role("tab", name="Gráfico").click()
    resultado.locator(".grafico svg").wait_for()

    pagina.evaluate("location.hash = '#consola?sql=' + encodeURIComponent('SELECT * FROM ventaz')")
    pagina.get_by_role("button", name="Correr", exact=True).click()
    alerta = pagina.get_by_role("alert")
    alerta.wait_for()
    assert 'Did you mean "ventas"' in alerta.inner_text()


def test_mis_ventas_con_el_csv_de_ejemplo(pagina, url):
    # el CSV de la papelería: punto y coma, fechas dd-mm-aaaa, pesos con punto de miles, devoluciones negativas
    pagina.goto(url)
    assert "Chile · CLP · Datos simulados" in pagina.locator("main").inner_text()
    pagina.get_by_role("link", name="Probar el ejemplo chileno").click()
    pagina.get_by_role("button", name="Cargar ejemplo chileno").click()
    pagina.get_by_role("button", name="Analizar mis ventas").click(timeout=180_000)
    pagina.get_by_role("heading", name="Tu informe").wait_for(timeout=180_000)
    limpieza = pagina.locator("#mi-limpieza").inner_text()
    assert "18.812 líneas" in limpieza
    assert "227 de ellas son devoluciones" in limpieza
    assert "La venta neta es $\u00a084,12\u00a0M" in limpieza
    # las ocho secciones, cada una con su respuesta
    assert pagina.locator("section[id^=mi-] h2").count() == 8
    assert "Santiago" in pagina.locator("#mi-lugares").inner_text()

    # la consola queda con las vistas del archivo propio, y se puede volver a la tienda de ejemplo
    pagina.evaluate("location.hash = '#consola?sql=' + encodeURIComponent('SELECT count(*) AS n FROM lineas')")
    pagina.get_by_role("button", name="Correr", exact=True).click()
    resultado = pagina.locator("section[aria-label=Resultado]")
    resultado.get_by_role("status").wait_for(timeout=60_000)
    assert resultado.locator("tbody td").first.inner_text().replace(".", "") == "18812"


def test_mis_ventas_con_un_excel(pagina, url, tmp_path):
    # un Excel con los encabezados del Online Retail original, fechas como fechas de Excel y una devolución
    openpyxl = pytest.importorskip("openpyxl")
    libro = openpyxl.Workbook()
    hoja = libro.active
    hoja.title = "Ventas"
    hoja.append(["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"])
    productos = [("A1", "Taza", 3.5), ("B2", "Plato", 6.25), ("C3", "Vaso", 2.0)]
    filas = []
    for i in range(30):
        codigo, nombre, precio = productos[i % 3]
        cantidad = 1 + i % 4
        filas.append(
            (
                f"F{100 + i // 2}",
                codigo,
                nombre,
                cantidad,
                datetime(2024, 1 + i // 10, 1 + i % 10, 9 + i % 8),
                precio,
                500 + i % 6,
                "Chile" if i % 3 else "Perú",
            )
        )
    filas.append(("F200", "A1", "Taza", -2, datetime(2024, 3, 20, 12), 3.5, 501, "Chile"))  # devolución
    filas.append(("F201", "B2", "Plato", 1, datetime(2024, 3, 21, 12), 0, 502, "Chile"))  # precio cero: queda fuera
    for f in filas:
        hoja.append(list(f))
    for celda in hoja["E"][1:]:
        celda.number_format = "dd/mm/yyyy hh:mm"
    archivo = tmp_path / "ventas.xlsx"
    libro.save(archivo)
    neta = sum(f[3] * f[5] for f in filas)

    pagina.goto(f"{url}#mis-ventas")
    pagina.locator("input[type=file]").set_input_files(archivo)
    pagina.get_by_role("button", name="Analizar mis ventas").click(timeout=180_000)
    pagina.get_by_role("heading", name="Tu informe").wait_for(timeout=180_000)
    limpieza = pagina.locator("#mi-limpieza").inner_text()
    assert "32 líneas y 31 son líneas de producto válidas; una de ellas es una devolución" in limpieza
    assert "Quedó fuera 1 línea sin precio o con precio cero" in limpieza
    assert "Chile" in pagina.locator("#mi-lugares").inner_text()

    pagina.evaluate("location.hash = '#consola?sql=' + encodeURIComponent('SELECT sum(monto) AS neta FROM lineas')")
    pagina.get_by_role("button", name="Correr", exact=True).click()
    resultado = pagina.locator("section[aria-label=Resultado]")
    resultado.get_by_role("status").wait_for(timeout=60_000)
    celda = resultado.locator("tbody td").first.inner_text()
    assert float(celda.replace(".", "").replace(",", ".").replace("\u00a0", "")) == pytest.approx(neta)
