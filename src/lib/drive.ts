/**
 * Minimal Drive v3 client for files inside appDataFolder.
 * Plain fetch calls, so there is no extra library to load or update.
 */

import { BACKUP_SLOTS } from './config'

const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const META_FIELDS = 'id,name,modifiedTime,size'

export interface DriveFile {
  id: string
  name: string
  modifiedTime?: string
  size?: string
}

export class DriveError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

async function toError(res: Response): Promise<DriveError> {
  let detail = ''
  try {
    const body = await res.text()
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } }
      detail = parsed.error?.message ?? ''
    } catch {
      detail = body
    }
  } catch {
    // body already consumed or unreadable
  }
  return new DriveError(detail.slice(0, 300) || `${res.status} ${res.statusText}`, res.status)
}

function bearer(token: string, extra?: Record<string, string>) {
  return { Authorization: `Bearer ${token}`, ...extra }
}

async function readJson<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: bearer(token, init.headers as Record<string, string> | undefined),
  })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as T
}

/** Every file in this app's hidden Drive folder. */
export async function listFiles(token: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    pageSize: '100',
    orderBy: 'modifiedTime desc',
    fields: `files(${META_FIELDS})`,
  })
  const data = await readJson<{ files?: DriveFile[] }>(token, `${FILES}?${params}`)
  return data.files ?? []
}

/** The first file with this exact name, or null. */
export async function findFile(token: string, name: string): Promise<DriveFile | null> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${escaped}' and trashed = false`,
    pageSize: '5',
    fields: `files(${META_FIELDS})`,
  })
  const data = await readJson<{ files?: DriveFile[] }>(token, `${FILES}?${params}`)
  return data.files?.[0] ?? null
}

export async function readText(token: string, id: string): Promise<string> {
  const res = await fetch(`${FILES}/${encodeURIComponent(id)}?alt=media`, { headers: bearer(token) })
  if (!res.ok) throw await toError(res)
  return await res.text()
}

/** Create a new JSON file inside appDataFolder (multipart upload). */
export async function createFile(token: string, name: string, text: string): Promise<DriveFile> {
  const boundary = `cloudtxt-${Math.random().toString(36).slice(2)}`
  const metadata = { name, mimeType: 'application/json', parents: ['appDataFolder'] }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n` +
    `--${boundary}--`
  const params = new URLSearchParams({ uploadType: 'multipart', fields: META_FIELDS })
  const res = await fetch(`${UPLOAD}?${params}`, {
    method: 'POST',
    headers: bearer(token, { 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body,
  })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as DriveFile
}

async function writeNamed(token: string, name: string, text: string): Promise<DriveFile> {
  const existing = await findFile(token, name)
  return existing ? await updateFile(token, existing.id, text) : await createFile(token, name, text)
}

async function readNamed(token: string, name: string): Promise<string | null> {
  const file = await findFile(token, name)
  return file ? await readText(token, file.id) : null
}

/**
 * Keep the remote copy that is about to be replaced.
 * Slot 0 always becomes `previous`; with rotate, the older slots shift down (only the last
 * three snapshots survive), otherwise older slots stay as they are to save API calls.
 */
export async function keepBackup(token: string, previous: string, rotate: boolean) {
  if (rotate) {
    const older = await readNamed(token, BACKUP_SLOTS[0])
    const oldest = await readNamed(token, BACKUP_SLOTS[1])
    if (oldest !== null) await writeNamed(token, BACKUP_SLOTS[2], oldest)
    if (older !== null) await writeNamed(token, BACKUP_SLOTS[1], older)
  }
  await writeNamed(token, BACKUP_SLOTS[0], previous)
}

export async function readBlob(token: string, id: string): Promise<Blob> {
  const res = await fetch(`${FILES}/${encodeURIComponent(id)}?alt=media`, { headers: bearer(token) })
  if (!res.ok) throw await toError(res)
  return await res.blob()
}

/** Create a binary file (image) inside appDataFolder. */
export async function createBinaryFile(
  token: string,
  name: string,
  blob: Blob,
  mime = 'image/jpeg',
): Promise<DriveFile> {
  const boundary = `cloudtxt-${Math.random().toString(36).slice(2)}`
  const metadata = { name, mimeType: mime, parents: ['appDataFolder'] }
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ])
  const params = new URLSearchParams({ uploadType: 'multipart', fields: META_FIELDS })
  const res = await fetch(`${UPLOAD}?${params}`, {
    method: 'POST',
    headers: bearer(token, { 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body,
  })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as DriveFile
}

export async function deleteFile(token: string, id: string): Promise<void> {
  const res = await fetch(`${FILES}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: bearer(token),
  })
  // already gone is fine
  if (!res.ok && res.status !== 404) throw await toError(res)
}

/** Replace the content of an existing file. */
export async function updateFile(token: string, id: string, text: string): Promise<DriveFile> {
  const params = new URLSearchParams({ uploadType: 'media', fields: META_FIELDS })
  const res = await fetch(`${UPLOAD}/${encodeURIComponent(id)}?${params}`, {
    method: 'PATCH',
    headers: bearer(token, { 'Content-Type': 'application/json; charset=UTF-8' }),
    body: text,
  })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as DriveFile
}
