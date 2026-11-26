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
