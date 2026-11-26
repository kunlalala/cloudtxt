import { CLIENT_ID, BACKUP_FILE, DRIVE_SCOPE, MAIN_FILE, TOKEN_LIFETIME_MS } from './config'
import * as drive from './drive'
import { DriveError } from './drive'
import { getMeta, setMeta } from './db'
import { store } from './store.svelte'
import type { CloudData, Folder, Note } from './types'

export type CloudStatus = 'signed-out' | 'connecting' | 'signed-in' | 'expired'

interface TokenInfo {
  accessToken: string
  expiresAt: number
}

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (override?: { prompt?: string }) => void
}

interface OAuth2Api {
  initTokenClient: (config: {
    client_id: string
    scope: string
    prompt?: string
    callback: (resp: TokenResponse) => void
    error_callback?: (err: { type?: string; message?: string }) => void
  }) => TokenClient
}

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

const META_KEY = 'driveToken'

function reportError(e: unknown) {
  console.error('[cloudtxt] Drive meta write failed', e)
}

function isFolder(value: unknown): value is Folder {
  const f = value as Folder
  return !!f && typeof f === 'object' && typeof f.id === 'string' && typeof f.name === 'string'
}

function isNote(value: unknown): value is Note {
  const n = value as Note
  return !!n && typeof n === 'object' && typeof n.id === 'string' && typeof n.content === 'string'
}

function normalize(data: CloudData): CloudData {
  const now = Date.now()
  const folders: Folder[] = data.folders.filter(isFolder).map((f) => ({
    id: f.id,
    name: typeof f.name === 'string' ? f.name : 'Folder',
    parentId: typeof f.parentId === 'string' ? f.parentId : null,
    updatedAt: Number.isFinite(f.updatedAt) ? f.updatedAt : now,
    ...(f.deleted ? { deleted: true } : {}),
  }))
  const notes: Note[] = data.notes.filter(isNote).map((n) => ({
    id: n.id,
    title: typeof n.title === 'string' ? n.title : '',
    content: n.content,
    folderId: typeof n.folderId === 'string' ? n.folderId : null,
    updatedAt: Number.isFinite(n.updatedAt) ? n.updatedAt : now,
    ...(n.deleted ? { deleted: true } : {}),
    ...(n.customTitle ? { customTitle: true } : {}),
  }))
  let updatedAt = 0
  for (const f of folders) updatedAt = Math.max(updatedAt, f.updatedAt)
  for (const n of notes) updatedAt = Math.max(updatedAt, n.updatedAt)
  return { version: 1, updatedAt, folders, notes }
}

/** Parse a downloaded cloudtxt.json and reject anything that is not the expected shape. */
export function parseCloudData(text: string): CloudData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new DriveError(`The Drive file ${MAIN_FILE} does not contain valid JSON.`)
  }
  if (!raw || typeof raw !== 'object') throw new DriveError(`The Drive file ${MAIN_FILE} is empty.`)
  const data = raw as Partial<CloudData>
  if (!Array.isArray(data.folders) || !Array.isArray(data.notes)) {
    throw new DriveError(`The Drive file ${MAIN_FILE} is not a cloudtxt file (folders or notes missing).`)
  }
  return normalize(data as CloudData)
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function friendlyError(e: unknown): string {
  if (e instanceof AuthError) return e.message
  if (e instanceof DriveError) {
    if (e.status === 401) return 'Google sign-in expired. Sign in again.'
    if (e.status === 403)
      return `Google refused the request: ${e.message}. Check that the Drive API is enabled and that this address is listed as an authorized JavaScript origin for the OAuth client.`
    if (e.status === 404) return 'That file is no longer in Drive (it may have been deleted).'
    if (e.status === 429) return 'Google is limiting requests right now. Try again in a minute.'
    return `Drive error (${e.status}): ${e.message}`
  }
  if (e instanceof TypeError) return 'Network error. Check your connection and try again.'
  return e instanceof Error ? e.message : String(e)
}

class Cloud {
  /** false when this build has no Client ID (see src/lib/config.ts) */
  readonly configured = CLIENT_ID.endsWith('.apps.googleusercontent.com')
  status = $state<CloudStatus>('signed-out')
  busy = $state<'' | 'upload' | 'download' | 'refresh'>('')
  error = $state('')
  message = $state('')
  /** files currently in the app's hidden Drive folder */
  files = $state<drive.DriveFile[]>([])

  private token: TokenInfo | null = null
  private gis?: Promise<OAuth2Api>

  async init() {
    if (!this.configured) return
    const saved = await getMeta<TokenInfo | null>(META_KEY)
    if (!saved?.accessToken) return
    this.token = saved
    if (saved.expiresAt > Date.now() + 60_000) {
      this.status = 'signed-in'
      // a stored token may have been revoked elsewhere; check quietly and never prompt here
      void this.refreshFiles(true)
    } else {
      this.status = 'expired'
    }
  }

  private loadGis(): Promise<OAuth2Api> {
    this.gis ??= new Promise<OAuth2Api>((resolve, reject) => {
      const win = window as unknown as { google?: { accounts?: { oauth2?: OAuth2Api } } }
      const ready = () => {
        const api = win.google?.accounts?.oauth2
        if (api) resolve(api)
        else reject(new AuthError('Google sign-in could not start. Reload the page and try again.'))
      }
      if (win.google?.accounts?.oauth2) {
        ready()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = ready
      script.onerror = () =>
        reject(new AuthError('Could not load Google sign-in. Check your connection and try again.'))
      document.head.appendChild(script)
    })
    return this.gis
  }

  /** Ask Google for a token. An empty prompt returns without UI when consent is still granted. */
  private async requestToken(prompt: '' | 'consent'): Promise<string> {
    const oauth2 = await this.loadGis()
    return await new Promise<string>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPE,
        prompt,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            if (resp.error === 'popup_closed_by_user') reject(new AuthError('Sign-in was cancelled.'))
            else reject(new AuthError(resp.error_description || resp.error || 'Google did not return a token.'))
            return
          }
          resolve(resp.access_token)
        },
        error_callback: (err) => {
          if (err?.type === 'popup_closed') reject(new AuthError('Sign-in was cancelled.'))
          else if (err?.type === 'popup_failed_to_open')
            reject(new AuthError('The sign-in window was blocked. Allow pop-ups for this site and try again.'))
          else reject(new AuthError(err?.message || 'Google sign-in failed.'))
        },
      })
      client.requestAccessToken()
    })
  }

  private async accept(token: string, expiresIn?: number) {
    const seconds = Number(expiresIn)
    const lifetime = Number.isFinite(seconds) && seconds > 60 ? seconds * 1000 : TOKEN_LIFETIME_MS
    this.token = { accessToken: token, expiresAt: Date.now() + Math.min(lifetime, TOKEN_LIFETIME_MS) }
    await setMeta(META_KEY, this.token).catch(reportError)
  }

  private async markExpired() {
    this.token = null
    this.status = 'expired'
    await setMeta(META_KEY, null).catch(reportError)
  }

  /** A stale token is renewed silently; Google shows UI only if consent is really gone. */
  private async refreshToken() {
    const token = await this.requestToken('')
    await this.accept(token)
    this.status = 'signed-in'
  }

  private async withToken<T>(fn: (token: string) => Promise<T>, allowRefresh = true): Promise<T> {
    if (!this.token || this.token.expiresAt <= Date.now() + 60_000) {
      if (!allowRefresh) throw new AuthError('Google sign-in expired. Sign in again.')
      await this.refreshToken()
    }
    const current = this.token
    if (!current) throw new AuthError('Google sign-in expired. Sign in again.')
    try {
      return await fn(current.accessToken)
    } catch (e) {
      if (!(e instanceof DriveError) || e.status !== 401) throw e
      if (!allowRefresh) {
        await this.markExpired()
        throw new AuthError('Google sign-in expired. Sign in again.')
      }
      await this.markExpired()
      await this.refreshToken()
      const fresh = this.token
      if (!fresh) throw new AuthError('Google sign-in expired. Sign in again.')
      return await fn(fresh.accessToken)
    }
  }

  async signIn() {
    if (!this.configured) {
      this.error = 'This build has no Google Client ID. Add it to src/lib/config.ts.'
      return
    }
    this.error = ''
    this.message = ''
    this.status = 'connecting'
    try {
      const token = await this.requestToken('')
      await this.accept(token)
      this.status = 'signed-in'
      this.message = 'Signed in. Nothing has been uploaded yet.'
      await this.refreshFiles()
    } catch (e) {
      this.status = this.token ? 'signed-in' : 'signed-out'
      this.error = friendlyError(e)
    }
  }

  async signOut() {
    const current = this.token?.accessToken
    this.token = null
    this.files = []
    this.message = ''
    this.error = ''
    this.status = 'signed-out'
    await setMeta(META_KEY, null).catch(reportError)
    if (current) {
      // best effort: also drop the permission grant behind this token
      void fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(current)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {})
    }
  }

  /** List the files in the app's Drive folder. Silent when called from startup. */
  async refreshFiles(silent = false) {
    if (!this.token) return
    if (!silent) this.busy = 'refresh'
    try {
      this.files = await this.withToken((token) => drive.listFiles(token), !silent)
      if (!silent && !this.files.length) this.message = `No ${MAIN_FILE} in Drive yet. Upload to create it.`
    } catch (e) {
      if (!silent) this.error = friendlyError(e)
    } finally {
      if (!silent) this.busy = ''
    }
  }

  /** Upload everything local. The remote copy that gets replaced is kept as a backup. */
  async uploadLocal() {
    if (!this.token) {
      await this.signIn()
      return
    }
    this.busy = 'upload'
    this.error = ''
    this.message = ''
    try {
      await store.flush()
      const data = store.snapshot()
      const text = JSON.stringify(data)
      const created = await this.withToken(async (token) => {
        const existing = await drive.findFile(token, MAIN_FILE)
        if (!existing) {
          await drive.createFile(token, MAIN_FILE, text)
          return true
        }
        const previous = await drive.readText(token, existing.id)
        const backup = await drive.findFile(token, BACKUP_FILE)
        if (backup) await drive.updateFile(token, backup.id, previous)
        else await drive.createFile(token, BACKUP_FILE, previous)
        await drive.updateFile(token, existing.id, text)
        return false
      })
      const count = `${plural(data.notes.length, 'note')} and ${plural(data.folders.length, 'folder')}`
      this.message = created
        ? `Uploaded ${count}. Created ${MAIN_FILE} in your Drive app data folder.`
        : `Uploaded ${count}. The previous Drive copy was saved as ${BACKUP_FILE}.`
      await this.refreshFiles(true)
    } catch (e) {
      this.error = friendlyError(e)
      if (e instanceof AuthError) await this.markExpired()
    } finally {
      this.busy = ''
    }
  }

  /** Replace this device's notes with the Drive copy (the local copy is kept as a backup). */
  async downloadRemote() {
    if (!this.token) {
      await this.signIn()
      return
    }
    this.busy = 'download'
    this.error = ''
    this.message = ''
    try {
      const data = await this.withToken(async (token) => {
        const file = await drive.findFile(token, MAIN_FILE)
        if (!file) throw new DriveError(`There is no ${MAIN_FILE} in Drive yet. Upload first.`, 404)
        return parseCloudData(await drive.readText(token, file.id))
      })
      await store.saveLocalBackup()
      await store.replaceAll(data)
      this.message = `Replaced this device with the Drive copy: ${plural(data.notes.length, 'note')} and ${plural(data.folders.length, 'folder')}. The previous local copy is kept and can be restored below.`
      await this.refreshFiles(true)
    } catch (e) {
      this.error = friendlyError(e)
      if (e instanceof AuthError) await this.markExpired()
    } finally {
      this.busy = ''
    }
  }

  async restoreLocal() {
    this.error = ''
    this.message = ''
    try {
      this.message = (await store.restoreLocalBackup())
        ? 'Restored the local copy that was saved before the last download.'
        : 'There is no saved local copy.'
    } catch (e) {
      this.error = friendlyError(e)
    }
  }
}

export const cloud = new Cloud()
