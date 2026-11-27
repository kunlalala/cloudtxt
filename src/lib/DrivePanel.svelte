<script lang="ts">
  import { onMount } from 'svelte'
  import { cloud } from './cloud.svelte'
  import { sync } from './sync.svelte'
  import { store } from './store.svelte'
  import { BACKUP_FILE, MAIN_FILE } from './config'

  let { onclose }: { onclose: () => void } = $props()

  let confirming = $state(false)

  onMount(() => {
    // silent: opening the panel must never trigger a Google pop-up by itself
    if (cloud.status === 'signed-in') void cloud.refreshFiles(true)
  })

  function ago(ms: number) {
    if (!ms) return ''
    const s = Math.round((Date.now() - ms) / 1000)
    if (s < 45) return 'just now'
    if (s < 90) return '1 min ago'
    if (s < 3600) return `${Math.round(s / 60)} min ago`
    return `${Math.round(s / 3600)} h ago`
  }

  const syncText = $derived(
    sync.state === 'syncing'
      ? 'Syncing…'
      : sync.state === 'waiting'
        ? 'Waiting for a network connection'
        : sync.state === 'error'
          ? 'Sync failed'
          : !sync.auto
            ? 'Automatic sync is off'
            : sync.lastSyncAt
              ? `Synced ${ago(sync.lastSyncAt)}`
              : 'Not synced yet',
  )

  async function signIn() {
    await cloud.signIn()
    if (cloud.status === 'signed-in') void sync.syncNow('manual')
  }

  async function upload() {
    const resume = sync.pause()
    try {
      await cloud.uploadLocal()
    } finally {
      resume()
    }
    sync.refreshState()
    if (!cloud.error) {
      sync.imagesChanged()
      void sync.syncNow('manual')
    }
  }

  async function download() {
    confirming = false
    const resume = sync.pause()
    try {
      await cloud.downloadRemote()
    } finally {
      resume()
    }
    sync.refreshState()
    if (!cloud.error) {
      sync.imagesChanged()
      void sync.syncNow('manual')
    }
  }

  const label = $derived(
    cloud.status === 'signed-in'
      ? 'Connected'
      : cloud.status === 'connecting'
        ? 'Signing in…'
        : cloud.status === 'expired'
          ? 'Session expired'
          : 'Not connected',
  )

  const busyText = $derived(
    cloud.busy === 'upload'
      ? 'Uploading…'
      : cloud.busy === 'download'
        ? 'Downloading…'
        : cloud.busy === 'refresh'
          ? 'Checking Drive…'
          : '',
  )

  const main = $derived(cloud.files.find((f) => f.name === MAIN_FILE))
  const backup = $derived(cloud.files.find((f) => f.name === BACKUP_FILE))

  function fmt(iso?: string) {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  function fmtTime(ms: number) {
    return ms ? new Date(ms).toLocaleString() : ''
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose}>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label="Google Drive"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
  >
    <header>
      <h3>Google Drive</h3>
      <button class="close" aria-label="Close" onclick={onclose}>✕</button>
    </header>

    <p class="status" class:on={cloud.status === 'signed-in'} class:warn={cloud.status === 'expired'}>
      <span class="dot"></span>
      {label}
    </p>

    {#if !cloud.configured}
      <p class="note warn-text">
        This build has no Google Client ID. Put it in <code>src/lib/config.ts</code> and rebuild.
      </p>
    {:else if cloud.status !== 'signed-in'}
      <p class="note">
        Sign in with Google to upload a copy of your notes to the hidden app folder of your Drive. The rest of
        your Drive stays invisible to cloudtxt.
      </p>
      <button class="wide primary" disabled={cloud.status === 'connecting'} onclick={signIn}>
        {cloud.status === 'expired' ? 'Sign in again' : 'Sign in with Google'}
      </button>
    {:else}
      <div class="synccard">
        <div class="row">
          <span class="sync-now">
            <span class="dot" class:on={sync.state === 'syncing'} class:warn={sync.state === 'error'}></span>
            {syncText}
          </span>
          <button disabled={!!cloud.busy || sync.state === 'syncing'} onclick={() => sync.syncNow('manual')}>
            Sync now
          </button>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            checked={sync.auto}
            onchange={(e) => sync.setAuto(e.currentTarget.checked)}
          />
          Sync automatically (after edits, on start, when back online)
        </label>
        {#if sync.summary}<p class="note">{sync.summary}</p>{/if}
        {#if sync.error}<p class="error">{sync.error}</p>{/if}
      </div>
      <div class="row">
        <button class="primary" disabled={!!cloud.busy} onclick={upload}>Upload to Drive</button>
        <button disabled={!!cloud.busy} onclick={() => (confirming = true)}>Download</button>
      </div>
      <p class="note">
        Automatic sync merges note by note, so both devices keep their changes. The two buttons below are the
        manual override: Upload replaces the Drive copy with this device (the old copy is kept as
        <code>{BACKUP_FILE}</code>), Download replaces this device with the Drive copy.
      </p>
      {#if confirming}
        <div class="confirm">
          <p>
            Download replaces everything on this device with the Drive copy. Your current local notes are saved
            first and can be restored below. Continue?
          </p>
          <div class="row">
            <button onclick={() => (confirming = false)}>Cancel</button>
            <button class="danger" disabled={!!cloud.busy} onclick={download}>Replace local notes</button>
          </div>
        </div>
      {/if}
      {#if store.localBackupAt}
        <div class="backup">
          <span>
            Local copy saved before the last download ({fmtTime(store.localBackupAt)}).
          </span>
          <button disabled={!!cloud.busy} onclick={() => cloud.restoreLocal()}>Restore it</button>
        </div>
      {/if}
    {/if}

    {#if busyText}
      <p class="busy">{busyText}</p>
    {/if}
    {#if cloud.error}
      <p class="error">{cloud.error}</p>
    {/if}
    {#if cloud.message}
      <p class="ok">{cloud.message}</p>
    {/if}

    {#if cloud.status === 'signed-in'}
      <section class="files">
        <div class="files-head">
          <span>Files in app data folder</span>
          <button class="link" disabled={!!cloud.busy} onclick={() => cloud.refreshFiles()}>Refresh</button>
        </div>
        {#if cloud.files.length === 0}
          <p class="note">Nothing yet.</p>
        {:else}
          <ul>
            {#each cloud.files as f (f.id)}
              <li>
                <span class="name">{f.name}</span>
                <span class="when">{fmt(f.modifiedTime)}</span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if main}
          <p class="note">
            Last upload: {fmt(main.modifiedTime)}. {backup
              ? `Previous version kept as ${BACKUP_FILE}.`
              : 'No older copy in Drive yet.'}
          </p>
        {/if}
      </section>

      <section class="about">
        <p class="note">
          Uploaded: folders and notes only (including items marked deleted). Kept on this device: indent width,
          outline setting, folded lines, and the Google token. Scope: <code>drive.appdata</code>.
        </p>
      </section>

      <button class="wide" disabled={!!cloud.busy} onclick={() => cloud.signOut()}>Sign out</button>
    {/if}

    <p class="note foot">
      Signing in is optional: the app keeps working offline and without Google. While signed in, changes go up
      on their own; the manual buttons exist for the rare case when you want to force one direction.
    </p>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 110;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sheet {
    background: var(--panel);
    border: 1px solid var(--border);
    width: 100%;
    max-width: 460px;
    max-height: 88dvh;
    overflow: auto;
    border-radius: 12px 12px 0 0;
    padding: 8px 16px 24px;
    box-sizing: border-box;
  }
  @media (min-width: 768px) {
    .overlay {
      align-items: center;
    }
    .sheet {
      border-radius: 12px;
    }
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 12px 0;
    flex: 1;
    font-size: 1rem;
  }
  .close {
    width: 44px;
    height: 44px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.1rem;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }
  .status.on .dot {
    background: var(--accent);
  }
  .status.warn .dot {
    background: #e6c07b;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    flex: 1;
    min-height: 44px;
  }
  .wide {
    width: 100%;
    min-height: 44px;
  }
  .primary {
    background: var(--accent-fill);
    color: var(--accent);
    border-color: var(--accent-line);
    font-weight: 600;
  }
  .danger {
    background: #c0392b;
    color: #fff;
    border-color: transparent;
  }
  .note {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 10px 0;
  }
  .note.warn-text {
    color: #e6c07b;
  }
  code {
    background: var(--bg);
    border-radius: 4px;
    padding: 0 4px;
    font-size: 0.85em;
  }
  .confirm {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px 12px 12px;
    margin: 10px 0;
  }
  .confirm p {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--fg);
  }
  .backup {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .backup span {
    flex: 1;
    min-width: 160px;
  }
  .synccard {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px 10px 8px;
    margin: 0 0 12px;
  }
  .synccard .row {
    align-items: center;
  }
  .synccard .row button {
    flex: none;
    min-width: 96px;
  }
  .sync-now {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--muted);
    min-height: 44px;
  }
  .sync-now .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    flex: none;
  }
  .sync-now .dot.on {
    background: var(--accent);
    animation: pulse 1s ease-in-out infinite;
  }
  .sync-now .dot.warn {
    background: #e6c07b;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-size: 0.85rem;
    color: var(--fg);
    cursor: pointer;
  }
  .toggle input {
    width: 20px;
    height: 20px;
    flex: none;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
    }
  }
  .busy {
    color: var(--accent);
    font-size: 0.85rem;
    margin: 10px 0;
  }
  .error {
    color: #ff6b6b;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 10px 0;
  }
  .ok {
    color: #98c379;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 10px 0;
  }
  .files {
    margin: 14px 0 0;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .files-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .link {
    background: none;
    border: none;
    color: var(--accent);
    padding: 0 4px;
    min-height: 32px;
  }
  ul {
    list-style: none;
    margin: 4px 0;
    padding: 0;
  }
  li {
    display: flex;
    flex-direction: column;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
  }
  .name {
    font-family: var(--mono, monospace);
  }
  .when {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .about {
    margin-top: 6px;
  }
  .foot {
    border-top: 1px solid var(--border);
    padding-top: 10px;
    margin-top: 14px;
  }
</style>
