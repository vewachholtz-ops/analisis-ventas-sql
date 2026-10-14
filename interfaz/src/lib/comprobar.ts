// «Correr en tu navegador»: vuelve a correr una consulta del informe con DuckDB y la compara con su tabla publicada
// en ../resultados. El estado es compartido: la portada puede correr las ocho y cada sección muestra lo suyo.
import { useSyncExternalStore } from 'react'
import { CONSULTAS, type IdConsulta } from './datos'
import { correr, diferencia, usarFuente } from './duckdb'

export type Comprobacion =
  | { fase: 'nada' }
  | { fase: 'corriendo' }
  | { fase: 'lista'; ms: number; filas: number; distinta: string | null }
  | { fase: 'error'; mensaje: string }

export const ORDEN = Object.keys(CONSULTAS) as IdConsulta[]
const NADA: Comprobacion = { fase: 'nada' }
let estados: Partial<Record<IdConsulta, Comprobacion>> = {}
let todas = false
const oyentes = new Set<() => void>()

function publicar(id: IdConsulta, c: Comprobacion) {
  estados = { ...estados, [id]: c }
  oyentes.forEach((o) => o())
}
function suscribir(o: () => void) {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

export function useComprobacion(id: IdConsulta): Comprobacion {
  return useSyncExternalStore(suscribir, () => estados[id] ?? NADA)
}
export function useComprobaciones() {
  return useSyncExternalStore(suscribir, () => estados)
}
export function useCorriendoTodas() {
  return useSyncExternalStore(suscribir, () => todas)
}

export async function comprobar(id: IdConsulta) {
  if (estados[id]?.fase === 'corriendo') return
  publicar(id, { fase: 'corriendo' })
  try {
    // las tablas publicadas son de la tienda de ejemplo: las vistas vuelven a ella
    await usarFuente({ tipo: 'ejemplo' })
    const r = await correr(CONSULTAS[id].sql)
    publicar(id, { fase: 'lista', ms: r.ms, filas: r.total, distinta: diferencia(r.filas, CONSULTAS[id].publicada) })
  } catch (error) {
    publicar(id, { fase: 'error', mensaje: (error as Error).message })
  }
}

/** Las ocho, una tras otra (en el orden en que se publicaron). */
export async function comprobarTodas() {
  if (todas) return
  todas = true
  oyentes.forEach((o) => o())
  try {
    for (const id of ORDEN) await comprobar(id)
  } finally {
    todas = false
    oyentes.forEach((o) => o())
  }
}
