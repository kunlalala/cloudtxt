export interface Folder {
  id: string
  name: string
  parentId: string | null
  updatedAt: number
  deleted?: boolean
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
