<script lang="ts">
  import { HEADING_COLORS, type OutlineItem } from './headings'

  let { items, currentLine, open, desk, onjump, onclose }: {
    items: OutlineItem[]
    currentLine: number
    /** phone drawer is open */
    open: boolean
    /** desktop panel is shown */
    desk: boolean
    onjump: (line: number) => void
    onclose: () => void
  } = $props()

  // indent relative to the shallowest heading in the note, so a note that only uses ## still starts flush left
  const base = $derived(items.length ? Math.min(...items.map((i) => i.level)) : 1)

  // the heading that contains the cursor: the last one at or above the cursor line
  const current = $derived.by(() => {
    let line = -1
    for (const i of items) if (i.line <= currentLine) line = i.line
    return line
  })

  let listEl: HTMLElement | undefined = $state()
  $effect(() => {
    if (current < 0 || !listEl) return
    listEl.querySelector<HTMLElement>(`[data-line="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  })
</script>

<aside class:open class:desk aria-label="Outline">
  <div class="head">
    <span class="t">Outline</span>
    <span class="n">{items.length || ''}</span>
    <button class="x" aria-label="Close outline" onclick={onclose}>✕</button>
  </div>
  <nav bind:this={listEl}>
    {#each items as it (it.line)}
      <button
        class="item"
        class:cur={it.line === current}
        data-line={it.line}
        style:padding-left="{10 + (it.level - base) * 14}px"
        style:--c={HEADING_COLORS[it.level - 1]}
        onclick={() => onjump(it.line)}
      >
        <span class="dot"></span>
        <span class="txt" class:big={it.level === base}>{it.text}</span>
      </button>
    {:else}
      <p class="empty">No headings yet. Start a line with <code># </code> to make one.</p>
    {/each}
  </nav>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-left: 1px solid var(--border);
    width: min(85vw, 300px);
    height: 100%;
    position: fixed;
    inset: 0 0 0 auto;
    transform: translateX(100%);
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
      width: 260px;
      flex: none;
      display: none;
    }
    aside.desk {
      display: flex;
    }
    .x {
      display: none;
    }
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px 0 12px;
    min-height: 45px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }
  .t {
    font-weight: 600;
  }
  .n {
    flex: 1;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .x {
    background: none;
    border: none;
    color: var(--muted);
  }
  nav {
    flex: 1;
    overflow: auto;
    padding: 6px 0 16px;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 0;
    padding-right: 12px;
  }
  .item:hover {
    background: var(--hover);
  }
  .item.cur {
    background: var(--select);
    border-left-color: var(--c);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
    flex: none;
  }
  .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9rem;
  }
  .txt.big {
    font-weight: 600;
  }
  .empty {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
    padding: 12px;
  }
  code {
    font-family: var(--mono);
    background: var(--bg);
    padding: 1px 4px;
    border-radius: 4px;
  }
</style>
