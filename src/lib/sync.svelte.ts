/**
 * Background synchronisation: merges this device with the Drive copy, then pushes the result.
 * It never blocks typing: the merge is skipped when the user typed during the round, and the
 * next round picks the new text up.
 */
import { AuthError, cloud, friendlyError, parseCloudData } from './cloud.svelte'
import { BACKUP_ROTATE_MS, MAIN_FILE } from './config'
import { deleteImages, getMeta, listImages, putImage, setMeta } from './db'
import * as drive from './drive'
import { forgetImageUrl, IMAGE_GRACE_MS, imageIdsIn } from './images'
import { mergeCloudData, sameCloudData, type MergeStats } from './merge'
import { store } from './store.svelte'
import type { CloudData, StoredImage } from './types'

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
  /** set when an image was added locally, cleared after a successful image round */
  imagesDirty = false
  private imagesSynced = false
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

  /** an image was added here: send it on the next round instead of waiting for the debounce */
  imagesChanged() {
    this.imagesDirty = true
    this.schedule(1500)
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

      let touched = false
      if (!remoteFile || remoteText === null) {
        // nothing in Drive yet: publish this device as the first copy
        await this.writeRemote(store.snapshot(), null, manual)
        this.summary = 'Created the Drive copy from this device.'
        touched = true
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
        if (!sameCloudData(data, remote)) {
          await this.writeRemote(data, remoteText, manual)
          touched = true
        }
        if (applied) touched = true
        this.summary = describe(stats, applied)
      }

      // images travel separately: only the ones a note mentions, only the missing ones
      if (touched || this.imagesDirty || !this.imagesSynced) {
        const images = await this.syncImages(manual)
        if (images) this.summary = `${this.summary} · ${images}`.replace('Everything up to date. · ', '')
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

  /**
   * Images live beside the note file (img_<id>.jpg). Upload the referenced ones Drive lacks,
   * download the referenced ones this device lacks, and drop images no note mentions any more
   * after the grace period.
   */
  private async syncImages(manual: boolean): Promise<string> {
    const referenced = new Set<string>()
    for (const note of store.notes) for (const id of imageIdsIn(note.content)) referenced.add(id)
    const local = await listImages()
    const localIds = new Set(local.map((image) => image.id))
    let uploaded = 0
    let downloaded = 0
    let removed = 0
    let failed = 0

    await cloud.run(async (token) => {
      const files = await drive.listFiles(token)
      const remote = new Map(files.map((file) => [file.name, file]))

      for (const image of local) {
        if (!referenced.has(image.id) || remote.has(`img_${image.id}.jpg`)) continue
        try {
          await drive.createBinaryFile(token, `img_${image.id}.jpg`, image.blob, image.type || 'image/jpeg')
          uploaded++
        } catch (e) {
          failed++
          console.error('[cloudtxt] image upload failed', e)
        }
      }

      for (const id of referenced) {
        if (localIds.has(id)) continue
        const file = remote.get(`img_${id}.jpg`)
        if (!file) continue
        try {
          const blob = await drive.readBlob(token, file.id)
          const bitmap = await createImageBitmap(blob)
          const stored: StoredImage = {
            id,
            blob,
            type: 'image/jpeg',
            width: bitmap.width,
            height: bitmap.height,
            size: blob.size,
            createdAt: file.modifiedTime ? Date.parse(file.modifiedTime) || Date.now() : Date.now(),
          }
          bitmap.close?.()
          await putImage(stored)
          downloaded++
        } catch (e) {
          failed++
          console.error('[cloudtxt] image download failed', e)
        }
      }

      const cutoff = Date.now() - IMAGE_GRACE_MS
      const orphans = local.filter((image) => !referenced.has(image.id) && image.createdAt < cutoff)
      if (orphans.length) {
        await deleteImages(orphans.map((image) => image.id))
        for (const image of orphans) {
          forgetImageUrl(image.id)
          const file = remote.get(`img_${image.id}.jpg`)
          if (!file) continue
          try {
            await drive.deleteFile(token, file.id)
            removed++
          } catch {
            // try again next round
          }
        }
      }
    }, manual)

    // a failed image is retried on the next round instead of being forgotten
    this.imagesDirty = failed > 0
    this.imagesSynced = true

    const parts: string[] = []
    if (uploaded) parts.push(`${uploaded} image${uploaded === 1 ? '' : 's'} uploaded`)
    if (downloaded) parts.push(`${downloaded} image${downloaded === 1 ? '' : 's'} downloaded`)
    if (removed) parts.push(`${removed} unused image${removed === 1 ? '' : 's'} removed`)
    if (failed) parts.push(`${failed} image${failed === 1 ? '' : 's'} could not be synced`)
    return parts.join(', ')
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
