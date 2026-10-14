"""Corre las consultas de sql/ en orden sobre Online Retail II y guarda tablas y gráficos.

Uso: uv run ventas    (descarga los datos la primera vez, unos 45 MB)
"""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb
import matplotlib
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import FuncFormatter, PercentFormatter

from .cargar import preparar

RAIZ = Path(__file__).resolve().parents[2]
SQL = RAIZ / "sql"

# los colores de la app web (Mostrador): un verde para el dato, gris para el contexto
TEMAS = {
    "claro": {
        "fondo": "#fcfdfb",
        "texto": "#16211c",
        "texto2": "#4c5852",
        "grilla": "#e3e8e4",
        "dato": "#138a61",
        "contexto": "#b5beb8",
        "enfasis": "#0a5238",
        "rampa": ["#e6f2ec", "#94cbb1", "#2f8d67", "#13704d", "#0a5238"],
    },
    "oscuro": {
        "fondo": "#151d19",
        "texto": "#e5ece8",
        "texto2": "#b0bdb5",
        "grilla": "#222d27",
        "dato": "#2f9a73",
        "contexto": "#4a5852",
        "enfasis": "#8bd7b6",
        "rampa": ["#1c3329", "#22644b", "#4fa07c", "#7fc1a1", "#b6e0cb"],
    },
}


def conectar(parquet: Path | str) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(f"CREATE VIEW crudo AS SELECT * FROM read_parquet('{Path(parquet).as_posix()}')")
    return con


def correr(con: duckdb.DuckDBPyConnection, carpeta: Path = SQL) -> dict[str, pd.DataFrame]:
    """Ejecuta cada archivo .sql en orden; el resultado de su última consulta queda en el diccionario."""
    return {f.stem: con.execute(f.read_text(encoding="utf-8")).df() for f in sorted(carpeta.glob("*.sql"))}


def curva_abc(con: duckdb.DuckDBPyConnection, puntos: int = 300) -> pd.DataFrame:
    """Curva de Pareto de la vista `abc` (corre después de 02_abc_productos.sql), con a lo más `puntos`
    filas para el tablero: el primer y el último producto siempre quedan, y el resto a intervalos iguales."""
    # redondeada: el acumulado en punto flotante cambia en el último decimal según el orden en que se suma
    curva = con.execute(
        "SELECT ranking, round(ranking / count(*) OVER (), 6) AS pct_productos, round(acum, 6) AS acum, clase "
        "FROM abc ORDER BY ranking"
    ).df()
    paso = max(1, len(curva) // puntos)
    return curva[(curva.index % paso == 0) | (curva.index == len(curva) - 1)].reset_index(drop=True)


# ---------------- gráficos ----------------
def _figura(tema: dict, titulo: str, ancho: float = 8, alto: float = 4.2):
    fig, ax = plt.subplots(figsize=(ancho, alto), dpi=150)
    fig.patch.set_facecolor(tema["fondo"])
    ax.set_facecolor(tema["fondo"])
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(tema["grilla"])
    ax.tick_params(colors=tema["texto2"], labelsize=9)
    ax.set_title(titulo, loc="left", color=tema["texto"], fontsize=12, fontweight="bold", pad=12)
    return fig, ax


MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _mes(d) -> str:
    return f"{MESES[d.month - 1]} {d.year}"


def _miles(v, _):
    return f"{v / 1000:,.0f} mil".replace(",", ".")


def graficar(res: dict[str, pd.DataFrame], con: duckdb.DuckDBPyConnection, carpeta: Path) -> None:
    mensual = res["01_ventas_mensuales"]
    completo = mensual[~mensual["mes_parcial"]]
    curva = con.execute("SELECT ranking / count(*) OVER () AS pct_productos, acum FROM abc ORDER BY ranking").df()
    coh = res["04_cohortes"]
    matriz = coh[coh["meses_desde"].between(1, 12)].pivot(
        index="cohorte", columns="meses_desde", values="retencion_pct"
    )
    matriz = matriz[matriz.index < pd.Timestamp("2010-12-01")]  # cohortes con sus 12 meses siguientes completos
    rfm = res["03_rfm_clientes"].sort_values("pct_ventas")

    for nombre, t in TEMAS.items():
        # 1. ventas netas por mes
        fig, ax = _figura(t, "Ventas netas por mes (libras)")
        ax.grid(axis="y", color=t["grilla"], linewidth=0.8)
        ax.set_axisbelow(True)
        ax.plot(completo["mes"], completo["ventas_netas"], color=t["dato"], linewidth=2, marker="o", markersize=4)
        ax.yaxis.set_major_formatter(FuncFormatter(_miles))
        nov = completo[pd.to_datetime(completo["mes"]).dt.month == 11]
        ax.plot(
            nov["mes"],
            nov["ventas_netas"],
            linestyle="none",
            marker="o",
            markersize=8,
            color=t["enfasis"],
            markeredgecolor=t["fondo"],
            markeredgewidth=1.5,
        )
        primero = nov.iloc[0]
        ax.annotate(
            "noviembre: el máximo de cada año, antes de Navidad",
            (primero["mes"], primero["ventas_netas"]),
            xytext=(12, 0),
            textcoords="offset points",
            va="center",
            color=t["texto"],
            fontsize=8.5,
        )
        marcas = pd.to_datetime(completo["mes"])[::3]
        ax.set_xticks(marcas, [_mes(d) for d in marcas])
        ax.text(
            1,
            -0.16,
            "Dic-2011 se omite: el dataset termina el día 9.",
            transform=ax.transAxes,
            ha="right",
            color=t["texto2"],
            fontsize=7.5,
        )
        fig.tight_layout()
        fig.savefig(carpeta / f"ventas-mensuales-{nombre}.png", facecolor=t["fondo"])
        plt.close(fig)

        # 2. curva de Pareto (ABC)
        fig, ax = _figura(t, "Curva ABC: qué parte de los productos hace las ventas")
        ax.grid(color=t["grilla"], linewidth=0.8)
        ax.set_axisbelow(True)
        ax.plot(curva["pct_productos"], curva["acum"], color=t["dato"], linewidth=2)
        for corte, etiqueta in ((0.80, "A: 80 % de las ventas"), (0.95, "B: hasta 95 %")):
            x = curva.loc[curva["acum"] >= corte, "pct_productos"].iloc[0]
            ax.plot([x, x], [0, corte], color=t["texto2"], linestyle="--", linewidth=1)
            ax.plot([0, x], [corte, corte], color=t["texto2"], linestyle="--", linewidth=1)
            ax.text(
                x + 0.015,
                corte - 0.09,
                f"{etiqueta}\ncon el {round(100 * x)} % de los productos",
                color=t["texto"],
                fontsize=8.5,
            )
        ax.xaxis.set_major_formatter(PercentFormatter(1, decimals=0))
        ax.yaxis.set_major_formatter(PercentFormatter(1, decimals=0))
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1.02)
        ax.set_xlabel("Productos, de mayor a menor venta", color=t["texto2"], fontsize=9)
        ax.set_ylabel("Ventas acumuladas", color=t["texto2"], fontsize=9)
        fig.tight_layout()
        fig.savefig(carpeta / f"curva-abc-{nombre}.png", facecolor=t["fondo"])
        plt.close(fig)

        # 3. retención por cohorte
        fig, ax = _figura(t, "Retención: % de clientes de cada cohorte que vuelve a comprar", ancho=8, alto=4.8)
        mapa = LinearSegmentedColormap.from_list("rampa", t["rampa"])
        im = ax.imshow(matriz.values, cmap=mapa, vmin=0, vmax=50, aspect="auto")
        ax.set_xticks(range(matriz.shape[1]), [str(c) for c in matriz.columns])
        ax.set_yticks(range(matriz.shape[0]), [_mes(d) for d in matriz.index])
        for i in range(matriz.shape[0]):
            for j in range(matriz.shape[1]):
                v = matriz.values[i, j]
                if pd.isna(v):
                    continue
                claro = (v > 30) if nombre == "claro" else (v < 30)
                ax.text(j, i, f"{v:.0f}", ha="center", va="center", fontsize=7, color="#ffffff" if claro else "#16211c")
        ax.set_xlabel("Meses desde la primera compra", color=t["texto2"], fontsize=9)
        for s in ax.spines.values():
            s.set_visible(False)
        barra = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
        barra.ax.tick_params(colors=t["texto2"], labelsize=8)
        barra.outline.set_visible(False)
        barra.set_label("% que vuelve a comprar", color=t["texto2"], fontsize=8)
        fig.tight_layout()
        fig.savefig(carpeta / f"cohortes-{nombre}.png", facecolor=t["fondo"])
        plt.close(fig)

        # 4. segmentos RFM: % de clientes y % de ventas
        fig, ax = _figura(t, "Segmentos RFM: cuántos clientes son y cuánto venden")
        ax.grid(axis="x", color=t["grilla"], linewidth=0.8)
        ax.set_axisbelow(True)
        y = range(len(rfm))
        ax.barh([i + 0.2 for i in y], rfm["pct_clientes"], height=0.36, color=t["contexto"], label="% de los clientes")
        ax.barh([i - 0.2 for i in y], rfm["pct_ventas"], height=0.36, color=t["dato"], label="% de las ventas")
        for i, (pc, pv) in enumerate(zip(rfm["pct_clientes"], rfm["pct_ventas"], strict=True)):
            ax.text(pc + 0.8, i + 0.2, f"{pc:.0f} %", va="center", color=t["texto2"], fontsize=8)
            ax.text(pv + 0.8, i - 0.2, f"{pv:.0f} %", va="center", color=t["texto2"], fontsize=8)
        ax.set_yticks(list(y), rfm["segmento"])
        ax.tick_params(axis="y", length=0)
        ax.legend(frameon=False, labelcolor=t["texto2"], fontsize=8.5, loc="lower right")
        fig.tight_layout()
        fig.savefig(carpeta / f"rfm-{nombre}.png", facecolor=t["fondo"])
        plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", type=Path, default=RAIZ / "datos")
    ap.add_argument("--salida", type=Path, default=RAIZ / "resultados")
    args = ap.parse_args()
    args.salida.mkdir(parents=True, exist_ok=True)

    con = conectar(preparar(args.datos))
    res = correr(con)
    for nombre, df in res.items():
        df.to_csv(args.salida / f"{nombre}.csv", index=False)
    curva_abc(con).to_csv(args.salida / "02_abc_curva.csv", index=False)  # para el tablero
    graficar(res, con, args.salida)
    print(res["00_limpieza"].T.to_string(header=False))
    print(f"\nTablas y gráficos en {args.salida}")


if __name__ == "__main__":
    main()
