import type { Kind } from './store.svelte'

export type DialogState =
  | { mode: 'prompt'; title: string; value: string; onok: (v: string) => void }
  | { mode: 'confirm'; title: string; message: string; onok: () => void }
  | { mode: 'menu'; title: string; actions: { label: string; danger?: boolean; run: () => void }[] }
  | { mode: 'move'; kind: Kind; id: string; title: string }
