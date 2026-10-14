# Publicar Mostrador en GitHub Pages

La app es una página estática: GitHub Actions la construye desde `interfaz/` y la publica con Pages. No hay servidor
ni datos fuera del repo.

## Probar antes de publicar

```bash
uv sync --locked
uv run ruff check . && uv run ruff format --check . && uv run pytest

cd interfaz
npm ci
npm run build          # la versión que se publica (DuckDB-WASM se baja de jsDelivr al abrir la página)
npx vite preview       # vista previa en http://localhost:4173
```

Para las pruebas en el navegador, construir con DuckDB incluido: `VITE_DUCKDB=local npm run build`, después
`uv run playwright install chromium` y `uv run pytest tests/test_navegador.py`.

Si cambian las consultas de `sql/`, volver a correr `uv run ventas` (actualiza `resultados/`) antes de construir: la app
compara lo que corre en el navegador con esas tablas.

## Publicación

1. Subir el repo a GitHub. El plan gratuito de Pages requiere un repo público.
2. En el repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Cada cambio en `interfaz/`, `sql/` o `resultados/` que llega a `main` vuelve a publicar la app
   ([`pages.yml`](.github/workflows/pages.yml)). También se puede correr a mano en **Actions → Publicar Mostrador → Run
   workflow**.
4. Comprobar la URL en una ventana privada: **https://vewachholtz-ops.github.io/analisis-ventas-sql/**

Se publica solo `interfaz/dist`: la página, las consultas, las tablas de `resultados/` y la copia de los datos
(`datos/online_retail_ii.arrow.gz`, 6 MB, con licencia CC BY 4.0).
