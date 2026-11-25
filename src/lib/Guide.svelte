<script lang="ts">
  import { onMount } from 'svelte'
  import { guide, GUIDE_UPDATED } from './guide'
  import { getMeta, setMeta } from './db'

  let { onclose }: { onclose: () => void } = $props()

  let checked = $state<string[]>([])

  onMount(async () => {
    checked = (await getMeta<string[]>('guideChecked')) ?? []
  })

  function toggle(id: string) {
    checked = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setMeta('guideChecked', $state.snapshot(checked)).catch(console.error)
  }

  const all = guide.flatMap((s) => s.steps)
  const done = $derived(all.filter((s) => checked.includes(s.id)).length)
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="page" role="dialog" aria-modal="true" aria-label="Delete app guide">
  <header>
    <button class="back" aria-label="Close" onclick={onclose}>←</button>
    <span class="t">Delete app guide</span>
    <span class="count">{done}/{all.length}</span>
  </header>
  <div class="content">
    <p class="intro">
      Developer-only: when you no longer need cloudtxt, complete every item below in order to remove it completely. Current content covers: {GUIDE_UPDATED}. Greyed "Not active" items do not exist yet; they will be replaced with real steps once enabled.
    </p>
    {#each guide as section}
      <h3>{section.title}</h3>
      {#each section.steps as step (step.id)}
        <label class="step" class:planned={step.status === 'planned'}>
          <input type="checkbox" checked={checked.includes(step.id)} onchange={() => toggle(step.id)} />
          <span class="body">
            <span class="title">
              {step.title}
              {#if step.status === 'planned'}<em>Not active · {step.stage}</em>{/if}
            </span>
            <span class="detail">{step.detail}</span>
          </span>
        </label>
      {/each}
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
  .count {
    color: var(--muted);
    padding-right: 12px;
  }
  .content {
    flex: 1;
    overflow: auto;
    padding: 12px 16px 32px;
    max-width: 720px;
    width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
  }
  .intro {
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.6;
  }
  h3 {
    margin: 20px 0 6px;
    font-size: 1rem;
    color: var(--accent);
  }
  .step {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-height: 44px;
    padding: 10px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  .step:hover {
    background: var(--hover);
  }
  .step.planned {
    opacity: 0.6;
  }
  input {
    width: 22px;
    height: 22px;
    margin: 2px 0 0;
    flex: none;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .title {
    font-weight: 600;
  }
  em {
    font-style: normal;
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1px 8px;
    margin-left: 6px;
  }
  .detail {
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.55;
  }
</style>
