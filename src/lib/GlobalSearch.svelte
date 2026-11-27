<script lang="ts">
  import { store, UNTITLED } from './store.svelte'
  import { searchNotes, type MatchRange, type SearchHit, type SearchOptions } from './search'

  let { onclose, onopen }: {
    onclose: () => void
    /** open a hit in the editor and reveal it */
    onopen: (hit: SearchHit, query: string, opts: SearchOptions) => void
  } = $props()

  let query = $state('')
  let wholeWord = $state(false)
  let active = $state(0)
  let inputEl = $state<HTMLInputElement>()
  let listEl = $state<HTMLElement>()

  const opts = $derived<SearchOptions>({ wholeWord })
  const result = $derived(searchNotes(store.liveNotes, store.folders, query.trim() ? query : '', opts))
  const groups = $derived(result.groups)
  /** index in `flat` where each group starts */
  const starts = $derived.by(() => {
    const out: number[] = []
    let n = 0
    for (const g of groups) {
      out.push(n)
      n += g.hits.length
    }
    return out
  })
  const flat = $derived(groups.flatMap((g) => g.hits))

  // keep the highlighted row valid when results shrink (typing or a sync removed notes)
  $effect(() => {
    if (active >= flat.length) active = 0
  })

  $effect(() => {
    inputEl?.focus()
  })

  $effect(() => {
    const i = active
    listEl?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  })

  function segments(text: string, ranges: MatchRange[]) {
    const out: { text: string; hit: boolean }[] = []
    let at = 0
    for (const r of ranges) {
      if (r.from > at) out.push({ text: text.slice(at, r.from), hit: false })
      out.push({ text: text.slice(r.from, r.to), hit: true })
      at = r.to
    }
    if (at < text.length) out.push({ text: text.slice(at), hit: false })
    return out
  }

  function move(delta: number) {
    const n = flat.length
    if (!n) return
    active = (active + delta + n) % n
  }

  function openActive() {
    const hit = flat[active]
    if (hit) onopen(hit, query, opts)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openActive()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onclose()
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="page" role="dialog" aria-modal="true" aria-label="Search all notes">
  <header>
    <button class="back" aria-label="Close search" onclick={onclose}>←</button>
    <span class="t">Search all notes</span>
    {#if query.trim()}
      <span class="summary">
        {result.lines} {result.lines === 1 ? 'result' : 'results'} in
        {groups.length} {groups.length === 1 ? 'note' : 'notes'}
      </span>
    {/if}
  </header>

  <div class="bar">
    <input
      bind:this={inputEl}
      value={query}
      type="text"
      inputmode="search"
      enterkeyhint="search"
      placeholder="Search all notes"
      aria-label="Search all notes"
      autocomplete="off"
      spellcheck="false"
      oninput={(e) => {
        query = e.currentTarget.value
        active = 0
      }}
      onkeydown={onKeydown}
    />
    <button
      class="opt"
      class:on={wholeWord}
      aria-pressed={wholeWord}
      aria-label="Match whole word"
      title="Match whole word"
      onpointerdown={(e) => e.preventDefault()}
      onclick={() => {
        wholeWord = !wholeWord
        active = 0
        inputEl?.focus()
      }}>W</button
    >
  </div>

  <div class="results" bind:this={listEl} aria-label="Search results">
    {#if !query.trim()}
      <p class="empty">Type to search inside all notes. Upper and lower case are treated the same.</p>
    {:else if !groups.length}
      <p class="empty">No results for “{query}”.</p>
    {:else}
      {#each groups as g, gi (g.noteId)}
        <section class="group">
          <div class="ghead">
            <span class="gtitle">{g.title || UNTITLED}</span>
            <span class="gpath">{g.path || 'Root'}</span>
          </div>
          {#each g.hits as h, j (h.line)}
            <button
              class="hit"
              class:act={active === starts[gi] + j}
              data-i={starts[gi] + j}
              onclick={() => onopen(h, query, opts)}
            >
              <span class="ln">{h.line}</span>
              <span class="snip">
                {#each segments(h.text, h.ranges) as s}{#if s.hit}<mark class="hl">{s.text}</mark>{:else}{s.text}{/if}{/each}
              </span>
            </button>
          {/each}
          {#if g.more}
            <p class="more">+{g.more} more matching line{g.more === 1 ? '' : 's'} in this note</p>
          {/if}
        </section>
      {/each}
      {#if result.truncated}
        <p class="more">Only the first results are shown. Narrow the search to see the rest.</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    z-index: 130;
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px 0 4px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    flex: none;
  }
  .back {
    background: none;
    border: none;
    font-size: 1.3rem;
  }
  .t {
    font-weight: 600;
    flex: none;
  }
  .summary {
    flex: 1;
    min-width: 0;
    text-align: right;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 8px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    flex: none;
  }
  .bar input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--fg);
    font: inherit;
    font-size: 16px;
  }
  .bar input:focus {
    outline: none;
    border-color: var(--accent-line);
  }
  .bar .opt {
    flex: none;
    width: 44px;
    min-width: 44px;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--muted);
    background: none;
    touch-action: manipulation;
  }
  .bar .opt.on {
    color: var(--accent);
    background: var(--accent-fill);
    border-color: var(--accent-line);
  }
  .results {
    flex: 1;
    overflow: auto;
    padding-bottom: 32px;
  }
  .group {
    max-width: 860px;
    margin: 0 auto;
  }
  .ghead {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--border);
  }
  .gtitle {
    font-weight: 600;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .gpath {
    flex: 1;
    min-width: 0;
    color: var(--muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hit {
    display: flex;
    gap: 10px;
    width: 100%;
    max-width: 860px;
    min-height: 44px;
    padding: 6px 12px;
    text-align: left;
    background: none;
    border: none;
    border-radius: 0;
    font-size: 0.9rem;
  }
  .hit:hover {
    background: var(--hover);
  }
  .hit.act {
    background: var(--select);
  }
  .ln {
    flex: none;
    width: 3em;
    padding-top: 2px;
    text-align: right;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  .snip {
    min-width: 0;
    font-family: var(--mono);
    font-size: 0.85rem;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .hl {
    background: rgba(230, 192, 123, 0.35);
    color: inherit;
    border-radius: 2px;
  }
  .empty {
    color: var(--muted);
    padding: 16px 12px;
    max-width: 860px;
    margin: 0 auto;
    font-size: 0.9rem;
  }
  .more {
    color: var(--muted);
    font-size: 0.78rem;
    padding: 2px 12px 8px 54px;
    margin: 0;
  }
</style>
