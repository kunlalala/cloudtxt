<script lang="ts">
  import { onMount } from 'svelte'
  import { getImage } from './db'
  import { formatBytes } from './images'

  let { id, onclose }: { id: string; onclose: () => void } = $props()

  let url = $state('')
  let info = $state('')
  let missing = $state(false)

  onMount(() => {
    let created = ''
    void (async () => {
      const image = await getImage(id)
      if (!image) {
        missing = true
        return
      }
      created = URL.createObjectURL(image.blob)
      url = created
      info = `${image.width} × ${image.height} · ${formatBytes(image.size)}`
    })()
    return () => {
      if (created) URL.revokeObjectURL(created)
    }
  })
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="viewer" role="dialog" tabindex="-1" aria-modal="true" aria-label="Image">
  <button class="backdrop" aria-label="Close" onclick={onclose}></button>
  <button class="close" aria-label="Close" onclick={onclose}>✕</button>
  {#if missing}
    <p class="note">This image is not on this device yet. It may arrive with the next sync.</p>
  {:else if url}
    <img src={url} alt="" />
    <p class="info">{info}</p>
  {:else}
    <p class="note">Loading…</p>
  {/if}
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 130;
    background: rgba(8, 10, 14, 0.94);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    box-sizing: border-box;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    background: none;
  }
  img {
    position: relative;
    max-width: 96vw;
    max-height: 84dvh;
    border-radius: 10px;
    cursor: default;
  }
  .note,
  .info,
  .close {
    position: relative;
  }
  .info {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .note {
    color: var(--muted);
    text-align: center;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    color: #fff;
    font-size: 1.2rem;
  }
</style>
