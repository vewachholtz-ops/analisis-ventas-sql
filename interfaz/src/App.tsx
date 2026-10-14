// Mostrador: el informe (portada y ocho secciones) y la consola SQL, en una sola página. La dirección decide qué se
// ve: #consola abre la consola (con ?sql=… trae una consulta), cualquier otra cosa es el informe y su sección.
import { Check, ExternalLink, Menu, Monitor, Moon, SquareTerminal, Sun, Upload, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { useEstadoDuckDB, useFuente } from './lib/duckdb'
import { cambiarTema, type Tema, useTema } from './lib/tema'
import { cn } from './lib/utiles'
import { INDICE, Informe } from './secciones/Informe'
import { Portada, REPO } from './secciones/Portada'

// la consola (CodeMirror y DuckDB) y «Usar mis ventas» se bajan solo si alguien los abre
const Consola = lazy(() => import('./consola/Consola').then((m) => ({ default: m.Consola })))
const MisVentas = lazy(() => import('./misdatos/MisVentas').then((m) => ({ default: m.MisVentas })))

function useHash() {
  return useSyncExternalStore(
    (o) => {
      addEventListener('hashchange', o)
      return () => removeEventListener('hashchange', o)
    },
    () => location.hash,
  )
}

/** La sección del informe que se está leyendo, para marcarla en el índice. */
function useSeccionActiva(activo: boolean) {
  const [id, setId] = useState('inicio')
  useEffect(() => {
    if (!activo) return
    const elementos = ['inicio', ...INDICE.map((s) => s.id)].map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[]
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setId(e.target.id)
      },
      { rootMargin: '-25% 0px -70% 0px' },
    )
    elementos.forEach((e) => observador.observe(e))
    return () => observador.disconnect()
  }, [activo])
  return id
}

export function App() {
  const hash = useHash()
  const enConsola = hash.startsWith('#consola')
  const enMisVentas = hash.startsWith('#mis-ventas')
  const pagina = enConsola ? 'consola' : enMisVentas ? 'mis-ventas' : 'informe'
  const sql = enConsola ? (new URLSearchParams(hash.split('?')[1] ?? '').get('sql') ?? undefined) : undefined
  const activa = useSeccionActiva(pagina === 'informe')
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    setMenu(false)
    if (pagina !== 'informe') return void scrollTo(0, 0)
    const destino = hash.length > 1 ? document.getElementById(hash.slice(1)) : null
    if (destino) destino.scrollIntoView()
    else if (!hash) scrollTo(0, 0)
  }, [hash, pagina])

  useEffect(() => {
    document.title = pagina === 'consola' ? 'Consola SQL · Mostrador' : pagina === 'mis-ventas' ? 'Usar mis ventas · Mostrador' : 'Mostrador · Ventas con SQL'
  }, [pagina])

  return (
    <div className="mx-auto flex max-w-[88rem]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r px-5 py-6 lg:flex">
        <Marca />
        <Indice activa={pagina === 'informe' ? activa : pagina} />
        <div className="mt-auto space-y-5 pt-8">
          <EstadoSql />
          <SelectorTema />
          <Credito />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-fondo/90 px-4 backdrop-blur lg:hidden">
          <Marca compacta />
          <a
            href={enConsola ? '#inicio' : '#consola'}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-medium text-acento hover:bg-hundida"
          >
            {enConsola ? 'Informe' : (
              <>
                <SquareTerminal className="size-4" aria-hidden />
                Consola
              </>
            )}
          </a>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="menu-movil"
            aria-label={menu ? 'Cerrar el índice' : 'Abrir el índice'}
            className="inline-flex size-9 items-center justify-center rounded-md text-tinta-suave hover:bg-hundida"
          >
            {menu ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </header>
        {menu && (
          <div id="menu-movil" className="fixed inset-x-0 top-14 bottom-0 z-10 overflow-y-auto border-t bg-fondo px-4 pt-4 pb-10 lg:hidden">
            <Indice activa={pagina === 'informe' ? activa : pagina} />
            <div className="mt-8 space-y-5">
              <EstadoSql />
              <SelectorTema />
              <Credito />
            </div>
          </div>
        )}

        <main className={cn('mx-auto px-4 pt-8 sm:px-8 lg:px-14 lg:pt-14', pagina === 'informe' ? 'max-w-[60rem]' : 'max-w-[80rem]')}>
          {pagina === 'consola' ? (
            <Suspense fallback={<p className="pt-2 text-tinta-tenue">Abriendo la consola…</p>}>
              <Consola sqlInicial={sql} />
            </Suspense>
          ) : pagina === 'mis-ventas' ? (
            <Suspense fallback={<p className="pt-2 text-tinta-tenue">Abriendo…</p>}>
              <MisVentas />
            </Suspense>
          ) : (
            <>
              <Portada />
              <Informe />
            </>
          )}
        </main>
        <Pie ancho={pagina === 'informe' ? 'max-w-[60rem]' : 'max-w-[80rem]'} />
      </div>
    </div>
  )
}

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <a href="#inicio" className="flex items-center gap-2.5 rounded-md" aria-label="Mostrador, ir al inicio">
      <img src="./mostrador.svg" alt="" className={compacta ? 'size-7' : 'size-8'} />
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-[-0.01em]">Mostrador</span>
        {!compacta && <span className="block text-[12.5px] text-tinta-tenue">Ventas con SQL</span>}
      </span>
    </a>
  )
}

function Indice({ activa }: { activa: string }) {
  const enlace = (marcado: boolean) =>
    cn(
      'flex items-baseline gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] leading-snug text-tinta-suave transition-colors hover:bg-hundida hover:text-tinta',
      marcado && 'bg-acento-tinte font-medium text-tinta hover:bg-acento-tinte',
    )
  return (
    <nav aria-label="Índice" className="mt-8">
      <a href="#inicio" className={enlace(activa === 'inicio')} aria-current={activa === 'inicio' ? 'location' : undefined}>
        <span className="w-5" aria-hidden />
        Resumen
      </a>
      <ol className="mt-0.5 space-y-0.5">
        {INDICE.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={enlace(activa === s.id)} aria-current={activa === s.id ? 'location' : undefined}>
              <span className={cn('w-5 shrink-0 font-mono text-[11.5px] text-tinta-tenue', activa === s.id && 'text-acento')}>{s.archivo}</span>
              {s.titulo}
            </a>
          </li>
        ))}
      </ol>
      <a
        href="#mis-ventas"
        className={cn(enlace(activa === 'mis-ventas'), 'mt-4 items-center border border-dashed border-[var(--eje)] py-2')}
        aria-current={activa === 'mis-ventas' ? 'page' : undefined}
      >
        <Upload className="size-4 w-5 shrink-0 text-acento" aria-hidden />
        Usar mis ventas
      </a>
      <a
        href="#consola"
        className={cn(enlace(activa === 'consola'), 'mt-1.5 items-center border border-dashed border-[var(--eje)] py-2')}
        aria-current={activa === 'consola' ? 'page' : undefined}
      >
        <SquareTerminal className="size-4 w-5 shrink-0 text-acento" aria-hidden />
        Consola SQL
      </a>
    </nav>
  )
}

function EstadoSql() {
  const e = useEstadoDuckDB()
  const fuente = useFuente()
  return (
    <div className="text-[12.5px] leading-snug">
      <p className="font-medium text-tinta">SQL en tu navegador</p>
      {fuente.tipo === 'mios' && <p className="mt-0.5 text-tinta-suave">Con tus datos: {fuente.config.archivo}</p>}
      <p className={cn('mt-0.5 text-tinta-tenue', e.fase === 'error' && 'text-baya')} role="status">
        {e.fase === 'sin-cargar' && 'DuckDB se carga cuando corres la primera consulta.'}
        {e.fase === 'cargando' && `${e.paso}${e.avance !== undefined ? ` ${Math.round(e.avance * 100)} %` : ''}…`}
        {e.fase === 'lista' && (
          <span className="inline-flex items-center gap-1 text-acento">
            <Check className="size-3.5" aria-hidden />
            Listo: DuckDB {e.version.replace(/^v/, '')}
          </span>
        )}
        {e.fase === 'error' && `No cargó: ${e.mensaje}`}
      </p>
    </div>
  )
}

const TEMAS: { valor: Tema; texto: string; icono: typeof Sun }[] = [
  { valor: 'claro', texto: 'Claro', icono: Sun },
  { valor: 'oscuro', texto: 'Oscuro', icono: Moon },
  { valor: 'sistema', texto: 'Sistema', icono: Monitor },
]

function SelectorTema() {
  const [tema] = useTema()
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-md border bg-superficie p-0.5">
      {TEMAS.map(({ valor, texto, icono: Icono }) => (
        <button
          key={valor}
          role="radio"
          aria-checked={tema === valor}
          aria-label={texto}
          title={texto}
          onClick={() => cambiarTema(valor)}
          className={cn(
            'inline-flex h-7 w-9 items-center justify-center rounded-[5px] text-tinta-tenue hover:text-tinta',
            tema === valor && 'bg-hundida text-tinta',
          )}
        >
          <Icono className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}

function Credito() {
  return (
    <p className="text-[12px] leading-snug text-tinta-tenue">
      Datos:{' '}
      <a href="https://doi.org/10.24432/C5CG6D" target="_blank" rel="noreferrer" className="underline decoration-[var(--eje)] underline-offset-2 hover:text-tinta">
        Online Retail II
      </a>{' '}
      (Daqing Chen, UCI), licencia CC BY 4.0.
    </p>
  )
}

function Pie({ ancho }: { ancho: string }) {
  return (
    <footer className={cn('mx-auto mt-6 px-4 text-[13px] text-tinta-tenue sm:px-8 lg:px-14', ancho)}>
      <div className="border-t py-8">
      <p className="max-w-[70ch]">
        Hecho por Vicente Wachholtz Reyes con DuckDB, Observable Plot y CodeMirror. Las consultas están en{' '}
        <a href={`${REPO}/tree/main/sql`} target="_blank" rel="noreferrer" className="text-acento hover:underline">
          sql/
        </a>{' '}
        y los resultados publicados, en{' '}
        <a href={`${REPO}/tree/main/resultados`} target="_blank" rel="noreferrer" className="text-acento hover:underline">
          resultados/
        </a>
        .
      </p>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-tinta">
          Código en GitHub
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a href="./licencias.txt" className="hover:text-tinta">
          Licencias de terceros
        </a>
      </p>
      </div>
    </footer>
  )
}
