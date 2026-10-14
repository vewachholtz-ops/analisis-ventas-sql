// SQL con colores (CodeMirror 6): solo para leer en el informe, o para escribir y correr en la consola.
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { PostgreSQL, sql } from '@codemirror/lang-sql'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'
import { ESQUEMA } from '../lib/esquema'

const colores = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--acento)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--baya)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--acento-hondo)' },
  { tag: tags.comment, color: 'var(--tinta-tenue)', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--tinta-suave)' },
  { tag: tags.typeName, color: 'var(--acento-hondo)' },
])

function base() {
  return [sql({ dialect: PostgreSQL, schema: ESQUEMA, upperCaseKeywords: true }), syntaxHighlighting(colores), EditorView.lineWrapping]
}

export function SqlVista({ codigo }: { codigo: string }) {
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!caja.current) return
    const vista = new EditorView({
      parent: caja.current,
      state: EditorState.create({ doc: codigo.trim(), extensions: [...base(), EditorState.readOnly.of(true), EditorView.editable.of(false)] }),
    })
    return () => vista.destroy()
  }, [codigo])
  return <div ref={caja} className="max-h-[28rem] overflow-auto rounded-md bg-hundida/60 px-1 py-2" />
}

export function Editor({
  valor,
  alCambiar,
  alCorrer,
}: {
  valor: string
  alCambiar: (v: string) => void
  alCorrer: () => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  const vista = useRef<EditorView | null>(null)
  const ultimos = useRef({ alCambiar, alCorrer })
  ultimos.current = { alCambiar, alCorrer }
  useEffect(() => {
    if (!caja.current) return
    vista.current = new EditorView({
      parent: caja.current,
      state: EditorState.create({
        doc: valor,
        extensions: [
          ...base(),
          lineNumbers(),
          history(),
          placeholder('Escribe una consulta: SELECT … FROM ventas'),
          keymap.of([
            { key: 'Mod-Enter', run: () => (ultimos.current.alCorrer(), true) },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => u.docChanged && ultimos.current.alCambiar(u.state.doc.toString())),
          EditorView.contentAttributes.of({ 'aria-label': 'Consulta SQL' }),
        ],
      }),
    })
    return () => vista.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // un ejemplo elegido desde afuera reemplaza el texto
  useEffect(() => {
    const v = vista.current
    if (v && v.state.doc.toString() !== valor) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valor } })
  }, [valor])
  return <div ref={caja} className="min-h-48 overflow-auto [&_.cm-content]:min-h-44" />
}
