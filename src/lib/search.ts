/**
 * Plain-text search helpers, shared by the in-note find bar and the "search all notes" screen.
 * Matching is always case-insensitive; "whole word" only tightens ASCII word boundaries.
 */
import type { Folder, Note } from './types'

export interface SearchOptions {
  wholeWord: boolean
}

export interface MatchRange {
  from: number
  to: number
}

export interface SearchHit {
  noteId: string
  /** note title as stored (may be empty for an untitled note) */
  title: string
  /** folder path, empty for the root */
  path: string
  /** 1-based line number */
  line: number
  /** document offset of the first match on this line */
  offset: number
  /** line text trimmed for display, with ellipses when it was shortened */
  text: string
  /** match ranges relative to `text` */
  ranges: MatchRange[]
}

export interface SearchGroup {
  noteId: string
  title: string
  path: string
  hits: SearchHit[]
  /** matching lines that are not listed */
  more: number
}

export interface SearchResult {
  groups: SearchGroup[]
  /** number of listed matching lines */
  lines: number
  /** true when the scan stopped at a limit */
  truncated: boolean
}

/** safety caps so a very large note cannot freeze typing */
export const MAX_IN_NOTE_MATCHES = 5000
const PER_NOTE_LINES = 20
const MAX_RESULT_LINES = 300
const PER_NOTE_SCAN = 2000
const SNIPPET_MAX = 160

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A fresh global regex per search; null when the query is empty. */
export function makeMatcher(query: string, opts: SearchOptions): RegExp | null {
  if (!query) return null
  const head = opts.wholeWord && /^\w/.test(query) ? '\\b' : ''
  const tail = opts.wholeWord && /\w$/.test(query) ? '\\b' : ''
  return new RegExp(head + escapeRegex(query) + tail, 'gi')
}

/** All non-overlapping matches in `text`, in ascending order. */
export function findMatches(text: string, query: string, opts: SearchOptions, limit = MAX_IN_NOTE_MATCHES): MatchRange[] {
  const re = makeMatcher(query, opts)
  if (!re) return []
  const out: MatchRange[] = []
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ from: m.index, to: m.index + m[0].length })
    if (out.length >= limit) break
  }
  return out
}

/**
 * One display line with its match ranges. Leading indentation is removed; a line longer than
 * `max` is shortened around the first match and gets "…" on the clipped side(s).
 */
export function snippetOf(line: string, ranges: MatchRange[], max = SNIPPET_MAX): { text: string; ranges: MatchRange[] } {
  const indent = /^[ \t]*/.exec(line)?.[0].length ?? 0
  let from = indent
  let to = line.trimEnd().length
  if (to < from) to = from
  if (to - from > max) {
    const first = ranges.find((r) => r.from >= from)?.from ?? from
    from = Math.min(Math.max(indent, first - 40), Math.max(indent, to - max))
    to = Math.min(to, from + max)
  }
  const prefix = from > indent ? '…' : ''
  const suffix = to < line.trimEnd().length ? '…' : ''
  const shift = from - prefix.length
  const text = prefix + line.slice(from, to) + suffix
  const shifted = ranges
    .map((r) => ({ from: r.from - shift, to: r.to - shift }))
    .filter((r) => r.from >= 0 && r.to <= text.length && r.to > r.from)
  return { text, ranges: shifted }
}

/** Search every note line by line; notes with no match are omitted. */
export function searchNotes(notes: Note[], folders: Folder[], query: string, opts: SearchOptions): SearchResult {
  const groups: SearchGroup[] = []
  let lines = 0
  let truncated = false
  if (!query) return { groups, lines, truncated }

  const byId = new Map(folders.map((f) => [f.id, f]))
  const pathCache = new Map<string, string>()
  const pathOf = (id: string | null): string => {
    if (!id) return ''
    const cached = pathCache.get(id)
    if (cached !== undefined) return cached
    const parts: string[] = []
    const seen = new Set<string>()
    let cur = byId.get(id)
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      parts.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    const out = parts.join(' / ')
    pathCache.set(id, out)
    return out
  }

  for (const note of notes) {
    if (note.deleted) continue
    const hits: SearchHit[] = []
    let matching = 0
    let offset = 0
    let scanned = 0
    const source = note.content.split('\n')
    for (let i = 0; i < source.length; i++) {
      const line = source[i]
      const ranges = findMatches(line, query, opts, 200)
      scanned += ranges.length
      if (ranges.length) {
        matching++
        if (hits.length < PER_NOTE_LINES) {
          const snip = snippetOf(line, ranges)
          hits.push({
            noteId: note.id,
            title: note.title,
            path: pathOf(note.folderId),
            line: i + 1,
            offset: offset + ranges[0].from,
            text: snip.text,
            ranges: snip.ranges,
          })
        }
      }
      offset += line.length + 1
      if (scanned >= PER_NOTE_SCAN) {
        truncated = true
        break
      }
    }
    if (!hits.length) continue
    const room = MAX_RESULT_LINES - lines
    const shown = hits.slice(0, room)
    if (!shown.length) {
      truncated = true
      break
    }
    if (shown.length < hits.length) truncated = true
    groups.push({ noteId: note.id, title: note.title, path: pathOf(note.folderId), hits: shown, more: Math.max(0, matching - shown.length) })
    lines += shown.length
    if (truncated || lines >= MAX_RESULT_LINES) {
      truncated = true
      break
    }
  }
  return { groups, lines, truncated }
}
