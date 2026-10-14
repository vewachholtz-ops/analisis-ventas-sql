"""Gráficos del análisis (Altair), compartidos por la app de Streamlit y la vitrina estática.

Cada función recibe una tabla de resultados/ y devuelve el gráfico con el tema del portafolio: Nunito,
grilla suave, azul para la serie principal y naranja para la comparación. Los números van en formato
chileno (miles con punto, decimales con coma, espacio antes de %).
"""

from __future__ import annotations

import altair as alt
import pandas as pd

AZUL, NARANJA, GRIS = "#2a78d6", "#d95926", "#8a94a3"
TINTA, TINTA_2, GRILLA, BASE, PANEL = "#1d2733", "#5a6675", "#e6eaef", "#c9d0d8", "#ffffff"
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
MILES = "replace(format(datum.value, ',d'), /,/g, '.')"
PORCENTAJE = "format(datum.value * 100, 'd') + ' %'"  # 0.8 -> "80 %"


def num(x: float, decimales: int = 0) -> str:
    """6081.3 -> "6.081"; 1.1446 -> "1,14"."""
    return f"{x:,.{decimales}f}".replace(",", "§").replace(".", ",").replace("§", ".")


def libras(x: float) -> str:
    return f"£ {num(x / 1e6, 2)} M" if abs(x) >= 1e6 else f"£ {num(x)}"


def pct(x: float, decimales: int = 1) -> str:
    """Un porcentaje ya multiplicado por 100: 84.5 -> "84,5 %"."""
    return f"{num(x, decimales)} %"


def mes(fecha: str) -> str:
    """ "2010-03-01" -> "mar 2010"."""
    a, m = fecha[:4], fecha[5:7]
    return f"{MESES[int(m) - 1]} {a}"


def estilo(grafico: alt.TopLevelMixin, titulo: str, alto: int = 320) -> alt.TopLevelMixin:
    return (
        grafico.properties(height=alto, title=titulo)
        .configure(font="Nunito, sans-serif", background="transparent")
        .configure_view(stroke=None)
        .configure_axis(
            labelColor=TINTA_2,
            titleColor=TINTA_2,
            labelFontSize=12.5,
            titleFontSize=12.5,
            titleFontWeight=600,
            gridColor=GRILLA,
            domainColor=BASE,
            tickColor=BASE,
        )
        .configure_legend(labelColor=TINTA_2, titleColor=TINTA_2, labelFontSize=12.5, orient="top")
        .configure_title(color=TINTA, fontSize=15, fontWeight=700, anchor="start", offset=12)
    )


def ventas_mensuales(mensual: pd.DataFrame) -> alt.TopLevelMixin:
    d = mensual.assign(
        Mes=mensual.mes.map(mes),
        Ventas=mensual.ventas_netas.map(libras),
        Pedidos=mensual.pedidos.map(num),
        Clientes=mensual.clientes.map(num),
        Ticket=mensual.ticket_promedio.map(lambda x: f"£ {num(x)}"),
        **{"Contra el año anterior": mensual.variacion_anual_pct.map(lambda x: "" if pd.isna(x) else pct(x))},
        Periodo=mensual.mes_parcial.map({False: "mes completo", True: "mes parcial"}),
    )
    meses_vega = "[" + ",".join(f"'{m}'" for m in MESES) + "]"
    eje_mes = alt.Axis(
        labelExpr=f"{meses_vega}[month(datum.value)] + ' ' + year(datum.value)", labelAngle=0, tickCount=8
    )
    x = alt.X("mes:T", title=None, axis=eje_mes)
    y = alt.Y("ventas_netas:Q", title="Ventas netas (£)", axis=alt.Axis(labelExpr=MILES))
    tooltip = ["Mes", "Ventas", "Pedidos", "Clientes", "Ticket", "Contra el año anterior", "Periodo"]
    linea = alt.Chart(d[~d.mes_parcial]).mark_line(color=AZUL, strokeWidth=2).encode(x=x, y=y)
    puntos = (
        alt.Chart(d)
        .mark_circle(size=60, stroke=PANEL, strokeWidth=2, opacity=1)
        .encode(
            x=x,
            y=y,
            color=alt.Color(
                "Periodo:N",
                scale=alt.Scale(domain=["mes completo", "mes parcial"], range=[AZUL, GRIS]),
                legend=alt.Legend(title=None),
            ),
            tooltip=tooltip,
        )
    )
    return estilo(alt.layer(linea, puntos), "Ventas netas por mes")


def curva_abc(curva: pd.DataFrame) -> alt.TopLevelMixin:
    curva = curva.assign(
        Productos=curva.pct_productos.map(lambda x: pct(100 * x)),
        Ventas=curva.acum.map(lambda x: pct(100 * x)),
        Clase=curva.clase,
    )
    base = alt.Chart(curva).encode(
        x=alt.X("pct_productos:Q", title="Productos, de más a menos vendido", axis=alt.Axis(labelExpr=PORCENTAJE)),
        y=alt.Y(
            "acum:Q", title="Ventas acumuladas", axis=alt.Axis(labelExpr=PORCENTAJE), scale=alt.Scale(domain=[0, 1])
        ),
    )
    area = base.mark_area(color=AZUL, opacity=0.10)
    linea = base.mark_line(color=AZUL, strokeWidth=2).encode(tooltip=["Productos", "Ventas", "Clase"])
    cortes = pd.DataFrame({"acum": [0.80, 0.95], "etiqueta": ["80 %: fin de la clase A", "95 %: fin de la clase B"]})
    reglas = alt.Chart(cortes).mark_rule(color=TINTA_2, strokeWidth=1).encode(y="acum:Q")
    textos = (
        alt.Chart(cortes)
        .mark_text(align="right", dy=12, fontSize=12, color=TINTA_2)
        .encode(y="acum:Q", x=alt.datum(0.98), text="etiqueta:N")
    )
    return estilo(alt.layer(area, linea, reglas, textos), "Curva ABC (Pareto)")


def segmentos_rfm(rfm: pd.DataFrame) -> alt.TopLevelMixin:
    larga = rfm.melt(
        id_vars=["segmento"], value_vars=["pct_clientes", "pct_ventas"], var_name="medida", value_name="pct"
    ).assign(
        Medida=lambda d: d.medida.map({"pct_clientes": "% de los clientes", "pct_ventas": "% de las ventas"}),
        Valor=lambda d: d.pct.map(pct),
    )
    barras = (
        alt.Chart(larga)
        .mark_bar(size=11, cornerRadiusTopRight=4, cornerRadiusBottomRight=4)
        .encode(
            y=alt.Y("segmento:N", sort=rfm.segmento.tolist(), title=None),
            yOffset=alt.YOffset("Medida:N", sort=["% de los clientes", "% de las ventas"]),
            x=alt.X("pct:Q", title=None, axis=alt.Axis(labelExpr="datum.value + ' %'", tickCount=7)),
            color=alt.Color(
                "Medida:N",
                scale=alt.Scale(domain=["% de los clientes", "% de las ventas"], range=[AZUL, NARANJA]),
                legend=alt.Legend(title=None),
            ),
            tooltip=["segmento", "Medida", "Valor"],
        )
    )
    puntas = barras.mark_text(align="left", dx=4, fontSize=11, color=TINTA_2).encode(
        text="Valor:N", color=alt.value(TINTA_2)
    )
    return estilo(alt.layer(barras, puntas), "Segmentos RFM: peso en clientes y en ventas")


def retencion(cohortes: pd.DataFrame) -> alt.TopLevelMixin:
    coh = cohortes[(cohortes.meses_desde >= 1) & (cohortes.meses_desde <= 12) & (cohortes.cohorte < "2010-12-01")]
    coh = coh.assign(Cohorte=coh.cohorte.map(mes), Retencion=coh.retencion_pct.map(pct))
    calor = (
        alt.Chart(coh)
        .mark_rect(stroke=PANEL, strokeWidth=2)
        .encode(
            x=alt.X("meses_desde:O", title="Meses después de la primera compra", axis=alt.Axis(labelAngle=0)),
            y=alt.Y("Cohorte:N", sort=[mes(c) for c in sorted(coh.cohorte.unique())], title="Primera compra"),
            color=alt.Color(
                "retencion_pct:Q",
                scale=alt.Scale(range=["#eef4fc", AZUL, "#123f75"]),
                legend=alt.Legend(title="Retención (%)", orient="right"),
            ),
            tooltip=[
                "Cohorte",
                alt.Tooltip("meses_desde:O", title="Meses después"),
                alt.Tooltip("Retencion", title="Siguen comprando"),
            ],
        )
    )
    return estilo(calor, "Retención por cohorte", alto=380)
