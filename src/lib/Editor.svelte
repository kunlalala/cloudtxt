<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { Compartment, EditorState, Prec, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
  import {
    Decoration,
    EditorView,
    ViewPlugin,
    WidgetType,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    type DecorationSet,
    type ViewUpdate,
  } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, indentMore, indentLess } from '@codemirror/commands'
  import {
    foldGutter,
    foldKeymap,
    foldService,
    foldEffect,
    unfoldEffect,
    foldable,
    foldedRanges,
    indentUnit,
    bracketMatching,
  } from '@codemirror/language'
  import { HEADING_RE, HEADING_COLORS, HEADING_SIZES, STRONG_COLOR, strongRegex, outlineOf, type OutlineItem } from './headings'
  import { imageUrl } from './images'
  import { findMatches, type MatchRange } from './search'

  let {
    noteId,
    content,
    tabSize,
    remoteStamp,
    getFolds,
    onfolds,
    onoutline,
    oncursor,
    onchange,
    onimagefiles,
    onimageopen,
    onimagemissing,
  }: {
    noteId: string
    content: string
    tabSize: number
    /** changes when a sync replaced this note's text from another device */
    remoteStamp: number
    /** saved folded line numbers for a note */
    getFolds: (id: string) => number[]
    onfolds: (id: string, lines: number[]) => void
    /** headings of the open note; called when they change */
    onoutline: (items: OutlineItem[]) => void
    /** line number (1-based) of the cursor; called when it changes */
    oncursor: (line: number) => void
    onchange: (v: string) => void
    /** images pasted or dropped into the editor */
    onimagefiles: (files: File[]) => void
    /** the user clicked an image, show it large */
    onimageopen: (id: string) => void
    /** a token points at an image this device does not have (yet) */
    onimagemissing: () => void
  } = $props()

  let host: HTMLDivElement
  let view: EditorView | undefined
  const tabs = new Compartment()

  /** Fold a line when the following non-blank lines are indented deeper than it. */
  const indentFold = foldService.of((state, from, to) => {
    const doc = state.doc
    const tab = state.tabSize
    const indentOf = (text: string) => {
      let col = 0
      for (const ch of text) {
        if (ch === ' ') col++
        else if (ch === '\t') col += tab - (col % tab)
        else break
      }
      return col
    }
    const line = doc.lineAt(from)
    if (!line.text.trim()) return null
    const base = indentOf(line.text)
    let end = -1
    for (let n = line.number + 1; n <= doc.lines; n++) {
      const next = doc.line(n)
      if (!next.text.trim()) continue
      if (indentOf(next.text) <= base) break
      end = next.to
    }
    return end > to ? { from: to, to: end } : null
  })

  /**
   * Headings: a line starting (after optional indentation) with 1-6 "#" and a space. The "#" marks
   * are hidden (except on the line being edited) and the line is drawn larger and coloured per level.
   */
  const HEADING = HEADING_RE
  const headingLines = Array.from({ length: 6 }, (_, i) => Decoration.line({ class: `cm-h cm-h${i + 1}` }))
  // keeps the indentation as wide as on normal lines, even though the heading text is bigger
  const hideMarks = Decoration.replace({})
  const strongMark = Decoration.mark({ class: 'cm-strong' })

  const headings = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view)
      }
      build(view: EditorView) {
        const b = new RangeSetBuilder<Decoration>()
        const { doc, selection } = view.state
        let last = -1
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos)
            pos = line.to + 1
            if (line.from <= last) continue
            last = line.from
            const m = HEADING.exec(line.text)
            if (!m) continue
            b.add(line.from, line.from, headingLines[m[2].length - 1])
            const editing = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from)
            if (!editing) b.add(line.from + m[1].length, line.from + m[0].length, hideMarks)
          }
        }
        return b.finish()
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) =>
        EditorView.atomicRanges.of((view) => view.plugin(p)?.decorations ?? Decoration.none),
    },
  )

  /**
   * Strong: "!!text!!" is drawn red and bold. The "!!" marks are hidden except on the line being
   * edited. Only the replace ranges are atomic; the text between them stays editable.
   */
  const strong = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      atoms: DecorationSet
      constructor(view: EditorView) {
        ;({ decorations: this.decorations, atoms: this.atoms } = this.build(view))
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet)
          ({ decorations: this.decorations, atoms: this.atoms } = this.build(u.view))
      }
      build(view: EditorView) {
        const all = new RangeSetBuilder<Decoration>()
        const atoms = new RangeSetBuilder<Decoration>()
        const { doc, selection } = view.state
        let last = -1
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos)
            pos = line.to + 1
            if (line.from <= last) continue
            last = line.from
            if (!line.text.includes('!!')) continue
            const editing = selection.ranges.some((r) => r.from <= line.to && r.to >= line.from)
            for (const m of line.text.matchAll(strongRegex())) {
              const s = line.from + m.index
              const e = s + m[0].length
              if (editing) {
                all.add(s, e, strongMark)
              } else {
                all.add(s, s + 2, hideMarks)
                all.add(s + 2, e - 2, strongMark)
                all.add(e - 2, e, hideMarks)
                atoms.add(s, s + 2, hideMarks)
                atoms.add(e - 2, e, hideMarks)
              }
            }
          }
        }
        return { decorations: all.finish(), atoms: atoms.finish() }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) => EditorView.atomicRanges.of((view) => view.plugin(p)?.atoms ?? Decoration.none),
    },
  )

  /**
   * Wrapped lines keep their indentation (hanging indent) and a long word can no longer leave an
   * empty row behind the indentation:
   * - the line gets padding-left = indentation and a matching negative text-indent, so the
   *   continuation rows start under the first character of the text;
   * - the leading whitespace is one unbreakable piece, so the line cannot wrap right after it;
   * - it is measured in the normal font (--cw is one "ch" of the editor font, resolved on
   *   .cm-content), so a bigger heading or CJK text does not change the indent width.
   */
  const lead = (tab: number) =>
    Decoration.mark({
      class: 'cm-lead',
      attributes: { style: `tab-size: calc(${tab} * 1ch)` },
    })

  const layout = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.startState.tabSize !== u.state.tabSize)
          this.decorations = this.build(u.view)
      }
      build(view: EditorView) {
        const b = new RangeSetBuilder<Decoration>()
        const { doc, tabSize } = view.state
        const mark = lead(tabSize)
        const hang = new Map<number, Decoration>()
        let last = -1
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos)
            pos = line.to + 1
            if (line.from <= last) continue
            last = line.from
            const text = line.text
            let end = 0
            let cols = 0
            while (end < text.length && (text[end] === ' ' || text[end] === '\t')) {
              cols += text[end] === '\t' ? tabSize - (cols % tabSize) : 1
              end++
            }
            if (!end || end === text.length) continue
            let d = hang.get(cols)
            if (!d) {
              d = Decoration.line({
                attributes: {
                  style: `padding-left: calc(12px + var(--cw) * ${cols}); text-indent: calc(var(--cw) * -${cols})`,
                },
              })
              hang.set(cols, d)
            }
            b.add(line.from, line.from, d)
            b.add(line.from, line.from + end, mark)
          }
        }
        return b.finish()
      }
    },
    { decorations: (v) => v.decorations },
  )

  /**
   * Images: [[img:<id>]] is replaced by the picture itself, except on the line being edited, so
   * the token can be deleted or copied like ordinary text.
   */
  /** ids already reported as missing, so scrolling does not schedule sync over and over */
  const reportedMissing = new Set<string>()

  class ImageWidget extends WidgetType {
    id: string
    open: (id: string) => void

    constructor(id: string, open: (id: string) => void) {
      super()
      this.id = id
      this.open = open
    }
    eq(other: ImageWidget) {
      return other.id === this.id
    }
    toDOM() {
      const box = document.createElement('span')
      box.className = 'cm-img'
      const img = document.createElement('img')
      img.alt = 'image'
      img.decoding = 'async'
      img.loading = 'lazy'
      img.addEventListener('click', (e) => {
        e.preventDefault()
        this.open(this.id)
      })
      box.appendChild(img)
      void imageUrl(this.id).then((url) => {
        if (url) img.src = url
        else {
          box.textContent = '[image not available]'
          box.classList.add('cm-img-missing')
          if (!reportedMissing.has(this.id)) {
            reportedMissing.add(this.id)
            onimagemissing()
          }
        }
      })
      return box
    }
    /** let the widget keep the click instead of the editor moving the cursor onto the line */
    ignoreEvent() {
      return true
    }
  }

  const images = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view)
      }
      build(view: EditorView) {
        const b = new RangeSetBuilder<Decoration>()
        const { doc, selection } = view.state
        let last = -1
        for (const { from, to } of view.visibleRanges) {
          for (let pos = from; pos <= to; ) {
            const line = doc.lineAt(pos)
            pos = line.to + 1
            if (line.from <= last) continue
            last = line.from
            if (selection.ranges.some((r) => r.from <= line.to && r.to >= line.from)) continue
            for (const m of line.text.matchAll(/\[\[img:([a-z0-9]+)\]\]/gi)) {
              const start = line.from + (m.index ?? 0)
              b.add(start, start + m[0].length, Decoration.replace({ widget: new ImageWidget(m[1], openImage) }))
            }
          }
        }
        return b.finish()
      }
    },
    { decorations: (v) => v.decorations },
  )

  function openImage(id: string) {
    onimageopen(id)
  }

  /** pick image files out of a clipboard or drop event */
  function imageFiles(list: FileList | null | undefined): File[] {
    return list ? [...list].filter((f) => f.type.startsWith('image/')) : []
  }

  const imagePaste = EditorView.domEventHandlers({
    paste: (event) => {
      const files = imageFiles(event.clipboardData?.files)
      if (!files.length) return false
      event.preventDefault()
      onimagefiles(files)
      return true
    },
    drop: (event) => {
      const files = imageFiles(event.dataTransfer?.files)
      if (!files.length) return false
      event.preventDefault()
      onimagefiles(files)
      return true
    },
  })

  // ---- find in note ---------------------------------------------------
  let findOpen = $state(false)
  let findQuery = $state('')
  let findWholeWord = $state(false)
  let findTotal = $state(0)
  /** 0-based index of the current match; -1 when there is none */
  let findIndex = $state(-1)
  let findInput = $state<HTMLInputElement>()
  /** non-reactive copy for the decoration effect */
  let findHits: MatchRange[] = []

  const findMatchMark = Decoration.mark({ class: 'cm-find-match' })
  const findCurrentMark = Decoration.mark({ class: 'cm-find-current' })
  const setFindMarks = StateEffect.define<{ matches: MatchRange[]; current: number }>()

  const findHighlight = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(deco, tr) {
      for (const effect of tr.effects) {
        if (!effect.is(setFindMarks)) continue
        const b = new RangeSetBuilder<Decoration>()
        for (let i = 0; i < effect.value.matches.length; i++) {
          const m = effect.value.matches[i]
          b.add(m.from, m.to, i === effect.value.current ? findCurrentMark : findMatchMark)
        }
        return b.finish()
      }
      return deco.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
  })

  function paintFind(current: number) {
    view?.dispatch({ effects: setFindMarks.of({ matches: findHits, current }) })
  }

  /** Select a match (without focusing the editor) and scroll it into view. */
  function revealMatch(i: number) {
    if (!view || i < 0 || i >= findHits.length) return
    const m = findHits[i]
    const effects: StateEffect<unknown>[] = [EditorView.scrollIntoView(m.from, { y: 'center', yMargin: 8 })]
    foldedRanges(view.state).between(m.from, m.from, (from, to) => {
      if (from <= m.from && to >= m.from) effects.push(unfoldEffect.of({ from, to }))
    })
    view.dispatch({ selection: { anchor: m.from, head: m.to }, effects })
  }

  /**
   * Rebuild the match list. 'nearest' jumps to the first match at or after `from` (typing in the
   * box or arriving from the global search), 'keep' only refreshes highlights after an edit so the
   * cursor does not move while typing in the note.
   */
  function recomputeFind(mode: 'nearest' | 'keep', from = 0) {
    if (!view) return
    findHits = findOpen && findQuery ? findMatches(view.state.doc.toString(), findQuery, { wholeWord: findWholeWord }) : []
    findTotal = findHits.length
    if (!findTotal) {
      findIndex = -1
      paintFind(-1)
      return
    }
    if (mode === 'nearest') {
      const at = findHits.findIndex((m) => m.from >= from)
      findIndex = at < 0 ? 0 : at
      paintFind(findIndex)
      revealMatch(findIndex)
    } else {
      if (findIndex < 0 || findIndex >= findTotal) findIndex = 0
      paintFind(findIndex)
    }
  }

  function stepFind(delta: number) {
    if (!view || !findTotal) return
    findIndex = (findIndex + delta + findTotal) % findTotal
    paintFind(findIndex)
    revealMatch(findIndex)
  }

  async function focusFind() {
    await tick()
    // on a phone focusing would pop up the keyboard right over the note
    if (window.matchMedia('(min-width: 768px)').matches) findInput?.focus()
  }

  /** Used by Ctrl/Cmd+F; prefills with the selected text when it is on one line. */
  export function openFind() {
    if (!view) return
    const sel = view.state.selection.main
    const picked = sel.to > sel.from ? view.state.sliceDoc(sel.from, sel.to) : ''
    if (picked && !picked.includes('\n')) findQuery = picked
    findOpen = true
    recomputeFind('nearest', sel.from)
    void focusFind()
  }

  /** Used by the global search screen: open here and select the match at `offset`. */
  export function findInNote(query: string, opts: { wholeWord: boolean }, offset = 0) {
    if (!view) return
    findOpen = true
    findQuery = query
    findWholeWord = opts.wholeWord
    recomputeFind('nearest', offset)
    void focusFind()
  }

  function resetFind() {
    findOpen = false
    findTotal = 0
    findIndex = -1
    findHits = []
  }

  export function closeFind() {
    resetFind()
    if (!view) return
    view.dispatch({ effects: setFindMarks.of({ matches: [], current: -1 }) })
    if (window.matchMedia('(min-width: 768px)').matches) view.focus()
  }

  const theme = EditorView.theme(
    {
      '&': { height: '100%', color: 'var(--fg)', backgroundColor: 'var(--bg)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: 'var(--mono)', fontSize: 'var(--ed-size)', lineHeight: '1.6', overflow: 'auto' },
      '.cm-content': { padding: '12px 0', caretColor: 'var(--fg)', '--cw': '1ch' },
      '.cm-line': { padding: '0 12px', overflowWrap: 'anywhere' },
      '.cm-h': { fontWeight: '700' },
      '.cm-strong': { color: STRONG_COLOR, fontWeight: '700' },
      '.cm-find-match': { backgroundColor: 'rgba(230,192,123,0.22)', borderRadius: '2px' },
      '.cm-find-current': { backgroundColor: '#e6c07b', color: '#1e2127', borderRadius: '2px' },
      '.cm-img': { display: 'inline-block', maxWidth: '100%', verticalAlign: 'middle' },
      '.cm-img img': {
        display: 'block',
        maxWidth: '100%',
        maxHeight: '60vh',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        cursor: 'zoom-in',
      },
      '.cm-img-missing': { color: '#ff6b6b', fontSize: '0.9em' },
      '.cm-lead': { fontSize: 'var(--ed-size)', fontWeight: '400', whiteSpace: 'pre' },
      '.cm-h1': { fontSize: HEADING_SIZES[0], color: HEADING_COLORS[0] },
      '.cm-h2': { fontSize: HEADING_SIZES[1], color: HEADING_COLORS[1] },
      '.cm-h3': { fontSize: HEADING_SIZES[2], color: HEADING_COLORS[2] },
      '.cm-h4': { fontSize: HEADING_SIZES[3], color: HEADING_COLORS[3] },
      '.cm-h5': { fontSize: HEADING_SIZES[4], color: HEADING_COLORS[4] },
      '.cm-h6': { fontSize: HEADING_SIZES[5], color: HEADING_COLORS[5] },
      '.cm-cursor': { borderLeftColor: 'var(--fg)' },
      '.cm-gutters': { backgroundColor: 'var(--bg)', color: 'var(--muted)', border: 'none' },
      '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
      '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--fg)' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(97,175,239,0.3)',
      },
      '.cm-foldGutter': { minWidth: '28px' },
      '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', textAlign: 'center' },
      '.cm-fold-marker': { display: 'inline-block', width: '28px', color: 'var(--muted)', userSelect: 'none' },
      '.cm-fold-marker:hover': { color: 'var(--fg)' },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--hover)',
        border: 'none',
        color: 'var(--muted)',
        padding: '0 6px',
      },
    },
    { dark: true },
  )

  function marker(open: boolean) {
    const el = document.createElement('span')
    el.className = 'cm-fold-marker'
    el.textContent = open ? '▾' : '▸'
    el.title = open ? 'Fold' : 'Unfold'
    return el
  }

  function createState(doc: string) {
    return EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        foldGutter({ markerDOM: marker }),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        bracketMatching(),
        indentUnit.of('\t'),
        tabs.of(EditorState.tabSize.of(tabSize)),
        EditorView.lineWrapping,
        Prec.high(indentFold),
        headings,
        strong,
        images,
        imagePaste,
        layout,
        findHighlight,
        theme,
        keymap.of([indentWithTab, ...foldKeymap, ...historyKeymap, ...defaultKeymap]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            onchange(u.state.doc.toString())
            emitOutline(u.state)
            // rebuild highlights after the update (dispatching inside it is not allowed) but
            // never move the cursor while the user is typing in the note
            if (findOpen) queueMicrotask(() => view && recomputeFind('keep'))
          }
          if (u.docChanged || u.selectionSet) emitCursor(u.state)
          const foldChanged = u.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)))
          if (!restoring && (u.docChanged || foldChanged)) onfolds(current, foldedLines(u.state))
        }),
      ],
    })
  }

  let outlineKey = ''
  function emitOutline(state: EditorState, force = false) {
    const doc = state.doc
    const items = outlineOf({ count: doc.lines, text: (n) => doc.line(n).text })
    const key = JSON.stringify(items)
    if (!force && key === outlineKey) return
    outlineKey = key
    onoutline(items)
  }

  let cursorLine = -1
  function emitCursor(state: EditorState, force = false) {
    const line = state.doc.lineAt(state.selection.main.head).number
    if (!force && line === cursorLine) return
    cursorLine = line
    oncursor(line)
  }

  /** Used by the phone toolbar, which has no Ctrl+Z or Tab key. */
  export function run(cmd: 'undo' | 'redo' | 'indent' | 'unindent') {
    if (!view) return
    const c = { undo, redo, indent: indentMore, unindent: indentLess }[cmd]
    c(view)
  }

  /** Move the cursor to a line and scroll it to the top; folded blocks that hide it are opened. */
  export function goToLine(line: number) {
    if (!view) return
    const st = view.state
    const pos = st.doc.line(Math.min(Math.max(line, 1), st.doc.lines)).from
    const effects: StateEffect<unknown>[] = [EditorView.scrollIntoView(pos, { y: 'start', yMargin: 8 })]
    foldedRanges(st).between(pos, pos, (from, to) => {
      if (from <= pos && to >= pos) effects.push(unfoldEffect.of({ from, to }))
    })
    view.dispatch({ selection: { anchor: pos }, effects })
    // on a phone, focusing would pop up the keyboard
    if (window.matchMedia('(min-width: 768px)').matches) view.focus()
  }

  /** Folds are saved as the line numbers of folded lines, so they survive offset changes. */
  function foldedLines(state: EditorState) {
    const lines: number[] = []
    foldedRanges(state).between(0, state.doc.length, (from) => {
      lines.push(state.doc.lineAt(from).number)
    })
    return lines
  }

  let restoring = false
  function restoreFolds(id: string) {
    if (!view) return
    const st = view.state
    const effects = []
    for (const n of getFolds(id)) {
      if (n < 1 || n > st.doc.lines) continue
      const line = st.doc.line(n)
      const range = foldable(st, line.from, line.to)
      if (range) effects.push(foldEffect.of(range))
    }
    if (!effects.length) return
    restoring = true
    try {
      view.dispatch({ effects })
    } finally {
      restoring = false
    }
  }

  onMount(() => {
    view = new EditorView({ state: createState(content), parent: host })
    restoreFolds(current)
    emitOutline(view.state, true)
    emitCursor(view.state, true)
    return () => view?.destroy()
  })

  // Swap the document only when another note is opened (history is per note switch).
  let current = untrack(() => noteId)
  $effect(() => {
    const id = noteId
    if (!view || id === current) return
    current = id
    resetFind()
    view.setState(untrack(() => createState(content)))
    view.scrollDOM.scrollTop = 0
    restoreFolds(id)
    emitOutline(view.state, true)
    emitCursor(view.state, true)
  })

  $effect(() => {
    const n = tabSize
    view?.dispatch({ effects: tabs.reconfigure(EditorState.tabSize.of(n)) })
  })

  // Text that arrived from another device is shown only when the user is not typing in this
  // note; if they are, the next sync round carries their text up instead.
  function applyRemote() {
    if (!view || host.contains(document.activeElement)) return
    const next = untrack(() => content)
    if (next === view.state.doc.toString()) return
    const head = Math.min(view.state.selection.main.head, next.length)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: { anchor: head },
    })
    emitOutline(view.state, true)
    emitCursor(view.state, true)
  }

  let remoteSeen = untrack(() => remoteStamp)
  $effect(() => {
    const stamp = remoteStamp
    if (stamp === remoteSeen) return
    remoteSeen = stamp
    applyRemote()
  })

  /**
   * Insert image tokens at the cursor, keeping the indentation of the current line so an image
   * inside an outline item stays at that depth. On an empty or indentation-only line the tokens
   * simply continue that indentation (no blank line is added); when real text is before or after
   * the cursor the tokens go on their own line first.
   */
  export function insertImageTokens(ids: string[]) {
    if (!view || !ids.length) return
    const state = view.state
    const sel = state.selection.main
    const line = state.doc.lineAt(sel.from)
    const indent = /^[ \t]*/.exec(line.text)?.[0] ?? ''
    const before = state.doc.sliceString(line.from, sel.from)
    const after = state.doc.sliceString(sel.to, line.to)
    const block = ids.map((id) => `[[img:${id}]]`).join('\n' + indent)
    // a cursor inside the leading whitespace still must not split the indentation
    const from = before.trim() ? sel.from : Math.max(sel.from, line.from + indent.length)
    const to = Math.max(sel.to, from)
    const text = (before.trim() ? '\n' + indent : '') + block + (after.trim() ? '\n' + indent : '')

    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    })
    view.focus()
  }
</script>

<div class="wrap">
  <div class="editor" bind:this={host} onfocusout={() => setTimeout(applyRemote, 0)}></div>
  {#if findOpen}
    <div class="findbar" role="search" aria-label="Find in note">
      <input
        bind:this={findInput}
        value={findQuery}
        placeholder="Find in note"
        aria-label="Find in note"
        autocomplete="off"
        spellcheck="false"
        oninput={(e) => {
          findQuery = e.currentTarget.value
          recomputeFind('nearest', view?.state.selection.main.from ?? 0)
        }}
        onkeydown={(e) => {
          if (e.isComposing) return
          if (e.key === 'Enter') {
            e.preventDefault()
            stepFind(e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            closeFind()
          }
        }}
      />
      <button
        class="opt"
        class:on={findWholeWord}
        aria-pressed={findWholeWord}
        aria-label="Match whole word"
        title="Match whole word"
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => {
          findWholeWord = !findWholeWord
          recomputeFind('nearest', view?.state.selection.main.from ?? 0)
          findInput?.focus()
        }}>W</button
      >
      <span class="count" aria-live="polite">{findTotal ? `${findIndex + 1}/${findTotal}` : '0/0'}</span>
      <button class="nav" aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!findTotal} onpointerdown={(e) => e.preventDefault()} onclick={() => stepFind(-1)}>▴</button>
      <button class="nav" aria-label="Next match" title="Next match (Enter)" disabled={!findTotal} onpointerdown={(e) => e.preventDefault()} onclick={() => stepFind(1)}>▾</button>
      <button class="nav" aria-label="Close find" title="Close (Esc)" onpointerdown={(e) => e.preventDefault()} onclick={closeFind}>✕</button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    height: 100%;
    min-height: 0;
  }
  .editor {
    height: 100%;
    min-height: 0;
  }
  .findbar {
    position: absolute;
    top: 6px;
    right: 14px;
    left: auto;
    max-width: calc(100% - 20px);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .findbar input {
    flex: 1 1 120px;
    width: clamp(100px, 26vw, 240px);
    min-width: 0;
    height: 40px;
    min-height: 40px;
    padding: 0 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--fg);
    font: inherit;
    font-size: 16px;
  }
  .findbar input:focus {
    outline: none;
    border-color: var(--accent-line);
  }
  .findbar button {
    width: 44px;
    min-width: 44px;
    height: 40px;
    min-height: 40px;
    padding: 0;
    background: none;
    border: none;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }
  .findbar button:hover:not(:disabled) {
    color: var(--fg);
    background: var(--hover);
    border-radius: 8px;
  }
  .findbar .opt {
    font-weight: 700;
    font-size: 0.9rem;
  }
  .findbar .opt.on {
    color: var(--accent);
    background: var(--accent-fill);
    border-radius: 8px;
  }
  .findbar .count {
    min-width: 48px;
    padding: 0 2px;
    text-align: center;
    color: var(--muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  @media (max-width: 520px) {
    .findbar {
      left: 8px;
      right: 8px;
    }
  }
</style>
