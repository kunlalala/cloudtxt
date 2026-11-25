/** Heading syntax and look, shared by the editor and the outline panel. */

/** indentation, 1-6 "#", then a space or Tab */
export const HEADING_RE = /^([ \t]*)(#{1,6})[ \t]+/

export const HEADING_COLORS = ['#e6c07b', '#7ec1f0', '#8fd19e', '#c3a6f0', '#f2a07b', '#9fb1c4']
export const STRONG_COLOR = '#ff6b6b'

/** "!!text!!": text starts and ends with a non-space; a fresh regex each time because of the g flag */
export const strongRegex = () => /!!(?=\S)([^\n]*?\S)!!/g
/** font size per level, relative to the normal text size; the values live in app.css (smaller on phones) */
export const HEADING_SIZES = ['var(--h1-size)', 'var(--h2-size)', 'var(--h3-size)', 'var(--h4-size)', 'var(--h5-size)', 'var(--h6-size)']

export interface OutlineItem {
  /** 1-based line number */
  line: number
  level: number
  text: string
}

export function outlineOf(lines: { count: number; text: (n: number) => string }): OutlineItem[] {
  const items: OutlineItem[] = []
  for (let n = 1; n <= lines.count; n++) {
    const raw = lines.text(n)
    if (!raw.includes('#')) continue
    const m = HEADING_RE.exec(raw)
    if (!m) continue
    const text = raw.slice(m[0].length).replace(strongRegex(), '$1').trim()
    if (text) items.push({ line: n, level: m[2].length, text })
  }
  return items
}
