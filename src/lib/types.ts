export interface Folder {
  id: string
  name: string
  parentId: string | null
  updatedAt: number
  deleted?: boolean
}

/**
 * Shape of the JSON file kept in Drive appDataFolder.
 * Only folders and notes are uploaded; UI settings stay on each device.
 */
export interface CloudData {
  version: number
  /** highest updatedAt of the contained items */
  updatedAt: number
  folders: Folder[]
  notes: Note[]
}

/** A compressed image kept in IndexedDB; notes refer to it as [[img:<id>]]. */
export interface StoredImage {
  id: string
  blob: Blob
  /** always image/jpeg after compression */
  type: string
  width: number
  height: number
  /** bytes of the stored blob */
  size: number
  createdAt: number
}

export interface Note {
  id: string
  title: string
  content: string
  folderId: string | null
  updatedAt: number
  deleted?: boolean
  /** true once the user renamed the note; stops title auto-derivation */
  customTitle?: boolean
}
