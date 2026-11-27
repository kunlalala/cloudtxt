<script lang="ts">
  import { store } from './store.svelte'
  import type { DialogState } from './dialog'

  let { dialog, onclose }: { dialog: DialogState; onclose: () => void } = $props()

  let input = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    if (dialog.mode === 'prompt') input = dialog.value
  })
  $effect(() => {
    inputEl?.focus()
    inputEl?.select()
  })

  const targets = $derived.by(() => {
    if (dialog.mode !== 'move') return []
    const blocked = dialog.kind === 'folder' ? store.folderTree(dialog.id) : new Set<string>()
    const current =
      dialog.kind === 'folder'
        ? store.folders.find((f) => f.id === dialog.id)?.parentId
        : store.notes.find((n) => n.id === dialog.id)?.folderId
    const list: { id: string | null; name: string; depth: number; here: boolean }[] = [
      { id: null, name: 'Root', depth: 0, here: current === null },
    ]
    const walk = (parent: string | null, depth: number) => {
      const subs = store.liveFolders
        .filter((f) => f.parentId === parent && !blocked.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name))
      for (const f of subs) {
        list.push({ id: f.id, name: f.name, depth, here: current === f.id })
        walk(f.id, depth + 1)
      }
    }
    walk(null, 1)
    return list
  })

  function submit(e: Event) {
    e.preventDefault()
    if (dialog.mode === 'prompt') {
      dialog.onok(input)
      onclose()
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose}>
  <div class="sheet" role="dialog" tabindex="-1" aria-modal="true" onclick={(e) => e.stopPropagation()}>
    <h3>{dialog.title}</h3>

    {#if dialog.mode === 'prompt'}
      <form onsubmit={submit}>
        <input bind:this={inputEl} bind:value={input} maxlength="120" />
        <div class="btns">
          <button type="button" onclick={onclose}>Cancel</button>
          <button type="submit" class="primary">OK</button>
        </div>
      </form>
    {:else if dialog.mode === 'confirm'}
      <p>{dialog.message}</p>
      <div class="btns">
        <button onclick={onclose}>Cancel</button>
        <button
          class="danger"
          onclick={() => {
            if (dialog.mode === 'confirm') dialog.onok()
            onclose()
          }}>Delete</button
        >
      </div>
    {:else if dialog.mode === 'menu'}
      <div class="list">
        {#each dialog.actions as a}
          <button
            class:danger-text={a.danger}
            onclick={() => {
              onclose()
              a.run()
            }}>{a.label}</button
          >
        {/each}
      </div>
    {:else if dialog.mode === 'move'}
      <div class="list">
        {#each targets as t (t.id ?? 'root')}
          <button
            disabled={t.here}
            style:padding-left="{12 + t.depth * 16}px"
            onclick={() => {
              if (dialog.mode === 'move') store.move(dialog.kind, dialog.id, t.id)
              onclose()
            }}>{t.id === null ? '' : '📁 '}{t.name}{t.here ? ' (current location)' : ''}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .sheet {
    background: var(--panel);
    border: 1px solid var(--border);
    width: 100%;
    max-width: 420px;
    max-height: 80dvh;
    overflow: auto;
    border-radius: 12px 12px 0 0;
    padding: 16px;
  }
  @media (min-width: 768px) {
    .overlay {
      align-items: center;
    }
    .sheet {
      border-radius: 12px;
    }
  }
  h3 {
    margin: 0 0 12px;
    font-size: 1rem;
    word-break: break-all;
  }
  p {
    margin: 0 0 16px;
    color: var(--muted);
  }
  input {
    width: 100%;
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 12px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 16px;
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }
  .btns button {
    min-width: 88px;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .list button {
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 0 12px;
  }
  .list button:disabled {
    opacity: 0.45;
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
  .danger-text {
    color: #ff6b6b;
  }
</style>
