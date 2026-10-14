import { estiloBoton } from '../componentes/ui'

export function Inicio() {
  return (
    <section className="pt-2 pb-12">
      <h1 className="text-[2.35rem] leading-tight font-semibold tracking-[-0.025em]">Ventas con SQL</h1>
      <p className="mt-4 max-w-[58ch] text-[1.1rem] text-tinta-suave">
        Analiza ventas, productos, clientes y devoluciones. Puedes revisar las consultas y usar un CSV o Excel propio.
      </p>
      <div className="mt-8 rounded-xl border bg-superficie p-6">
        <p className="text-[13px] font-medium text-acento">Chile · CLP · Datos simulados</p>
        <h2 className="mt-2 text-2xl font-semibold">Una papelería en Santiago</h2>
        <p className="mt-3 max-w-[58ch] text-tinta-suave">
          Cuadernos, útiles y artículos de oficina, con precios en pesos chilenos y ventas por comuna.
          El archivo incluye devoluciones y temporadas escolares; no corresponde a un negocio real.
        </p>
        <a href="#mis-ventas" className={`${estiloBoton('principal')} mt-5`}>Probar el ejemplo chileno</a>
      </div>
      <div className="mt-6 border-t pt-6">
        <h2 className="text-lg font-semibold">Caso real: una tienda del Reino Unido</h2>
        <p className="mt-2 max-w-[58ch] text-tinta-suave">
          Análisis del conjunto público Online Retail II (2009–2011). Los importes originales están en libras esterlinas (GBP).
        </p>
        <a href="#caso-uci" className={`${estiloBoton('contorno')} mt-4`}>Ver el caso británico</a>
      </div>
    </section>
  )
}
