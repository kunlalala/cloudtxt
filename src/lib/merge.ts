/**
 * Merging two cloudtxt snapshots (this device and the Drive copy).
 * Rules: per item (folder / note), the newer updatedAt wins; soft-deleted items are kept as
 * tombstones and only dropped after TOMBSTONE_MS, so a delete cannot resurrect an item.
 * Pure functions, no storage access, so the behaviour can be reasoned about and tested alone.
 */
import type { CloudData, Folder, Note } from './types'

/** A soft-deleted item older than this is removed for good. */
export const TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000

export function sameFolder(a: Folder, b: Folder) {
  return (
    a.name === b.name &&
    a.parentId === b.parentId &&
    a.updatedAt === b.updatedAt &&
    !!a.deleted === !!b.deleted
  )
}

export function sameNote(a: Note, b: Note) {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.folderId === b.folderId &&
    a.updatedAt === b.updatedAt &&
    !!a.deleted === !!b.deleted &&
    !!a.customTitle === !!b.customTitle
  )
}

export interface MergeStats {
  /** items where the Drive copy was newer and therefore replaced the local one */
  fromRemote: number
  /** items where this device was newer (or only exists here), so they go up */
  toRemote: number
  /** tombstones removed because they are older than TOMBSTONE_MS */
  purged: number
}

export interface MergeResult {
  data: CloudData
  stats: MergeStats
}

/** true when both snapshots describe the same folders and notes */
export function sameCloudData(a: CloudData, b: CloudData) {
  if (a.folders.length !== b.folders.length || a.notes.length !== b.notes.length) return false
  const folders = new Map(b.folders.map((f) => [f.id, f]))
  for (const f of a.folders) {
    const other = folders.get(f.id)
    if (!other || !sameFolder(f, other)) return false
  }
  const notes = new Map(b.notes.map((n) => [n.id, n]))
  for (const n of a.notes) {
    const other = notes.get(n.id)
    if (!other || !sameNote(n, other)) return false
  }
  return true
}

function maxUpdatedAt(folders: Folder[], notes: Note[], fallback: number) {
  let max = fallback
  for (const f of folders) max = Math.max(max, f.updatedAt)
  for (const n of notes) max = Math.max(max, n.updatedAt)
  return max
}

export function mergeCloudData(local: CloudData, remote: CloudData, now = Date.now()): MergeResult {
  let fromRemote = 0
  let toRemote = 0

  const localFolders = new Map(local.folders.map((f) => [f.id, f]))
  const remoteFolders = new Map(remote.folders.map((f) => [f.id, f]))
  const localNotes = new Map(local.notes.map((n) => [n.id, n]))
  const remoteNotes = new Map(remote.notes.map((n) => [n.id, n]))

  const folders: Folder[] = []
  for (const id of new Set([...localFolders.keys(), ...remoteFolders.keys()])) {
    const mine = localFolders.get(id)
    const theirs = remoteFolders.get(id)
    // on an exact tie the local copy stays, so repeated syncs do not flip items around
    const winner = !theirs || (mine && mine.updatedAt >= theirs.updatedAt) ? mine! : theirs
    if (winner === theirs) {
      if (!mine || !sameFolder(mine, theirs)) fromRemote++
    } else if (!theirs || !sameFolder(winner, theirs)) {
      toRemote++
    }
    folders.push({ ...winner })
  }

  const notes: Note[] = []
  for (const id of new Set([...localNotes.keys(), ...remoteNotes.keys()])) {
    const mine = localNotes.get(id)
    const theirs = remoteNotes.get(id)
    const winner = !theirs || (mine && mine.updatedAt >= theirs.updatedAt) ? mine! : theirs
    if (winner === theirs) {
      if (!mine || !sameNote(mine, theirs)) fromRemote++
    } else if (!theirs || !sameNote(winner, theirs)) {
      toRemote++
    }
    notes.push({ ...winner })
  }

  // remove tombstones that are old enough to forget
  const cutoff = now - TOMBSTONE_MS
  const liveFolders = folders.filter((f) => !(f.deleted && f.updatedAt < cutoff))
  const liveNotes = notes.filter((n) => !(n.deleted && n.updatedAt < cutoff))
  const purged = folders.length - liveFolders.length + (notes.length - liveNotes.length)

  // repair links so nothing becomes invisible: unknown parents go to the root, cycles are cut
  const folderIds = new Set(liveFolders.map((f) => f.id))
  const deletedFolderIds = new Set(liveFolders.filter((f) => f.deleted).map((f) => f.id))
  const byId = new Map(liveFolders.map((f) => [f.id, f]))
  for (const f of liveFolders) {
    if (!f.parentId) continue
    let cur: Folder | undefined = f
    const seen = new Set<string>()
    let bad = !folderIds.has(f.parentId)
    while (!bad && cur?.parentId) {
      if (seen.has(cur.parentId)) {
        bad = true
        break
      }
      seen.add(cur.parentId)
      cur = byId.get(cur.parentId)
      if (!cur) bad = true
    }
    if (bad) {
      f.parentId = null
      f.updatedAt = now
      toRemote++
    }
  }
  for (const n of liveNotes) {
    if (!n.folderId) continue
    if (!folderIds.has(n.folderId)) {
      // its folder is gone for good: keep the note visible at the root
      n.folderId = null
      n.updatedAt = now
      toRemote++
    } else if (deletedFolderIds.has(n.folderId) && !n.deleted) {
      // the folder was deleted on another device: hide the note too
      n.deleted = true
      n.updatedAt = now
      toRemote++
    }
  }

  return {
    data: {
      version: 1,
      updatedAt: maxUpdatedAt(liveFolders, liveNotes, Math.max(local.updatedAt, remote.updatedAt)),
      folders: liveFolders,
      notes: liveNotes,
    },
    stats: { fromRemote, toRemote, purged },
  }
}
