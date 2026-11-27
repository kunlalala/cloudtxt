<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import Editor from './lib/Editor.svelte'
  import Dialog from './lib/Dialog.svelte'
  import Guide from './lib/Guide.svelte'
  import Help from './lib/Help.svelte'
  import GlobalSearch from './lib/GlobalSearch.svelte'
  import Outline from './lib/Outline.svelte'
  import DrivePanel from './lib/DrivePanel.svelte'
  import ImageViewer from './lib/ImageViewer.svelte'
  import { storeImageFile } from './lib/images'
  import type { OutlineItem } from './lib/headings'
  import type { SearchHit, SearchOptions } from './lib/search'
  import type { DialogState } from './lib/dialog'
  import { store, UNTITLED, TAB_SIZES } from './lib/store.svelte'
  import { pwa } from './lib/pwa.svelte'
  import { cloud } from './lib/cloud.svelte'
  import { sync } from './lib/sync.svelte'

  let drawer = $state(false)
  let outlineDrawer = $state(false)
  let dialog = $state<DialogState | null>(null)
  let guideOpen = $state(false)
  let helpOpen = $state(false)
  let cloudOpen = $state(false)
  let searchOpen = $state(false)
  let viewImage = $state<string | null>(null)
  let fileInput = $state<HTMLInputElement>()
  let editor = $state<Editor>()
  let outline = $state.raw<OutlineItem[]>([])
  let cursorLine = $state(0)
  let appH = $state(0)
  let appTop = $state(0)

  /** session-scoped dismissal of the "not connected" notice, keyed by reason */
  const NOTICE_KEY = 'cloudtxt.dismissedNotices'
  let online = $state(navigator.onLine)
  let noticeReady = $state(false)
  let dismissed = $state<string[]>(readDismissed())
  let wasConnected = false

  function readDismissed(): string[] {
    try {
      const raw = sessionStorage.getItem(NOTICE_KEY)
      const list: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }

  function writeDismissed(keys: string[]) {
    dismissed = keys
    try {
      if (keys.length) sessionStorage.setItem(NOTICE_KEY, JSON.stringify(keys))
      else sessionStorage.removeItem(NOTICE_KEY)
    } catch {
      // storage disabled: the notice simply comes back on the next visit
    }
  }

  const connected = $derived(online && cloud.status === 'signed-in' && sync.state !== 'error')
  /** the most specific reason why this device is not talking to Drive right now */
  const notice = $derived.by(() => {
    if (!noticeReady) return null
    if (cloud.status === 'expired')
      return { key: 'expired', text: 'Google sign-in expired. Notes stay on this device — tap the cloud icon to sign in again.' }
    if (cloud.status === 'signed-out')
      return { key: 'signed-out', text: 'Not signed in. Notes are saved on this device only — tap the cloud icon to connect Google Drive.' }
    if (sync.state === 'error' && sync.error)
      return { key: `sync:${sync.error}`, text: `Not connected: ${sync.error} Notes stay on this device.` }
    if (!online)
      return { key: 'offline', text: 'Not connected: you are offline. Notes are saved on this device; sync runs again when the connection is back.' }
    return null
  })
  const showNotice = $derived.by(() => !!notice && !dismissed.includes(notice.key))

  // a restored connection starts a fresh round of notices for the next failure
  $effect(() => {
    if (connected) {
      if (!wasConnected) writeDismissed([])
      wasConnected = true
    } else {
      wasConnected = false
    }
  })

  function dismissNotice() {
    if (notice && !dismissed.includes(notice.key)) writeDismissed([...dismissed, notice.key])
  }

  const isDesktop = () => window.matchMedia('(min-width: 768px)').matches

  function toggleOutline() {
    if (isDesktop()) store.setOutlineOpen(!store.outlineOpen)
    else outlineDrawer = !outlineDrawer
  }

  function jump(line: number) {
    editor?.goToLine(line)
    outlineDrawer = false
  }

  function openSearch() {
    searchOpen = true
    drawer = false
    outlineDrawer = false
  }

  /** Open a global-search hit: switch note, then show the find bar on that match. */
  async function openHit(hit: SearchHit, query: string, opts: SearchOptions) {
    searchOpen = false
    store.select(hit.noteId)
    await tick()
    editor?.findInNote(query, opts, hit.offset)
  }

  function pickImage() {
    fileInput?.click()
  }

  /** compress + store every picked file, then paste the tokens into the open note */
  async function insertImages(files: File[]) {
    if (!files.length) return
    if (!store.selected) {
      store.addNote()
      await tick()
    }
    const ids: string[] = []
    for (const file of files) {
      try {
        const image = await storeImageFile(file)
        if (image) ids.push(image.id)
      } catch (e) {
        console.error('[cloudtxt] image insert failed', e)
      }
    }
    if (!ids.length) return
    editor?.insertImageTokens(ids)
    sync.imagesChanged()
  }

  function onFilesPicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = input.files ? [...input.files] : []
    input.value = ''
    void insertImages(files)
  }

  onMount(() => {
    void (async () => {
      await store.init()
      await cloud.init()
      noticeReady = true
      sync.init()
      if (cloud.hasSession) void sync.syncNow('start')
    })()
    pwa.init()
    const flush = () => void store.flush()
    const onVis = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)

    const onOnline = () => (online = true)
    const onOffline = () => (online = false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Ctrl/Cmd+F finds inside the open note; Ctrl/Cmd+Shift+F searches every note. While a panel
    // or dialog is open the shortcuts stay out of the way (and keep the browser's own find closed).
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      if (helpOpen || guideOpen || cloudOpen || searchOpen || dialog || viewImage) return
      if (e.shiftKey) openSearch()
      else if (store.selected) editor?.openFind()
      else openSearch()
    }
    window.addEventListener('keydown', onShortcut, true)

    // Phones keep the layout viewport full-height when the keyboard opens, so follow the visual
    // viewport instead; this keeps the toolbar right above the keyboard.
    const vv = window.visualViewport
    const fit = () => {
      if (!vv) return
      appH = vv.height
      appTop = vv.offsetTop
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('keydown', onShortcut, true)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
    }
  })
</script>

<div class="app" style:height={appH ? `${appH}px` : undefined} style:transform={appTop ? `translateY(${appTop}px)` : undefined}>
  <Sidebar
    open={drawer}
    ondialog={(d) => (dialog = d)}
    onclosedrawer={() => (drawer = false)}
    onguide={() => ((guideOpen = true), (drawer = false))}
    onhelp={() => ((helpOpen = true), (drawer = false))}
    onimage={() => (drawer = false, pickImage())}
  />
  {#if drawer || outlineDrawer}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => ((drawer = false), (outlineDrawer = false))}></div>
  {/if}

  <main>
    <header>
      <button class="menu" aria-label="Open sidebar" onclick={() => (drawer = true)}>☰</button>
      <span class="title">{store.selected ? store.selected.title || UNTITLED : 'cloudtxt'}</span>
      <select
        aria-label="Indent width (applies to all notes)"
        title="Indent width (applies to all notes)"
        value={store.tabSize}
        onchange={(e) => store.setTabSize(Number(e.currentTarget.value))}
      >
        {#each TAB_SIZES as n}<option value={n}>Indent {n}</option>{/each}
      </select>
      <button class="search" aria-label="Search all notes" title="Search all notes (Ctrl+Shift+F)" onclick={openSearch}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4.5 4.5" />
        </svg>
      </button>
      <button
        class="cloud"
        class:on={cloud.status === 'signed-in'}
        class:warn={cloud.status === 'expired' || sync.state === 'error'}
        class:syncing={sync.state === 'syncing'}
        aria-label="Google Drive"
        title="Google Drive"
        onclick={() => (cloudOpen = true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.2 9.5A4.25 4.25 0 0 0 6.5 19z" />
        </svg>
        {#if cloud.status !== 'signed-out'}<span class="dot"></span>{/if}
      </button>
      <button
        class="ol"
        class:on={store.outlineOpen}
        aria-label="Outline"
        title="Outline (headings)"
        onclick={toggleOutline}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M3 5h14M7 10h10M11 15h6" />
        </svg>
      </button>
    </header>
    <div class="body">
      {#if !store.ready}
        <p class="hint">Loading…</p>
      {:else if store.selected}
        <div class="ed">
          <Editor
            bind:this={editor}
            noteId={store.selected.id}
            content={store.selected.content}
            tabSize={store.tabSize}
            getFolds={store.getFolds}
            onfolds={store.setFolds}
            onoutline={(items) => (outline = items)}
            oncursor={(l) => (cursorLine = l)}
            onchange={(v) => store.edit(v)}
            remoteStamp={store.remoteStamp}
            onimagefiles={(files) => void insertImages(files)}
            onimageopen={(id) => (viewImage = id)}
            onimagemissing={() => sync.imagesChanged()}
          />
        </div>
        <!-- pointerdown is cancelled so the editor keeps focus and the keyboard stays open -->
        <div class="tools" role="toolbar" aria-label="Editing tools">
          <button aria-label="Undo" title="Undo" onpointerdown={(e) => (e.preventDefault(), editor?.run('undo'))}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5 4 9l4 4" /><path d="M4 9h9a5 5 0 0 1 0 10H9" /></svg>
          </button>
          <button aria-label="Redo" title="Redo" onpointerdown={(e) => (e.preventDefault(), editor?.run('redo'))}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5 4 4-4 4" /><path d="M18 9H9a5 5 0 0 0 0 10h4" /></svg>
          </button>
          <span class="sep"></span>
          <button aria-label="Insert image" title="Insert image" onpointerdown={(e) => (e.preventDefault(), pickImage())}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="16" height="14" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 16 5-4 4 3 2-2 3 3" /></svg>
          </button>
          <span class="sep"></span>
          <button aria-label="Unindent" title="Unindent (Shift+Tab)" onpointerdown={(e) => (e.preventDefault(), editor?.run('unindent'))}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v14" /><path d="M19 11H8" /><path d="m11 7-4 4 4 4" /></svg>
          </button>
          <button aria-label="Indent" title="Indent (Tab)" onpointerdown={(e) => (e.preventDefault(), editor?.run('indent'))}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4v14" /><path d="M3 11h11" /><path d="m11 7 4 4-4 4" /></svg>
          </button>
        </div>
      {:else}
        <p class="hint">Select or create a note.</p>
      {/if}
    </div>
  </main>
  <Outline
    items={store.selected ? outline : []}
    currentLine={cursorLine}
    open={outlineDrawer}
    desk={store.outlineOpen}
    onjump={jump}
    onclose={() => (outlineDrawer = false)}
  />
</div>

{#if pwa.updateReady || pwa.offlineReady || showNotice}
  <div class="toasts">
    {#if pwa.updateReady}
      <div class="toast" role="status">
        <span>A new version is ready.</span>
        <button class="go" onclick={() => pwa.update()}>Update</button>
        <button class="later" aria-label="Later" onclick={() => (pwa.updateReady = false)}>✕</button>
      </div>
    {:else if pwa.offlineReady}
      <div class="toast" role="status">
        <span>Ready to work offline.</span>
        <button class="later" aria-label="Close" onclick={() => (pwa.offlineReady = false)}>✕</button>
      </div>
    {/if}
    {#if showNotice && notice}
      <div class="toast notice" role="status">
        <span>{notice.text}</span>
        <button class="later" aria-label="Dismiss" onclick={dismissNotice}>✕</button>
      </div>
    {/if}
  </div>
{/if}

<input class="file" type="file" accept="image/*" multiple bind:this={fileInput} onchange={onFilesPicked} />

{#if viewImage}
  <ImageViewer id={viewImage} onclose={() => (viewImage = null)} />
{/if}

{#if dialog}
  <Dialog {dialog} onclose={() => (dialog = null)} />
{/if}
{#if guideOpen}
  <Guide onclose={() => (guideOpen = false)} />
{/if}
{#if helpOpen}
  <Help onclose={() => (helpOpen = false)} />
{/if}
{#if searchOpen}
  <GlobalSearch onclose={() => (searchOpen = false)} onopen={(hit, query, opts) => void openHit(hit, query, opts)} />
{/if}
{#if cloudOpen}
  <DrivePanel onclose={() => (cloudOpen = false)} />
{/if}

<style>
  .app {
    display: flex;
    height: 100dvh;
  }
  main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    padding: 0 4px;
    flex: none;
  }
  .menu {
    width: 44px;
    background: none;
    border: none;
    font-size: 1.3rem;
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  select {
    min-height: 44px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1.5l5 5 5-5' fill='none' stroke='%237f8794' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>")
      no-repeat right 8px center;
    color: var(--muted);
    border: none;
    padding: 0 28px 0 8px;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  select:hover {
    color: var(--fg);
  }
  select option {
    background: var(--panel);
    color: var(--fg);
  }
  .cloud,
  .search,
  .ol {
    position: relative;
    width: 44px;
    height: 44px;
    padding: 0;
    background: none;
    border: none;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cloud:hover,
  .search:hover,
  .ol:hover {
    color: var(--fg);
  }
  .cloud.on {
    color: var(--accent);
  }
  .cloud.warn {
    color: #e6c07b;
  }
  .cloud .dot {
    position: absolute;
    right: 9px;
    bottom: 9px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .cloud.syncing {
    color: var(--accent);
  }
  .cloud.syncing .dot {
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.2;
    }
  }
  @media (min-width: 768px) {
    .ol.on {
      color: var(--accent);
    }
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .ed {
    flex: 1;
    min-height: 0;
  }
  .tools {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 0 8px;
    background: var(--panel);
    border-top: 1px solid var(--border);
  }
  .tools button {
    flex: 1;
    max-width: 96px;
    height: 48px;
    padding: 0;
    background: none;
    border: none;
    color: var(--fg);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
  }
  .tools button:active {
    background: var(--hover);
  }
  .sep {
    width: 1px;
    height: 24px;
    background: var(--border);
  }
  @media (min-width: 768px) and (pointer: fine) {
    .tools {
      display: none;
    }
  }
  .toasts {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 64px;
    max-width: 420px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 90;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 14px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    pointer-events: auto;
  }
  .toast.notice {
    border-color: var(--accent-line);
  }
  .toast span {
    flex: 1;
  }
  .toast .go {
    background: var(--accent-fill);
    color: var(--accent);
    border-color: var(--accent-line);
    font-weight: 600;
  }
  .toast .later {
    background: none;
    border: none;
    color: var(--muted);
  }
  @media (min-width: 768px) {
    .toasts {
      bottom: 16px;
      right: 16px;
      left: auto;
      width: 420px;
      margin: 0;
    }
  }
  .hint {
    color: var(--muted);
    padding: 24px;
  }
  .file {
    display: none;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 40;
  }
  @media (min-width: 768px) {
    .menu,
    .backdrop {
      display: none;
    }
    .title {
      padding-left: 12px;
    }
  }
</style>
