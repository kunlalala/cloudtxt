/**
 * Images are compressed once, stored in IndexedDB and referenced from the note text by the plain
 * token [[img:<id>]]. The note JSON never contains binary data, so sync stays small.
 */
import { getImage, putImage } from './db'
import type { StoredImage } from './types'

export const MAX_EDGE = 1600
export const JPEG_QUALITY = 0.8
/** images that no note mentions are removed after this idle period */
export const IMAGE_GRACE_MS = 30 * 24 * 60 * 60 * 1000

const TOKEN = /\[\[img:([a-z0-9]+)\]\]/gi

export function imageToken(id: string) {
  return `[[img:${id}]]`
}

/** every image id mentioned in a piece of text, without duplicates */
export function imageIdsIn(text: string): string[] {
  const ids = new Set<string>()
  for (const m of text.matchAll(TOKEN)) ids.add(m[1])
  return [...ids]
}

export function stripImageTokens(text: string) {
  return text.replace(TOKEN, ' ')
}

export function newImageId() {
  // time prefix keeps ids sortable, like note ids
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Scale down to MAX_EDGE and re-encode as JPEG. A white background is painted first so a
 * transparent PNG does not turn black.
 */
export async function compressImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file is not an image this browser can read.')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('This browser cannot compress images.')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Could not compress that image.')
  return { blob, width, height }
}

/** Compress, store and return the image (or null when the file is not a usable image). */
export async function storeImageFile(file: Blob): Promise<StoredImage | null> {
  const { blob, width, height } = await compressImage(file)
  const image: StoredImage = {
    id: newImageId(),
    blob,
    type: 'image/jpeg',
    width,
    height,
    size: blob.size,
    createdAt: Date.now(),
  }
  await putImage(image)
  return image
}

/** Object URLs for the editor widgets; kept so re-rendering does not decode the same image again. */
const urls = new Map<string, string>()

export async function imageUrl(id: string): Promise<string | null> {
  const cached = urls.get(id)
  if (cached) return cached
  const image = await getImage(id)
  if (!image) return null
  const url = URL.createObjectURL(image.blob)
  urls.set(id, url)
  return url
}

export function forgetImageUrl(id: string) {
  const url = urls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urls.delete(id)
  }
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
