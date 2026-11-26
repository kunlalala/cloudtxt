import { getMeta, loadAll, putFolders, putNotes, replaceAllData, setMeta } from './db'
import type { CloudData, Folder, Note } from './types'

export const AUTOSAVE_MS = 400
export const UNTITLED = 'Untitled'
export const TAB_SIZES = [2, 4, 6, 8]

export type Kind = 'folder' | 'note'

export interface Row {
  kind: Kind
  id: string
  depth: number
  name: string
  open?: boolean
}

function newId() {
  // time prefix keeps ids sortable by creation order
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function deriveTitle(content: string) {
  for (const line of content.split('\n', 20)) {
    const t = line.replace(/^\s*#+\s*/, '').trim()
    if (t) return t.slice(0, 80)
  }
  return ''
}

function reportError(e: unknown) {
  console.error('[cloudtxt] IndexedDB write failed', e)
}

class Store {
  folders = $state<Folder[]>([])
  notes = $state<Note[]>([])
  selectedId = $state<string | null>(null)
  activeFolderId = $state<string | null>(null)
  expanded = $state<string[]>([])
  ready = $state(false)
  /** display width of one indent level; one global setting for all notes */
  tabSize = $state(4)
  /** whether the desktop outline panel is shown (remembered; phones use a drawer instead) */
  outlineOpen = $state(false)
  /** when the local copy saved before the last Drive download was taken (0 = none) */
  localBackupAt = $state(0)

  private pending = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | undefined
  /** note id -> folded line numbers (not reactive; only the editor reads it) */
  private folds: Record<string, number[]> = {}
  private foldsDirty = false
  private foldTimer: ReturnType<typeof setTimeout> | undefined

  liveFolders = $derived(this.folders.filter((f) => !f.deleted))
  liveNotes = $derived(this.notes.filter((n) => !n.deleted))
  selected = $derived(this.liveNotes.find((n) => n.id === this.selectedId) ?? null)

  rows = $derived.by<Row[]>(() => {
    const out: Row[] = []
    const folders = this.liveFolders
    const notes = this.liveNotes
    const open = new Set(this.expanded)
    const walk = (parentId: string | null, depth: number) => {
      const subs = folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
      for (const f of subs) {
        const isOpen = open.has(f.id)
        out.push({ kind: 'folder', id: f.id, depth, name: f.name, open: isOpen })
        if (isOpen) walk(f.id, depth + 1)
      }
      const items = notes.filter((n) => n.folderId === parentId).sort((a, b) => (a.id < b.id ? 1 : -1))
      for (const n of items) out.push({ kind: 'note', id: n.id, depth, name: n.title || UNTITLED })
    }
    walk(null, 0)
    return out
  })

  async init() {
    const { folders, notes } = await loadAll()
    this.folders = folders
    this.notes = notes
    const sel = await getMeta<string>('selectedId')
    this.expanded = (await getMeta<string[]>('expanded')) ?? []
    const ts = await getMeta<number>('tabSize')
    if (ts && TAB_SIZES.includes(ts)) this.tabSize = ts
    const ol = await getMeta<boolean>('outlineOpen')
    this.outlineOpen = ol ?? window.matchMedia('(min-width: 768px)').matches
    const savedFolds = (await getMeta<Record<string, number[]>>('folds')) ?? {}
    const live = new Set(this.liveNotes.map((n) => n.id))
    for (const id of Object.keys(savedFolds)) if (live.has(id)) this.folds[id] = savedFolds[id]
    this.localBackupAt = (await getMeta<{ at: number } | null>('backupBeforeDownload'))?.at ?? 0
    if (sel && this.liveNotes.some((n) => n.id === sel)) this.selectedId = sel
    this.ready = true
    const note = this.selected
    if (note) this.activeFolderId = note.folderId
  }

  private saveUi() {
    setMeta('selectedId', this.selectedId).catch(reportError)
    setMeta('expanded', $state.snapshot(this.expanded)).catch(reportError)
  }

  // ---- settings -------------------------------------------------------
  setTabSize(n: number) {
    if (!TAB_SIZES.includes(n)) return
    this.tabSize = n
    setMeta('tabSize', n).catch(reportError)
  }

  setOutlineOpen(open: boolean) {
    this.outlineOpen = open
    setMeta('outlineOpen', open).catch(reportError)
  }

  // ---- folds ----------------------------------------------------------
  getFolds = (id: string) => this.folds[id] ?? []

  setFolds = (id: string, lines: number[]) => {
    const cur = this.folds[id] ?? []
    if (cur.length === lines.length && cur.every((v, i) => v === lines[i])) return
    if (lines.length) this.folds[id] = lines
    else delete this.folds[id]
    this.foldsDirty = true
    clearTimeout(this.foldTimer)
    this.foldTimer = setTimeout(() => void this.flushFolds(), AUTOSAVE_MS)
  }

  private async flushFolds() {
    clearTimeout(this.foldTimer)
    if (!this.foldsDirty) return
    this.foldsDirty = false
    try {
      await setMeta('folds', { ...this.folds })
    } catch (e) {
      this.foldsDirty = true
      reportError(e)
    }
  }

  // ---- autosave -------------------------------------------------------
  edit(content: string) {
    const n = this.selected
    if (!n || n.content === content) return
    n.content = content
    if (!n.customTitle) n.title = deriveTitle(content)
    n.updatedAt = Date.now()
    this.pending.add(n.id)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_MS)
  }

  async flush() {
    clearTimeout(this.timer)
    void this.flushFolds()
    if (!this.pending.size) return
    const ids = [...this.pending]
    this.pending.clear()
    const items = ids
      .map((id) => this.notes.find((n) => n.id === id))
      .filter((n): n is Note => !!n)
      .map((n) => $state.snapshot(n) as Note)
    try {
      await putNotes(items)
    } catch (e) {
      ids.forEach((id) => this.pending.add(id))
      reportError(e)
    }
  }

  // ---- navigation -----------------------------------------------------
  select(id: string | null) {
    void this.flush()
    this.selectedId = id
    const n = this.selected
    if (n) this.activeFolderId = n.folderId
    this.saveUi()
  }

  toggle(folderId: string) {
    this.activeFolderId = folderId
    this.setOpen(folderId, !this.expanded.includes(folderId))
  }

  private setOpen(folderId: string, open: boolean) {
    const has = this.expanded.includes(folderId)
    if (open && !has) this.expanded.push(folderId)
    if (!open && has) this.expanded = this.expanded.filter((x) => x !== folderId)
    this.saveUi()
  }

  // ---- CRUD -----------------------------------------------------------
  addFolder(name: string, parentId: string | null = this.activeFolderId) {
    const f: Folder = { id: newId(), name: name.trim() || 'New folder', parentId, updatedAt: Date.now() }
    this.folders.push(f)
    if (parentId) this.setOpen(parentId, true)
    putFolders([f]).catch(reportError)
  }

  addNote(folderId: string | null = this.activeFolderId) {
    const n: Note = { id: newId(), title: '', content: '', folderId, updatedAt: Date.now() }
    this.notes.push(n)
    if (folderId) this.setOpen(folderId, true)
    putNotes([$state.snapshot(n) as Note]).catch(reportError)
    this.select(n.id)
  }

  rename(kind: Kind, id: string, name: string) {
    name = name.trim()
    if (kind === 'folder') {
      const f = this.folders.find((x) => x.id === id)
      if (!f || !name) return
      f.name = name
      f.updatedAt = Date.now()
      putFolders([f]).catch(reportError)
    } else {
      const n = this.notes.find((x) => x.id === id)
      if (!n) return
      void this.flush()
      n.customTitle = !!name
      n.title = name || deriveTitle(n.content)
      n.updatedAt = Date.now()
      putNotes([$state.snapshot(n) as Note]).catch(reportError)
    }
  }

  /** ids of a folder and all of its descendant folders */
  folderTree(id: string): Set<string> {
    const ids = new Set([id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of this.folders) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id)
          grew = true
        }
      }
    }
    return ids
  }

  move(kind: Kind, id: string, target: string | null) {
    if (kind === 'folder') {
      const f = this.folders.find((x) => x.id === id)
      if (!f || f.parentId === target || (target && this.folderTree(id).has(target))) return
      f.parentId = target
      f.updatedAt = Date.now()
      putFolders([f]).catch(reportError)
    } else {
      const n = this.notes.find((x) => x.id === id)
      if (!n || n.folderId === target) return
      void this.flush()
      n.folderId = target
      n.updatedAt = Date.now()
      putNotes([$state.snapshot(n) as Note]).catch(reportError)
    }
    if (target) this.setOpen(target, true)
  }

  /** Soft delete; a folder takes its subfolders and notes with it. */
  remove(kind: Kind, id: string) {
    const now = Date.now()
    void this.flush()
    if (kind === 'note') {
      const n = this.notes.find((x) => x.id === id)
      if (!n) return
      n.deleted = true
      n.updatedAt = now
      putNotes([$state.snapshot(n) as Note]).catch(reportError)
    } else {
      const ids = this.folderTree(id)
      const fs = this.folders.filter((f) => ids.has(f.id) && !f.deleted)
      const ns = this.notes.filter((n) => n.folderId && ids.has(n.folderId) && !n.deleted)
      for (const f of fs) ((f.deleted = true), (f.updatedAt = now))
      for (const n of ns) ((n.deleted = true), (n.updatedAt = now))
      putFolders(fs.map((f) => $state.snapshot(f) as Folder)).catch(reportError)
      putNotes(ns.map((n) => $state.snapshot(n) as Note)).catch(reportError)
      if (this.activeFolderId && ids.has(this.activeFolderId)) this.activeFolderId = null
    }
    if (!this.selected) this.selectedId = null
    this.saveUi()
  }

  // ---- cloud (Drive) ---------------------------------------------------
  /** Everything that belongs in cloudtxt.json. Settings are deliberately excluded. */
  snapshot(): CloudData {
    const folders = $state.snapshot(this.folders) as Folder[]
    const notes = $state.snapshot(this.notes) as Note[]
    let updatedAt = 0
    for (const f of folders) updatedAt = Math.max(updatedAt, f.updatedAt)
    for (const n of notes) updatedAt = Math.max(updatedAt, n.updatedAt)
    return { version: 1, updatedAt, folders, notes }
  }

  /** Replace everything with a copy from Drive (all writes in one transaction). */
  async replaceAll(data: CloudData) {
    await this.flush()
    clearTimeout(this.timer)
    this.pending.clear()
    await replaceAllData(data.folders, data.notes)
    this.folders = data.folders
    this.notes = data.notes
    this.folds = {}
    this.foldsDirty = false
    this.selectedId = null
    this.activeFolderId = null
    this.expanded = []
    await setMeta('folds', {}).catch(reportError)
    this.saveUi()
  }

  /** Keep the local data aside before a download replaces it. */
  async saveLocalBackup() {
    const at = Date.now()
    await setMeta('backupBeforeDownload', { at, data: this.snapshot() })
    this.localBackupAt = at
  }

  async restoreLocalBackup(): Promise<boolean> {
    const saved = await getMeta<{ at: number; data: CloudData } | null>('backupBeforeDownload')
    if (!saved) return false
    await this.replaceAll(saved.data)
    await setMeta('backupBeforeDownload', null)
    this.localBackupAt = 0
    return true
  }

  folderPath(id: string | null): string {
    const parts: string[] = []
    let cur = id ? this.folders.find((f) => f.id === id) : undefined
    while (cur) {
      parts.unshift(cur.name)
      cur = cur.parentId ? this.folders.find((f) => f.id === cur!.parentId) : undefined
    }
    return parts.join(' / ')
  }
}

export const store = new Store()
