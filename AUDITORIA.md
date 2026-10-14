# Auditoría del portafolio · 2026-10-09

Autor: Codex. Solicitud: revisar la propuesta de publicación de Claude, auditar y mejorar el proyecto.

## Resultado

Vitrina estática preparada para GitHub Pages. Conserva el análisis SQL, los CSV y gráficos originales y la app local Streamlit. No se ha publicado todavía: este checkout no tiene origin configurado.

## Cambios y decisiones

- `web/` contiene estilos y navegación; `scripts/construir_sitio.py` exporta a `site/`.
- Siete secciones con resultados descargables y las ocho consultas, incluyendo limpieza. Ordenación de tablas por teclado o ratón; navegación con enlaces y estado en la URL.
- KPI calculados desde resultados existentes: £18,98 M, crecimiento 1,8 %, 5.852 clientes y 4.877 productos.
- Texto aclara que diciembre de 2011 es parcial y que los hallazgos no prueban efectos causales ni rentabilidad.
- HTML escapa tanto texto como atributos. Prueba con contenido malicioso en celdas y cabeceras.
- Fuente Nunito local con su licencia, sin CDN ni proceso Python durante la visita.
- CI comprueba formato, análisis estático, pruebas y vigencia del sitio; Pages publica solo `site/`.
- `.gitattributes` fija LF para evitar diferencias entre Windows y Linux. `PUBLICACION.md` explica generación, vista previa y despliegue.

## Verificación

Baseline: 12 pruebas. Final: **14 aprobadas**. Ruff y formato aprobados. Generador `--check` aprobado.

Prueba de mutación: eliminar el escape de una celda hace fallar la prueba de seguridad; archivo restaurado después. Se conservaron los bytes de los CSV publicados y se comprobaron todos los enlaces locales del HTML.

Navegador real: navegación entre ventas y ABC; vista de escritorio y móvil; sin desbordamiento global en 320, 768, 1024 y 1440 px. Las tablas tienen su propio desplazamiento horizontal. Evidencia visual en `../ecosistema/knowledge/research/2026-10-09-portafolio/`.

## Pendientes para Claude

1. Publicar según `PUBLICACION.md`, verificar el enlace público en ventana privada y solo entonces incorporarlo al CV/perfil.
2. Opcional: presentar nombres de columnas más comerciales y Sí/No en lugar de booleanos; conservar el CSV original descargable.
3. Opcional: PBIX con capturas como proyecto complementario si el puesto objetivo pide Power BI; no reemplaza esta evidencia de SQL.

La auditoría cubre motores, pruebas, exportación y presentación. No volvió a descargar ni ejecutar todo el dataset de más de un millón de filas; la vitrina usa los resultados existentes y las pruebas del motor. No es una certificación de accesibilidad ni un benchmark de producción.

## Revisión de Claude · 2026-10-09

Revisé el generador, los estilos y las pruebas, y la página en 1440 y 390 px. Lo de Codex quedó; cambia la presentación.

- **Encabezado:** la página abría con el nombre del autor y una etiqueta en mayúsculas, como un sitio personal. Ahora abre con el análisis; el nombre salió del encabezado y del título de la pestaña, y el pie enlaza a los otros proyectos.
- **Gráficos:** los PNG de matplotlib (fondo crema, otra fuente, texto chico en el teléfono) se reemplazan por los mismos gráficos de la app, que pasaron a `src/ventas/graficos.py` y los usan la app y la vitrina. Se exportan como Vega-Lite y se dibujan con vega, vega-lite y vega-embed copiados en `web/vendor/` (licencia BSD, sin CDN). Tienen el ancho de la página y detalle al pasar el mouse.
- **Tablas:** nombres de columna legibles, meses como «dic 2009», libras y porcentajes en formato chileno, números alineados a la derecha; se ordenan por el valor original. Los CSV descargables siguen siendo los originales (pendiente 2 de Codex).
- **Diseño:** indicadores en un solo panel, pestañas subrayadas, hallazgo de cada sección como primera frase del panel. El HTML de la página está en `web/plantilla.html`; el generador solo llena valores.
- **Generador:** borra de `site/` los archivos que ya no produce (los cuatro PNG), y `--check` falla si sobran.

Pruebas: **16 aprobadas** (14 antes). Nuevas: los gráficos son Vega-Lite con los datos dentro de la página; la página no carga scripts ni estilos externos; formato y orden de las celdas.
