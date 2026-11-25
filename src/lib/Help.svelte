<script lang="ts">
  import { help, HELP_UPDATED } from './help'

  let { onclose }: { onclose: () => void } = $props()

  let open = $state<string[]>([])

  function toggle(id: string) {
    open = open.includes(id) ? open.filter((x) => x !== id) : [...open, id]
  }

  function setAll(on: boolean) {
    open = on ? help.map((s) => s.id) : []
  }

  /** Split on backticks so `like this` renders as inline code. */
  function parts(text: string) {
    return text.split('`').map((t, i) => ({ t, code: i % 2 === 1 }))
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="page" role="dialog" tabindex="-1" aria-modal="true" aria-label="Help">
  <header>
    <button class="back" aria-label="Close" onclick={onclose}>←</button>
    <span class="t">Help</span>
    <button class="small" onclick={() => setAll(open.length < help.length)}>
      {open.length < help.length ? 'Expand all' : 'Collapse all'}
    </button>
  </header>
  <div class="content">
    <p class="intro">Tap a title to read that part. Covers: {HELP_UPDATED}.</p>
    {#each help as s (s.id)}
      <section class:open={open.includes(s.id)}>
        <button class="head" aria-expanded={open.includes(s.id)} onclick={() => toggle(s.id)}>
          <span class="arrow">{open.includes(s.id) ? '▾' : '▸'}</span>
          <span>{s.title}</span>
        </button>
        {#if open.includes(s.id)}
          <div class="blocks">
            {#each s.blocks as b}
              {#if b.type === 'p'}
                <p>{#each parts(b.text) as x}{#if x.code}<code>{x.t}</code>{:else}{x.t}{/if}{/each}</p>
              {:else if b.type === 'ul'}
                <ul>
                  {#each b.items as it}<li>{#each parts(it) as x}{#if x.code}<code>{x.t}</code>{:else}{x.t}{/if}{/each}</li>{/each}
                </ul>
              {:else if b.type === 'code'}
                <pre>{b.text}</pre>
              {:else if b.type === 'table'}
                <div class="tw">
                  <table>
                    <thead><tr><th>{b.head[0]}</th><th>{b.head[1]}</th></tr></thead>
                    <tbody>
                      {#each b.rows as r}<tr><td>{r[0]}</td><td>{r[1]}</td></tr>{/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    z-index: 120;
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
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
    flex: 1;
    font-weight: 600;
  }
  .small {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.9rem;
  }
  .content {
    flex: 1;
    overflow: auto;
    padding: 12px 16px 40px;
    max-width: 760px;
    width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
  }
  .intro {
    color: var(--muted);
    font-size: 0.9rem;
  }
  section {
    border-bottom: 1px solid var(--border);
  }
  .head {
    width: 100%;
    display: flex;
    gap: 10px;
    align-items: center;
    text-align: left;
    background: none;
    border: none;
    border-radius: 0;
    font-weight: 600;
    padding: 0 4px;
  }
  .head:hover {
    background: var(--hover);
  }
  section.open .head {
    color: var(--accent);
  }
  .arrow {
    width: 1em;
    flex: none;
    color: var(--muted);
  }
  .blocks {
    padding: 0 8px 16px 28px;
    line-height: 1.65;
    font-size: 0.95rem;
  }
  p {
    margin: 8px 0;
  }
  ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  li {
    margin: 4px 0;
  }
  code,
  pre {
    font-family: var(--mono);
    background: var(--panel);
    border-radius: 4px;
  }
  code {
    padding: 1px 5px;
    font-size: 0.88em;
  }
  pre {
    padding: 10px 12px;
    overflow: auto;
    font-size: 0.85rem;
    white-space: pre;
    tab-size: 4;
  }
  .tw {
    overflow-x: auto;
    margin: 8px 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }
  th,
  td {
    border: 1px solid var(--border);
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--panel);
  }
  td:first-child {
    font-family: var(--mono);
    font-size: 0.85rem;
    min-width: 7rem;
  }
</style>
