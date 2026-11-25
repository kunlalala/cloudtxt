<script lang="ts">
  import { store, type Kind, type Row } from './store.svelte'
  import type { DialogState } from './dialog'

  let { open, ondialog, onclosedrawer, onguide, onhelp }: {
    open: boolean
    ondialog: (d: DialogState) => void
    onclosedrawer: () => void
    onguide: () => void
    onhelp: () => void
  } = $props()

  function newNote() {
    store.addNote()
    onclosedrawer()
  }

  function newFolder(parentId: string | null) {
    ondialog({
      mode: 'prompt',
      title: parentId ? `New folder in "${store.folderPath(parentId)}"` : 'New folder',
      value: '',
      onok: (v) => store.addFolder(v, parentId),
    })
  }

  function rowMenu(row: Row) {
    const kind: Kind = row.kind
    const actions: { label: string; danger?: boolean; run: () => void }[] = []
    if (kind === 'folder') {
      actions.push({ label: 'New note', run: () => store.addNote(row.id) })
      actions.push({ label: 'New subfolder', run: () => newFolder(row.id) })
    }
    actions.push({
      label: 'Rename',
      run: () =>
        ondialog({
          mode: 'prompt',
          title: kind === 'folder' ? 'Rename folder' : 'Rename note (leave empty to use the automatic title)',
          value: kind === 'folder' ? row.name : (store.notes.find((n) => n.id === row.id)?.customTitle ? row.name : ''),
          onok: (v) => store.rename(kind, row.id, v),
        }),
    })
    actions.push({
      label: 'Move to…',
      run: () => ondialog({ mode: 'move', kind, id: row.id, title: `Move "${row.name}" to` }),
    })
    actions.push({
      label: 'Delete',
      danger: true,
      run: () =>
        ondialog({
          mode: 'confirm',
          title: `Delete "${row.name}"?`,
          message: kind === 'folder' ? 'All subfolders and notes inside will be deleted too.' : 'This note will be deleted.',
          onok: () => store.remove(kind, row.id),
        }),
    })
    ondialog({ mode: 'menu', title: row.name, actions })
  }

  function click(row: Row) {
    if (row.kind === 'folder') store.toggle(row.id)
    else {
      store.select(row.id)
      onclosedrawer()
    }
  }
</script>

<aside class:open>
  <div class="head">
    <button class="primary" onclick={newNote}>＋ Note</button>
    <button onclick={() => newFolder(store.activeFolderId)}>＋ Folder</button>
  </div>
  <div class="path">{store.activeFolderId ? store.folderPath(store.activeFolderId) : 'Root'}</div>
  <nav>
    {#each store.rows as row (row.kind + row.id)}
      <div
        class="row"
        class:sel={row.kind === 'note' && row.id === store.selectedId}
        class:act={row.kind === 'folder' && row.id === store.activeFolderId}
        style:padding-left="{4 + row.depth * 16}px"
      >
        <button class="main" onclick={() => click(row)}>
          <span class="ico">{row.kind === 'folder' ? (row.open ? '▾' : '▸') : '📄'}</span>
          <span class="name">{row.name}</span>
        </button>
        <button class="more" aria-label="More actions" onclick={() => rowMenu(row)}>⋯</button>
      </div>
    {:else}
      <p class="empty">No notes yet. Tap "＋ Note" to start.</p>
    {/each}
  </nav>
  <div class="foots">
    <button class="foot" onclick={onhelp}>Help</button>
    <button class="foot" onclick={onguide}>Delete app guide</button>
  </div>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--border);
    width: min(85vw, 320px);
    height: 100%;
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    z-index: 50;
  }
  aside.open {
    transform: none;
  }
  @media (min-width: 768px) {
    aside {
      position: static;
      transform: none;
      width: 280px;
      flex: none;
    }
  }
  .head {
    display: flex;
    gap: 8px;
    padding: 8px;
  }
  .head button {
    flex: 1;
  }
  .path {
    padding: 0 12px 6px;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  nav {
    flex: 1;
    overflow: auto;
    padding-bottom: 16px;
  }
  .row {
    display: flex;
    align-items: stretch;
    padding-right: 4px;
  }
  .row:hover {
    background: var(--hover);
  }
  .row.sel {
    background: var(--select);
  }
  .row.act .name {
    color: var(--accent);
  }
  button {
    background: none;
    border: none;
  }
  .head button {
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .head .primary {
    background: var(--accent);
    color: #0b1220;
    border-color: transparent;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    padding: 0 8px;
  }
  .ico {
    width: 1.2em;
    flex: none;
    text-align: center;
    color: var(--muted);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more {
    width: 44px;
    flex: none;
    color: var(--muted);
    font-size: 1.2rem;
  }
  .foots {
    flex: none;
    display: flex;
    border-top: 1px solid var(--border);
  }
  .foot {
    flex: 1;
    border: none;
    border-radius: 0;
    color: var(--muted);
    font-size: 0.85rem;
    text-align: left;
    padding: 0 12px;
  }
  .foot + .foot {
    border-left: 1px solid var(--border);
  }
  .empty {
    color: var(--muted);
    padding: 12px;
    font-size: 0.9rem;
  }
</style>
