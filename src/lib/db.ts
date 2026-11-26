import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Folder, Note } from './types'

interface CloudtxtDB extends DBSchema {
  folders: { key: string; value: Folder }
  notes: { key: string; value: Note }
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<CloudtxtDB>> | null = null

function db() {
  dbPromise ??= openDB<CloudtxtDB>('cloudtxt', 1, {
    upgrade(d) {
      d.createObjectStore('folders', { keyPath: 'id' })
      d.createObjectStore('notes', { keyPath: 'id' })
      d.createObjectStore('meta')
    },
  })
  return dbPromise
}

export async function loadAll() {
  const d = await db()
  const [folders, notes] = await Promise.all([d.getAll('folders'), d.getAll('notes')])
  return { folders, notes }
}

export async function putFolders(items: Folder[]) {
  const d = await db()
  const tx = d.transaction('folders', 'readwrite')
  await Promise.all([...items.map((f) => tx.store.put(f)), tx.done])
}

export async function putNotes(items: Note[]) {
  const d = await db()
  const tx = d.transaction('notes', 'readwrite')
  await Promise.all([...items.map((n) => tx.store.put(n)), tx.done])
}

/** Replace everything in one transaction, used when a Drive copy is restored. */
export async function replaceAllData(folders: Folder[], notes: Note[]) {
  const d = await db()
  const tx = d.transaction(['folders', 'notes'], 'readwrite')
  const folderStore = tx.objectStore('folders')
  const noteStore = tx.objectStore('notes')
  await Promise.all([folderStore.clear(), noteStore.clear()])
  await Promise.all([
    ...folders.map((f) => folderStore.put(f)),
    ...notes.map((n) => noteStore.put(n)),
    tx.done,
  ])
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key)
}
