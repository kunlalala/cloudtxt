/**
 * Background synchronisation: merges this device with the Drive copy, then pushes the result.
 * It never blocks typing: the merge is skipped when the user typed during the round, and the
 * next round picks the new text up.
 */
import { AuthError, cloud, friendlyError, parseCloudData } from './cloud.svelte'
import { BACKUP_ROTATE_MS, MAIN_FILE } from './config'
import { getMeta, setMeta } from './db'
import * as drive from './drive'
import { mergeCloudData, sameCloudData, type MergeStats } from './merge'
import { store } from './store.svelte'
import type { CloudData } from './types'

export type SyncState = 'off' | 'idle' | 'syncing' | 'waiting' | 'error'

const EDIT_DEBOUNCE = 5000
const RETRY_BASE = 30_000
const RETRY_MAX = 5 * 60_000
const VISIBLE_MIN_GAP = 20_000

function describe(stats: MergeStats, applied: number) {
  const parts: string[] = []
  if (stats.fromRemote) parts.push(`${stats.fromRemote} updated from Drive`)
  if (stats.toRemote) parts.push(`${stats.toRemote} sent to Drive`)
  if (stats.purged) parts.push(`${stats.purged} old deleted item${stats.purged === 1 ? '' : 's'} cleaned`)
  if (!parts.length) return applied ? 'Applied changes from Drive.' : 'Everything up to date.'
  return parts.join(' · ')
}

class Sync {
  state = $state<SyncState>('off')
  /** when the last successful round finished */
  lastSyncAt = $state(0)
  error = $state('')
  summary = $state('')
  auto = $state(true)

  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | null = null
  private dirty = false
  private retries = 0
  private paused = 0
  private lastRotateAt = 0
  private inited = false

  init() {
    if (this.inited) return
    this.inited = true
    void (async () => {
      this.auto = (await getMeta<boolean>('autoSync')) ?? true
      this.lastSyncAt = (await getMeta<number>('lastSyncAt')) ?? 0
      this.refreshState()
    })()

    store.onChange((kind) => {
      if (kind !== 'local') return
      if (this.running) {
        this.dirty = true
        return
      }
      this.schedule(EDIT_DEBOUNCE)
    })
    window.addEventListener('online', () => this.schedule(800))
    window.addEventListener('offline', () => {
      if (this.auto) this.state = 'waiting'
    })
    document.addEventListener('visibilitychange', () => {
      // coming back to the app: catch up with the other device
      if (document.visibilityState === 'visible' && Date.now() - this.lastSyncAt > VISIBLE_MIN_GAP) {
        this.schedule(500)
      }
    })
  }

  /** keep the panel and header in step with the session */
  refreshState() {
    if (!cloud.configured || !cloud.hasSession || !this.auto) {
      this.state = 'off'
      return
    }
    if (!navigator.onLine) {
      this.state = 'waiting'
      return
    }
    if (this.state !== 'syncing' && this.state !== 'error') this.state = 'idle'
  }

  setAuto(on: boolean) {
    this.auto = on
    void setMeta('autoSync', on)
    if (!on) {
      clearTimeout(this.timer)
      this.error = ''
      this.state = 'off'
      return
    }
    if (!navigator.onLine) this.state = 'waiting'
    else this.state = 'idle'
    this.schedule(500)
  }

  /** pause automatic rounds while a manual Drive operation runs */
  pause() {
    this.paused++
    clearTimeout(this.timer)
    return () => {
      this.paused = Math.max(0, this.paused - 1)
    }
  }

  schedule(ms = EDIT_DEBOUNCE) {
    if (!this.auto || this.paused || !cloud.hasSession) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow('auto'), ms)
  }

  async syncNow(reason: 'start' | 'auto' | 'manual' = 'auto'): Promise<void> {
    if (this.running) return this.running
    if (!cloud.configured || !cloud.hasSession) {
      this.state = 'off'
      return
    }
    const manual = reason === 'manual'
    if (!manual && (!this.auto || this.paused)) return
    if (!navigator.onLine) {
      this.state = 'waiting'
      this.error = ''
      return
    }
    this.running = this.run(manual).finally(() => {
      this.running = null
    })
    return this.running
  }

  private async run(manual: boolean) {
    this.state = 'syncing'
    this.error = ''
    try {
      await store.flush()
      const local = store.snapshot()

      let remoteText: string | null = null
      const remoteFile = await cloud.run(async (token) => {
        const file = await drive.findFile(token, MAIN_FILE)
        if (file) remoteText = await drive.readText(token, file.id)
        return file
      }, manual)

      if (!remoteFile || remoteText === null) {
        // nothing in Drive yet: publish this device as the first copy
        await this.writeRemote(store.snapshot(), null, manual)
        this.summary = 'Created the Drive copy from this device.'
      } else {
        const remote = parseCloudData(remoteText)
        const { data, stats } = mergeCloudData(local, remote)

        if (this.dirty) {
          // the user is typing: keep the merged result for the next round instead of interrupting
          this.summary = 'Waiting for you to finish typing…'
          this.dirty = false
          this.schedule(1500)
          return
        }

        const applied = await store.mergeIn(data)
        if (!sameCloudData(data, remote)) await this.writeRemote(data, remoteText, manual)
        this.summary = describe(stats, applied)
      }

      this.retries = 0
      this.lastSyncAt = Date.now()
      void setMeta('lastSyncAt', this.lastSyncAt)
      this.state = 'idle'
      if (this.dirty) {
        this.dirty = false
        this.schedule(1500)
      }
    } catch (e) {
      if (e instanceof AuthError) {
        void cloud.markExpired()
        this.state = 'error'
        this.error = friendlyError(e)
        return
      }
      this.state = 'error'
      this.error = friendlyError(e)
      if (this.auto && !this.paused) {
        this.retries = Math.min(this.retries + 1, 6)
        const delay = Math.min(RETRY_BASE * 2 ** (this.retries - 1), RETRY_MAX)
        clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.syncNow('auto'), delay)
      }
    } finally {
      if (this.state === 'syncing') this.state = 'idle'
    }
  }

  private async writeRemote(data: CloudData, previous: string | null, manual: boolean) {
    const text = JSON.stringify(data)
    const rotate = manual || Date.now() - this.lastRotateAt > BACKUP_ROTATE_MS
    await cloud.run(async (token) => {
      const existing = await drive.findFile(token, MAIN_FILE)
      if (!existing) {
        await drive.createFile(token, MAIN_FILE, text)
        return
      }
      if (previous !== null) await drive.keepBackup(token, previous, rotate)
      await drive.updateFile(token, existing.id, text)
    }, manual)
    if (previous !== null && rotate) this.lastRotateAt = Date.now()
  }
}

export const sync = new Sync()
