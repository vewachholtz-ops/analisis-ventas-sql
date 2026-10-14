"""Inventa las ventas de una papelería para probar «Usar mis ventas» (interfaz/public/datos/ventas-ejemplo.csv).

Es un archivo como los que exporta un punto de venta chileno, distinto a Online Retail II a propósito: separador
punto y coma, fechas día-mes-año, precios en pesos con punto de miles, encabezados en español, comuna en vez de país
y devoluciones como cantidades negativas en notas de crédito. Los datos son inventados (semilla fija): marzo, la
vuelta a clases, y diciembre son los meses fuertes, y algunos productos se compran juntos.

Uso: uv run python scripts/ventas_ejemplo.py
"""

from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

DESTINO = Path(__file__).resolve().parents[1] / "interfaz" / "public" / "datos" / "ventas-ejemplo.csv"

PRODUCTOS = [
    # (sku, nombre, precio en pesos, peso de venta)
    ("CU100", "Cuaderno universitario 100 hojas", 2490, 10),
    ("CU060", "Cuaderno college 60 hojas", 1290, 9),
    ("FO010", "Forro plástico cuaderno (10 un.)", 1990, 5),
    ("LA012", "Lápices de colores 12 un.", 2990, 7),
    ("LA024", "Lápices de colores 24 un.", 5490, 4),
    ("GR001", "Lápiz grafito HB", 390, 9),
    ("GO001", "Goma de borrar", 490, 7),
    ("SA001", "Sacapuntas con depósito", 990, 5),
    ("ES001", "Estuche dos cierres", 6990, 3),
    ("MO010", "Mochila escolar", 24990, 2),
    ("CA001", "Calculadora científica", 15990, 1),
    ("RE030", "Regla 30 cm", 790, 4),
    ("CO012", "Corrector en cinta", 1490, 3),
    ("DE010", "Destacadores 6 colores", 3490, 4),
    ("CI005", "Cinta adhesiva transparente", 890, 4),
    ("PE010", "Pegamento en barra", 990, 6),
    ("TI001", "Tijera escolar punta roma", 1290, 3),
    ("BL100", "Block de dibujo N° 99", 1990, 5),
    ("TE012", "Témperas 12 colores", 3990, 3),
    ("PI006", "Pinceles escolares (6 un.)", 2490, 2),
    ("CA010", "Cartulinas de colores (10 un.)", 1790, 3),
    ("PA500", "Resma papel carta 500 hojas", 4990, 6),
    ("CA024", "Carpeta con acoclip", 990, 4),
    ("AG001", "Agenda anual", 8990, 2),
    ("CA100", "Calendario de escritorio", 5990, 1),
    ("TA001", "Tarjeta de saludo", 1990, 3),
    ("PA010", "Papel de regalo (pliego)", 790, 4),
    ("BO001", "Bolsa de regalo mediana", 1490, 3),
    ("JU001", "Juego de mesa familiar", 19990, 1),
    ("RO001", "Rompecabezas 1000 piezas", 12990, 1),
    ("LI001", "Libro para colorear", 4990, 2),
    ("PL001", "Plumones permanentes (4 un.)", 2990, 3),
    ("NO001", "Notas adhesivas", 1490, 4),
    ("CL100", "Clips (caja de 100)", 690, 2),
    ("CO001", "Corchetera mediana", 4490, 1),
    ("CO100", "Corchetes (caja)", 890, 2),
    ("TI100", "Tinta para timbre", 1990, 1),
    ("AR001", "Archivador lomo ancho", 2990, 2),
]
# pares que se compran juntos: (sku, sku, probabilidad de agregar el segundo si se compró el primero)
JUNTOS = [
    ("CU100", "FO010", 0.45),
    ("CU060", "FO010", 0.40),
    ("GR001", "GO001", 0.55),
    ("GR001", "SA001", 0.30),
    ("TE012", "PI006", 0.60),
    ("BL100", "TE012", 0.35),
    ("CO001", "CO100", 0.70),
    ("TA001", "BO001", 0.40),
    ("PA010", "TA001", 0.30),
]
COMUNAS = [
    ("Ñuñoa", 6),
    ("Providencia", 5),
    ("Santiago", 5),
    ("La Florida", 4),
    ("Maipú", 4),
    ("Las Condes", 3),
    ("Puente Alto", 3),
    ("Despacho a regiones", 2),
]
# cuánto se vende cada mes, relativo (marzo: vuelta a clases; diciembre: Navidad)
ESTACION = {1: 0.6, 2: 1.4, 3: 2.6, 4: 1.0, 5: 0.9, 6: 0.8, 7: 1.0, 8: 0.9, 9: 0.8, 10: 0.9, 11: 1.1, 12: 1.9}


def main() -> None:
    azar = random.Random(20260913)
    pesos = [p[3] for p in PRODUCTOS]
    clientes = [f"C-{i:05d}" for i in range(1, 2201)]
    fieles = clientes[:260]  # vuelven seguido
    comuna_de = {c: azar.choices([n for n, _ in COMUNAS], [w for _, w in COMUNAS])[0] for c in clientes}
    filas = []
    boleta = 41000
    nota = 1200
    dia = datetime(2023, 1, 2)
    fin = datetime(2025, 4, 18)
    crecimiento = 1.0
    while dia <= fin:
        if dia.weekday() == 6:  # cerrado los domingos
            dia += timedelta(days=1)
            continue
        crecimiento *= 1.0006
        n_boletas = max(0, int(azar.gauss(9 * ESTACION[dia.month] * crecimiento, 3)))
        for _ in range(n_boletas):
            boleta += 1
            hora = dia.replace(hour=azar.randint(10, 19), minute=azar.randint(0, 59))
            cliente = (
                azar.choice(fieles) if azar.random() < 0.35 else azar.choice(clientes) if azar.random() < 0.7 else ""
            )
            skus = set()
            for _ in range(max(1, int(azar.expovariate(1 / 1.8)))):
                skus.add(azar.choices(PRODUCTOS, pesos)[0][0])
            for a, b, prob in JUNTOS:
                if a in skus and azar.random() < prob:
                    skus.add(b)
            for sku in sorted(skus):
                _, nombre, precio, _ = next(p for p in PRODUCTOS if p[0] == sku)
                cantidad = 1 if precio > 5000 else azar.choice([1, 1, 1, 2, 2, 3, 5])
                filas.append(
                    (f"B-{boleta}", hora, sku, nombre, cantidad, precio, cliente, comuna_de.get(cliente, "Santiago"))
                )
                if azar.random() < 0.012:  # una devolución unos días después
                    nota += 1
                    filas.append(
                        (
                            f"NC-{nota}",
                            hora + timedelta(days=azar.randint(1, 10)),
                            sku,
                            nombre,
                            -cantidad,
                            precio,
                            cliente,
                            comuna_de.get(cliente, "Santiago"),
                        )
                    )
        dia += timedelta(days=1)
    filas.sort(key=lambda f: (f[1], f[0], f[2]))
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    with DESTINO.open("w", encoding="utf-8-sig", newline="") as archivo:  # con BOM, como lo guarda Excel
        escritor = csv.writer(archivo, delimiter=";")
        escritor.writerow(
            ["N° documento", "Fecha", "SKU", "Producto", "Cantidad", "Precio unitario", "Cliente", "Comuna"]
        )
        for doc, fecha, sku, nombre, cantidad, precio, cliente, comuna in filas:
            precio_txt = f"{precio:,}".replace(",", ".")
            escritor.writerow(
                [doc, fecha.strftime("%d-%m-%Y %H:%M"), sku, nombre, cantidad, precio_txt, cliente, comuna]
            )
    print(f"{len(filas):,} líneas en {DESTINO} ({DESTINO.stat().st_size / 1e6:.1f} MB)".replace(",", "."))


if __name__ == "__main__":
    main()
